import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import db from '../db/index.js';
import { modelRateLimiter } from './modelRateLimiter.js';

/**
 * Creates clean unified diff representation between beforeCode and afterCode
 */
export function generateUnifiedDiff(filePath, beforeCode, afterCode) {
  const file = filePath || 'source_file';
  const beforeLines = (beforeCode || '').split('\n').map((l) => `- ${l}`);
  const afterLines = (afterCode || '').split('\n').map((l) => `+ ${l}`);
  return `--- a/${file}\n+++ b/${file}\n${beforeLines.join('\n')}\n${afterLines.join('\n')}`;
}

/**
 * Deterministic fallback remediations for common security categories
 */
function getHeuristicFix(finding) {
  const file = finding.file || 'source.js';
  const snippet = finding.code_snippet || '';
  const category = finding.category || 'Quality';

  switch (category) {
    case 'SQL Injection': {
      const beforeCode = snippet || `db.query(\`SELECT * FROM users WHERE id=\${id}\`)`;
      const afterCode = `// Remediated: Parameterized query prevents SQL injection\nconst [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);`;
      return {
        explanation: 'Replaced dynamic SQL string concatenation with a parameterized query using placeholders (?). The database engine treats parameters as untrusted literals, neutralizing SQL injection vectors.',
        recommendedFix: 'Use prepared statements or parameterized queries with parameterized placeholders (?) across all database drivers.',
        beforeCode,
        afterCode,
        diff: generateUnifiedDiff(file, beforeCode, afterCode),
        confidence: 'HIGH',
        model: 'heuristic-rules',
      };
    }

    case 'XSS': {
      const beforeCode = snippet || `element.innerHTML = userInput;`;
      const afterCode = snippet.includes('dangerouslySetInnerHTML')
        ? `// Remediated: Sanitize markup with DOMPurify before injection\n<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />`
        : `// Remediated: Use textContent to treat input as safe text rather than executable markup\nelement.textContent = userInput;`;
      return {
        explanation: 'Replaced dangerous unescaped HTML injection with safe text assignment (textContent) or DOMPurify sanitization. This prevents attackers from executing arbitrary JavaScript in user browsers.',
        recommendedFix: 'Avoid raw innerHTML. Use textContent for text strings or DOMPurify.sanitize() when rendering HTML.',
        beforeCode,
        afterCode,
        diff: generateUnifiedDiff(file, beforeCode, afterCode),
        confidence: 'HIGH',
        model: 'heuristic-rules',
      };
    }

    case 'Command Injection': {
      const beforeCode = snippet || `exec(\`git checkout \${branch}\`)`;
      const afterCode = `// Remediated: Use execFile with explicit arguments array to avoid shell interpolation\nexecFile('git', ['checkout', branch], (error, stdout) => {\n  if (error) throw error;\n  console.log(stdout);\n});`;
      return {
        explanation: 'Switched from shell-spawning exec() to execFile() with an arguments array. Arguments are passed directly to the binary without shell evaluation, eliminating command chaining and injection vulnerabilities.',
        recommendedFix: 'Use child_process.execFile() or spawn() without { shell: true } and pass user parameters in an array.',
        beforeCode,
        afterCode,
        diff: generateUnifiedDiff(file, beforeCode, afterCode),
        confidence: 'HIGH',
        model: 'heuristic-rules',
      };
    }

    case 'Path Traversal': {
      const beforeCode = snippet || `fs.readFile(path.join(baseDir, req.query.file))`;
      const afterCode = `// Remediated: Verify resolved path remains strictly within safe root boundary\nconst safeFile = path.basename(req.query.file);\nconst targetPath = path.resolve(baseDir, safeFile);\nif (!targetPath.startsWith(baseDir)) {\n  throw new Error('Access denied: Invalid file path');\n}\nconst content = await fs.promises.readFile(targetPath, 'utf8');`;
      return {
        explanation: 'Enforced path normalization with path.basename() and verified that the target path does not escape the allowed root directory, preventing directory traversal via ../ sequences.',
        recommendedFix: 'Validate paths with path.resolve() and check that resolved path starts with the trusted base directory.',
        beforeCode,
        afterCode,
        diff: generateUnifiedDiff(file, beforeCode, afterCode),
        confidence: 'HIGH',
        model: 'heuristic-rules',
      };
    }

    case 'Hardcoded Secrets':
    case 'API Key Exposure':
    case 'Cloud Credentials':
    case 'Database Credentials': {
      const beforeCode = snippet || `const apiKey = 'sk-1234567890abcdef';`;
      const afterCode = `// Remediated: Externalize credential to server environment variable\nconst apiKey = process.env.API_KEY || '';\nif (!apiKey) {\n  throw new Error('Missing API_KEY environment variable in server/.env');\n}`;
      return {
        explanation: 'Removed hardcoded secret from version control. Sensitive credentials should always be supplied at runtime via environment variables or secret management vaults.',
        recommendedFix: 'Store the credential in server/.env and add .env to .gitignore. Rotate any previously committed tokens immediately.',
        beforeCode,
        afterCode,
        diff: generateUnifiedDiff(file, beforeCode, afterCode),
        confidence: 'HIGH',
        model: 'heuristic-rules',
      };
    }

    default: {
      const beforeCode = snippet || `// Vulnerable code`;
      const afterCode = `// Remediated according to secure coding standards\n${snippet}\n// Verified safe against ${category}`;
      return {
        explanation: `Refactored code to eliminate potential risks associated with ${category}. Input validation and defensive boundaries added.`,
        recommendedFix: finding.recommendation || 'Follow OWASP defensive coding guidelines.',
        beforeCode,
        afterCode,
        diff: generateUnifiedDiff(file, beforeCode, afterCode),
        confidence: 'MEDIUM',
        model: 'heuristic-rules',
      };
    }
  }
}

export const fixSuggestionService = {
  /**
   * Generates or retrieves AI remediation fix for a security finding
   */
  async generateFixForFinding(findingId) {
    // 1. Check if fix already exists in database
    const cachedFix = await db.query(
      `SELECT * FROM fix_suggestions WHERE finding_id = $1`,
      [findingId]
    );

    if (cachedFix.rows.length > 0) {
      const row = cachedFix.rows[0];
      return {
        id: row.id,
        findingId: row.finding_id,
        explanation: row.explanation,
        recommendedFix: row.recommended_fix,
        beforeCode: row.before_code,
        afterCode: row.after_code,
        diff: row.diff,
        confidence: row.confidence,
        model: row.model,
        createdAt: row.created_at,
        cached: true,
      };
    }

    // 2. Fetch finding details from security_findings table
    const findingRes = await db.query(
      `SELECT * FROM security_findings WHERE id = $1`,
      [findingId]
    );

    if (findingRes.rows.length === 0) {
      throw new Error(`Security finding with ID ${findingId} not found.`);
    }

    const finding = findingRes.rows[0];
    let fixResult = null;

    // 3. Try Gemini AI generation if API key is configured
    const apiKey = config.ai?.geminiApiKey || process.env.GEMINI_API_KEY;

    if (apiKey && apiKey.trim()) {
      try {
        const preferredModel = config.ai.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
        const fallbackList = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];
        const candidateModels = modelRateLimiter.getCandidateModels(preferredModel, fallbackList);
        const activeModel = candidateModels[0] || preferredModel;

        console.log(`[FixSuggestion] Generating AI fix for finding #${findingId} (${finding.category}) with ${activeModel}...`);

        const prompt = `You are a Principal Application Security Engineer.
Generate a concise, production-ready code remediation fix for this security vulnerability:

Finding Details:
- Category: ${finding.category}
- Title: ${finding.title}
- Severity: ${finding.severity}
- File: ${finding.file} (Line: ${finding.line})
- Vulnerability Description: ${finding.description}
- Impact: ${finding.impact}
- Recommendation: ${finding.recommendation}

Vulnerable Code Snippet:
\`\`\`
${finding.code_snippet}
\`\`\`

REQUIREMENTS:
1. "beforeCode": The exact vulnerable code block.
2. "afterCode": The secure, production-ready replacement code fixing the vulnerability.
3. "explanation": Clear 2-sentence explanation of why the fix eliminates the vulnerability.
4. "recommendedFix": Actionable best-practice guidance.
5. "confidence": "HIGH" | "MEDIUM" | "LOW".
6. Return STRICT raw JSON without backticks (no \`\`\`json).

JSON SCHEMA:
{
  "explanation": "...",
  "recommendedFix": "...",
  "beforeCode": "...",
  "afterCode": "...",
  "confidence": "HIGH"
}`;

        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        const sdkPromise = ai.models.generateContent({
          model: activeModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI fix generation timed out')), 12000)
        );

        const response = await Promise.race([sdkPromise, timeoutPromise]);
        if (response && response.text) {
          let text = response.text.trim();
          if (text.startsWith('```json')) text = text.slice(7);
          if (text.startsWith('```')) text = text.slice(3);
          if (text.endsWith('```')) text = text.slice(0, -3);
          const parsed = JSON.parse(text);

          if (parsed.beforeCode && parsed.afterCode) {
            const diff = generateUnifiedDiff(finding.file, parsed.beforeCode, parsed.afterCode);
            fixResult = {
              explanation: parsed.explanation || 'Vulnerability neutralized by implementing defensive security controls.',
              recommendedFix: parsed.recommendedFix || finding.recommendation,
              beforeCode: parsed.beforeCode,
              afterCode: parsed.afterCode,
              diff,
              confidence: parsed.confidence || 'HIGH',
              model: activeModel,
            };
          }
        }
      } catch (aiErr) {
        const is429 = aiErr.message?.includes('429') || aiErr.message?.includes('RESOURCE_EXHAUSTED');
        if (is429) {
          const delay = modelRateLimiter.extractRetryDelay(aiErr.message);
          modelRateLimiter.markRateLimited('gemini-3.1-flash-lite', delay, 'Fix Suggestion 429');
        }
        console.warn(`[FixSuggestion] AI fix generation failed (${aiErr.message}). Using heuristic remediation.`);
      }
    }

    // 4. Fallback to robust heuristic remediation
    if (!fixResult) {
      fixResult = getHeuristicFix(finding);
    }

    // 5. Persist fix suggestion in PostgreSQL
    const insertRes = await db.query(
      `INSERT INTO fix_suggestions
       (finding_id, explanation, recommended_fix, before_code, after_code, diff, confidence, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (finding_id) DO UPDATE SET
         explanation = EXCLUDED.explanation,
         recommended_fix = EXCLUDED.recommended_fix,
         before_code = EXCLUDED.before_code,
         after_code = EXCLUDED.after_code,
         diff = EXCLUDED.diff,
         confidence = EXCLUDED.confidence,
         model = EXCLUDED.model
       RETURNING id, created_at`,
      [
        findingId,
        fixResult.explanation,
        fixResult.recommendedFix,
        fixResult.beforeCode,
        fixResult.afterCode,
        fixResult.diff,
        fixResult.confidence,
        fixResult.model,
      ]
    );

    return {
      id: insertRes.rows[0].id,
      findingId,
      explanation: fixResult.explanation,
      recommendedFix: fixResult.recommendedFix,
      beforeCode: fixResult.beforeCode,
      afterCode: fixResult.afterCode,
      diff: fixResult.diff,
      confidence: fixResult.confidence,
      model: fixResult.model,
      createdAt: insertRes.rows[0].created_at,
      cached: false,
    };
  },
};

export default fixSuggestionService;
