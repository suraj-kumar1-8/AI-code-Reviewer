import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';

/**
 * Builds the prompt sent to Gemini with numbered lines for exact line attribution
 */
function buildGeminiPrompt(repository, files) {
  let fileContext = '';

  for (const file of files) {
    const lines = file.content.split('\n');
    const numberedContent = lines
      .slice(0, 350) // Inspect up to first 350 lines per file
      .map((line, idx) => `${idx + 1} | ${line}`)
      .join('\n');

    fileContext += `\n\n=== FILE: ${file.path} (${file.language}, ${file.lineCount} lines) ===\n${numberedContent}`;
  }

  return `You are a Principal Software Engineer and Cybersecurity Auditor.
Review the following GitHub repository: "${repository.owner}/${repository.name}" (default branch: ${repository.default_branch || 'main'}).
Total relevant source files provided: ${files.length}.

Analyze the codebase thoroughly across these 6 areas:
1. Bugs & Logic Errors
2. Security Vulnerabilities (e.g. Injection, Auth flaws, Hardcoded secrets, XSS, unsafe inputs)
3. Performance Issues (e.g. Memory leaks, unmemoized expensive loops, blocking synchronous I/O)
4. Code Quality (e.g. Type safety, strict equality, variable scoping)
5. Maintainability & Architecture
6. Best Practices

You MUST respond strictly with a valid JSON object matching this EXACT schema:
{
  "summary": "A detailed 2-3 paragraph executive review explaining the codebase architecture, strengths, and areas requiring remediation.",
  "score": <integer from 0 to 100 representing overall health score>,
  "issues": [
    {
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "category": "Security" | "Bug" | "Performance" | "Quality",
      "file": "<relative file path matching the input file path>",
      "line": <line number integer where issue occurs>,
      "title": "<concise title of the issue>",
      "description": "<detailed explanation of what is wrong and why it is a risk>",
      "recommendation": "<practical instruction to resolve it>",
      "codeSnippet": "<exact code lines exhibiting the issue>",
      "fixedCodeSnippet": "<concrete refactored replacement code>"
    }
  ]
}

SOURCE CODE FILES:
${fileContext}`;
}

/**
 * Normalizes output format to ensure strict compliance with user schema and frontend types
 */
function normalizeGeminiOutput(raw, repository, files) {
  let parsed = raw;

  if (typeof raw === 'string') {
    // Strip markdown code fences if model enclosed in ```json ... ```
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    parsed = JSON.parse(cleaned.trim());
  }

  const rawIssues = Array.isArray(parsed.issues) ? parsed.issues : [];

  const issues = rawIssues.map((issue, idx) => {
    const rawSev = String(issue.severity || 'MEDIUM').toUpperCase();
    const severity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(rawSev) ? rawSev : 'MEDIUM';

    const rawCat = String(issue.category || 'Quality');
    let category = 'Quality';
    if (/sec/i.test(rawCat)) category = 'Security';
    else if (/bug/i.test(rawCat)) category = 'Bug';
    else if (/perf/i.test(rawCat)) category = 'Performance';
    else if (/qual|maintain/i.test(rawCat)) category = 'Quality';

    const file = issue.file || issue.filePath || files[0]?.path || 'source.js';
    const line = Number(issue.line || issue.lineNumber || 1);

    return {
      id: issue.id || `ISSUE-${idx + 1}`,
      severity,
      category,
      file,
      filePath: file,
      line,
      lineNumber: line,
      title: issue.title || 'Code Observation',
      description: issue.description || 'No detailed description provided.',
      recommendation: issue.recommendation || 'Follow modern coding standards.',
      codeSnippet: issue.codeSnippet || '',
      fixedCodeSnippet: issue.fixedCodeSnippet || '',
    };
  });

  const rawScore = Number(parsed.score);
  const score = isNaN(rawScore) ? 80 : Math.max(0, Math.min(100, Math.round(rawScore)));

  // Calculate breakdown metrics based on issue severities and categories
  const securityIssues = issues.filter((i) => i.category === 'Security');
  const bugIssues = issues.filter((i) => i.category === 'Bug');
  const perfIssues = issues.filter((i) => i.category === 'Performance');
  const qualityIssues = issues.filter((i) => i.category === 'Quality');

  const metrics = {
    codeQuality: Math.max(30, Math.min(100, 95 - qualityIssues.length * 8)),
    security: Math.max(25, Math.min(100, 96 - securityIssues.length * 15)),
    performance: Math.max(35, Math.min(100, 92 - perfIssues.length * 10)),
    maintainability: Math.max(30, Math.min(100, 94 - bugIssues.length * 10)),
  };

  return {
    summary: parsed.summary || `Gemini AI code review completed for ${repository.owner}/${repository.name}.`,
    score,
    metrics,
    issues,
    analyzedFilesCount: files.length,
    repository: {
      owner: repository.owner,
      name: repository.name,
      branch: repository.default_branch || 'main',
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Resilient static rule engine fallback if GEMINI_API_KEY is not set or quota exceeded
 */
function runStaticFallback(repository, files) {
  const issues = [];
  let counter = 1;

  for (const file of files) {
    const lines = file.content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      // Secret leakage
      if (
        /(api[_-]?key|secret|token|password|auth[_-]?key)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i.test(trimmed) &&
        !trimmed.toLowerCase().includes('process.env')
      ) {
        issues.push({
          id: `ISSUE-${counter++}`,
          severity: 'CRITICAL',
          category: 'Security',
          file: file.path,
          line: lineNum,
          title: 'Hardcoded Secret / API Token Detected',
          description: 'A potential secret or token appears hardcoded in plain text. This poses high credential leakage risks if committed publicly.',
          recommendation: 'Move sensitive credentials to environment variables (.env) and access them through process.env.',
          codeSnippet: trimmed,
          fixedCodeSnippet: `const apiKey = process.env.API_KEY || '';`,
        });
      }

      // Dangerous eval
      if (/\beval\s*\(/.test(trimmed) || /new\s+Function\s*\(/.test(trimmed)) {
        issues.push({
          id: `ISSUE-${counter++}`,
          severity: 'HIGH',
          category: 'Security',
          file: file.path,
          line: lineNum,
          title: 'Use of eval() or dynamic Function execution',
          description: 'Executing dynamic code via eval() or new Function() allows arbitrary code execution and code injection vulnerabilities.',
          recommendation: 'Replace dynamic evaluation with structured data parsers like JSON.parse().',
          codeSnippet: trimmed,
          fixedCodeSnippet: `// Use safe parser instead of eval\nconst data = JSON.parse(input);`,
        });
      }

      // SQL / Query injection
      if (/(SELECT|INSERT|UPDATE|DELETE).*\+.*['"]|SELECT.*`.*\$\{/i.test(trimmed) && !trimmed.includes('?')) {
        issues.push({
          id: `ISSUE-${counter++}`,
          severity: 'HIGH',
          category: 'Security',
          file: file.path,
          line: lineNum,
          title: 'Potential SQL Injection Risk',
          description: 'Raw SQL query string concatenation detected. User-controlled inputs could manipulate query structure.',
          recommendation: 'Always use parameterized prepared statements with query placeholders.',
          codeSnippet: trimmed,
          fixedCodeSnippet: `// Use parameterized query\ndb.query('SELECT * FROM users WHERE id = ?', [userId]);`,
        });
      }

      // Synchronous blocking I/O
      if (/(readFileSync|writeFileSync)\s*\(/.test(trimmed)) {
        issues.push({
          id: `ISSUE-${counter++}`,
          severity: 'MEDIUM',
          category: 'Performance',
          file: file.path,
          line: lineNum,
          title: 'Synchronous File System Operation in Execution Path',
          description: 'Synchronous I/O operations block Node.js event loop, severely degrading concurrent throughput under production traffic.',
          recommendation: 'Refactor to asynchronous fs.promises methods (e.g. await fs.readFile()).',
          codeSnippet: trimmed,
          fixedCodeSnippet: `const content = await fs.promises.readFile(targetPath, 'utf8');`,
        });
      }

      // Loose equality
      if (/[^!=]==[^=]/.test(trimmed) && !trimmed.includes('typeof') && !trimmed.includes('null')) {
        issues.push({
          id: `ISSUE-${counter++}`,
          severity: 'LOW',
          category: 'Quality',
          file: file.path,
          line: lineNum,
          title: 'Loose Equality Operator (==)',
          description: 'Using double equals (==) causes implicit type coercion which frequently causes subtle runtime edge-case bugs.',
          recommendation: 'Use strict equality (===) to prevent unexpected truthiness coercions.',
          codeSnippet: trimmed,
          fixedCodeSnippet: trimmed.replace(/==/g, '==='),
        });
      }

      // Empty catch
      if (/catch\s*\(.*\)\s*\{\s*\}/.test(trimmed)) {
        issues.push({
          id: `ISSUE-${counter++}`,
          severity: 'MEDIUM',
          category: 'Bug',
          file: file.path,
          line: lineNum,
          title: 'Empty Catch Block Suppresses Errors',
          description: 'Swallowing errors without logging or handling them creates silent failures that make debugging and observability very difficult.',
          recommendation: 'Properly handle or log the exception within the catch block.',
          codeSnippet: trimmed,
          fixedCodeSnippet: `catch (err) {\n  console.error('[Error]:', err);\n  throw err;\n}`,
        });
      }
    });
  }

  const score = Math.max(45, Math.min(98, 95 - issues.length * 6));

  return {
    summary: `Code review completed for ${repository.owner}/${repository.name}. Analyzed ${files.length} primary source code files. Codebase health score: ${score}/100 with ${issues.length} detected observation(s). Note: Add GEMINI_API_KEY in server/.env for live Google Gemini LLM reasoning.`,
    score,
    issues,
  };
}

export const geminiService = {
  /**
   * Reviews codebase using Google Gemini API
   */
  async analyzeCodebase({ repository, files }) {
    if (!files || files.length === 0) {
      return {
        summary: `No analyzable code files found in repository ${repository.owner}/${repository.name}.`,
        score: 100,
        metrics: {
          codeQuality: 100,
          security: 100,
          performance: 100,
          maintainability: 100,
        },
        issues: [],
        analyzedFilesCount: 0,
        repository: {
          owner: repository.owner,
          name: repository.name,
          branch: repository.default_branch || 'main',
        },
        timestamp: new Date().toISOString(),
      };
    }

    const apiKey = config.ai.geminiApiKey || process.env.GEMINI_API_KEY;
    const prompt = buildGeminiPrompt(repository, files);

    // If Gemini API Key is available, use Google GenAI
    if (apiKey && apiKey.trim()) {
      try {
        console.log(`[geminiService] Calling Google Gemini API for ${repository.owner}/${repository.name}...`);
        const modelName = config.ai.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.0-flash';

        // 1. Try with @google/genai SDK
        try {
          const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });

          if (response && response.text) {
            console.log(`[geminiService] Gemini SDK response received successfully.`);
            return normalizeGeminiOutput(response.text, repository, files);
          }
        } catch (sdkErr) {
          console.warn(`[geminiService] SDK call encountered error: ${sdkErr.message}. Trying direct REST endpoint...`);
        }

        // 2. Direct REST Fallback (handles model variations)
        const candidateModels = [modelName, 'gemini-2.0-flash', 'gemini-1.5-flash'];
        for (const model of candidateModels) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  response_mime_type: 'application/json',
                  temperature: 0.2,
                },
              }),
            });

            if (res.ok) {
              const data = await res.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                console.log(`[geminiService] Gemini REST call (${model}) succeeded.`);
                return normalizeGeminiOutput(text, repository, files);
              }
            } else {
              const errBody = await res.text();
              console.warn(`[geminiService] Model ${model} returned ${res.status}: ${errBody.slice(0, 150)}`);
            }
          } catch (modelErr) {
            console.warn(`[geminiService] REST attempt for ${model} failed: ${modelErr.message}`);
          }
        }
      } catch (err) {
        console.error(`[geminiService] Gemini API failed: ${err.message}. Running static fallback.`);
      }
    } else {
      console.log(`[geminiService] GEMINI_API_KEY not configured in server/.env. Using static security analysis.`);
    }

    // Static analysis fallback if Gemini key is missing or errored
    const fallbackResult = runStaticFallback(repository, files);
    return normalizeGeminiOutput(fallbackResult, repository, files);
  },
};

export default geminiService;
