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

  return `You are a Principal Software Engineer, Lead Security Auditor, and Staff Architect.
Conduct an advanced developer-grade code review for the GitHub repository: "${repository.owner}/${repository.name}" (default branch: ${repository.default_branch || 'main'}).
Total source files provided: ${files.length}.

ANALYZE CODE THOROUGHLY ACROSS THESE 8 DIMENSIONS:
1. Security Vulnerabilities: Injection flaws (SQL, command, LDAP), hardcoded credentials/secrets, broken authentication or authorization, unsafe deserialization, cross-site scripting (XSS), insecure dependencies, path traversal.
2. Bugs & Logical Errors: Race conditions, unhandled null/undefined dereferencing, off-by-one errors, infinite loops, incorrect Boolean conditions, state mutations.
3. Performance Issues: Synchronous blocking operations in async workflows, unbounded memory allocations, inefficient algorithmic complexity (O(n^2)+), missing pagination, unindexed queries, duplicate network calls.
4. Code Quality: Weak or loose typing, variable shadowing, magic numbers, poor naming conventions, violation of single responsibility principle.
5. Maintainability: Overly coupled modules, repetitive duplicate logic (DRY violations), poor abstraction boundaries, lack of extensibility.
6. Error Handling: Silent catch blocks swallowing errors, missing finally cleanup, improper error status codes, lack of centralized error middleware, unhandled promise rejections.
7. Bad Practices: Use of dangerous functions (eval, Function constructor, innerHTML), deprecated APIs, mutation of function arguments, inconsistent asynchronous flow (mixing callbacks, promises, and async/await).
8. Architecture Issues: Circular dependencies, tight coupling between transport layer and business logic, lack of separation of concerns, untyped API contracts.

CRITICAL GROUNDING RULES:
- ONLY report issues that are directly evidenced in the provided source code lines.
- Do NOT hallucinate or invent files, imports, or line numbers that do not exist.
- The "file" field MUST be the exact relative file path matching one of the files listed below.
- The "line" field MUST be the exact integer line number from the numbered file listing where the issue begins.
- Prioritize real, high-impact security vulnerabilities and operational bugs over purely aesthetic opinions.
- Clearly distinguish severe runtime defects from optional style improvements.
- Provide actionable, developer-friendly replacement code in "suggestedFix" that solves the problem.
- Output strictly raw JSON without markdown wrapping (no backticks, no \`\`\`json).

STRICT OUTPUT JSON SCHEMA:
{
  "summary": "Detailed 2-3 paragraph executive summary covering codebase architecture, key vulnerabilities, operational strengths, and prioritized remediation roadmap.",
  "score": <integer from 0 to 100 representing overall health score>,
  "stats": {
    "critical": <integer count of CRITICAL issues>,
    "high": <integer count of HIGH issues>,
    "medium": <integer count of MEDIUM issues>,
    "low": <integer count of LOW issues>
  },
  "issues": [
    {
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "category": "Security" | "Bugs" | "Performance" | "Quality" | "Error Handling" | "Bad Practices" | "Architecture" | "Maintainability",
      "title": "<Concise, clear title of the issue>",
      "file": "<Exact relative file path matching input file>",
      "line": <Exact integer line number>,
      "description": "<Detailed explanation of what is wrong and why it is a defect>",
      "impact": "<Concrete operational, security, or business consequence if left unfixed>",
      "recommendation": "<Step-by-step guidance on how to fix or refactor this code>",
      "suggestedFix": "<Clean, complete refactored code replacement solving the issue>",
      "codeSnippet": "<Exact code lines from the source exhibiting the problem>"
    }
  ]
}

SOURCE CODE FILES:
${fileContext}`;
}

/**
 * Extracts code context lines around a given line number from the source file
 */
function extractContextSnippet(fileContent, targetLine, contextRadius = 3) {
  if (!fileContent) return '';
  const lines = fileContent.split('\n');
  const start = Math.max(0, targetLine - 1 - contextRadius);
  const end = Math.min(lines.length, targetLine + contextRadius);
  return lines.slice(start, end).join('\n');
}

/**
 * Derives default impact description if model omitted it
 */
function deriveDefaultImpact(severity, category) {
  switch (severity) {
    case 'CRITICAL':
      return 'Immediate risk of remote code execution, authentication bypass, or catastrophic credential exposure.';
    case 'HIGH':
      return 'Significant risk of security compromise, unhandled server crashes, or data corruption in production.';
    case 'MEDIUM':
      return 'Degrades system performance, introduces flaky runtime behavior, or hinders maintainability.';
    default:
      return 'Minor impact on code readability, maintainability, or consistency with modern engineering standards.';
  }
}

/**
 * Normalizes output format to ensure strict compliance with user schema and frontend types
 */
function normalizeGeminiOutput(raw, repository, files) {
  let parsed = raw;

  if (typeof raw === 'string') {
    let cleaned = raw.trim();
    // Strip markdown code fences if model enclosed in ```json ... ```
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    // Extract JSON block between first { and last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      // Auto-repair common trailing comma issues
      try {
        const repaired = cleaned.replace(/,\s*([}\]])/g, '$1');
        parsed = JSON.parse(repaired);
      } catch (repairErr) {
        console.warn(`[geminiService] JSON parse failed (${parseErr.message}). Falling back to static rule engine.`);
        parsed = runStaticFallback(repository, files);
      }
    }
  }

  const rawIssues = Array.isArray(parsed?.issues) ? parsed.issues : [];

  // Map file paths to file content for snippet enrichment
  const fileContentMap = new Map();
  files.forEach((f) => fileContentMap.set(f.path, f.content));

  const issues = rawIssues.map((issue, idx) => {
    const rawSev = String(issue.severity || 'MEDIUM').toUpperCase();
    const severity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(rawSev) ? rawSev : 'MEDIUM';

    const rawCat = String(issue.category || 'Quality');
    let category = 'Quality';
    if (/sec/i.test(rawCat)) category = 'Security';
    else if (/bug/i.test(rawCat)) category = 'Bugs';
    else if (/perf/i.test(rawCat)) category = 'Performance';
    else if (/error/i.test(rawCat)) category = 'Error Handling';
    else if (/practice/i.test(rawCat)) category = 'Bad Practices';
    else if (/arch/i.test(rawCat)) category = 'Architecture';
    else if (/maintain/i.test(rawCat)) category = 'Maintainability';
    else if (/qual/i.test(rawCat)) category = 'Quality';

    // Normalize file matching against provided files
    let file = issue.file || issue.filePath || '';
    if (!fileContentMap.has(file)) {
      const match = files.find((f) => f.path.endsWith(file) || file.endsWith(f.path));
      file = match ? match.path : (files[0]?.path || 'source.js');
    }

    const line = Math.max(1, Number(issue.line || issue.lineNumber || 1));
    const title = issue.title || 'Code Observation';
    const description = issue.description || 'No detailed description provided.';
    const impact = issue.impact || deriveDefaultImpact(severity, category);
    const recommendation = issue.recommendation || 'Follow modern coding standards.';
    const suggestedFix = issue.suggestedFix || issue.fixedCodeSnippet || '';

    let codeSnippet = issue.codeSnippet || '';
    if (!codeSnippet && fileContentMap.has(file)) {
      codeSnippet = extractContextSnippet(fileContentMap.get(file), line, 3);
    }

    return {
      id: issue.id || `ISSUE-${idx + 1}`,
      severity,
      category,
      title,
      file,
      filePath: file,
      line,
      lineNumber: line,
      description,
      impact,
      recommendation,
      suggestedFix,
      fixedCodeSnippet: suggestedFix,
      codeSnippet,
    };
  });

  // Calculate stats
  const stats = {
    critical: issues.filter((i) => i.severity === 'CRITICAL').length,
    high: issues.filter((i) => i.severity === 'HIGH').length,
    medium: issues.filter((i) => i.severity === 'MEDIUM').length,
    low: issues.filter((i) => i.severity === 'LOW').length,
  };

  const rawScore = Number(parsed?.score);
  let score = isNaN(rawScore)
    ? Math.max(20, Math.min(100, 100 - stats.critical * 25 - stats.high * 15 - stats.medium * 7 - stats.low * 2))
    : Math.max(0, Math.min(100, Math.round(rawScore)));

  // Calculate breakdown metrics based on issue severities and categories
  const securityCount = issues.filter((i) => i.category === 'Security').length;
  const bugCount = issues.filter((i) => i.category === 'Bugs' || i.category === 'Error Handling').length;
  const perfCount = issues.filter((i) => i.category === 'Performance').length;
  const qualityCount = issues.filter((i) => ['Quality', 'Bad Practices', 'Maintainability', 'Architecture'].includes(i.category)).length;

  const metrics = {
    codeQuality: Math.max(30, Math.min(100, 95 - qualityCount * 8)),
    security: Math.max(20, Math.min(100, 98 - securityCount * 18)),
    performance: Math.max(30, Math.min(100, 94 - perfCount * 10)),
    maintainability: Math.max(25, Math.min(100, 96 - bugCount * 12)),
  };

  return {
    summary:
      parsed?.summary ||
      `Gemini AI code review completed for ${repository.owner}/${repository.name}. Analyzed ${files.length} primary source code files with ${issues.length} detected observation(s).`,
    score,
    stats,
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

      // 1. Secret leakage
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
          impact: 'Compromised API tokens can lead to unauthorized cloud infrastructure access, data breaches, and severe financial abuse.',
          recommendation: 'Move sensitive credentials to environment variables (.env) and access them through process.env.',
          codeSnippet: trimmed,
          suggestedFix: `const apiKey = process.env.API_KEY || '';`,
        });
      }

      // 2. Dangerous eval
      if (/\beval\s*\(/.test(trimmed) || /new\s+Function\s*\(/.test(trimmed)) {
        issues.push({
          id: `ISSUE-${counter++}`,
          severity: 'CRITICAL',
          category: 'Security',
          file: file.path,
          line: lineNum,
          title: 'Arbitrary Code Execution via eval() or dynamic Function',
          description: 'Executing dynamic code via eval() or new Function() allows arbitrary code execution and code injection vulnerabilities.',
          impact: 'Attackers can exploit input parameters to execute arbitrary code within the host runtime process.',
          recommendation: 'Replace dynamic evaluation with structured data parsers like JSON.parse() or dedicated domain engines.',
          codeSnippet: trimmed,
          suggestedFix: `// Safe parser instead of dynamic code execution\nconst data = JSON.parse(input);`,
        });
      }

      // 3. SQL / Query injection
      if (/(SELECT|INSERT|UPDATE|DELETE).*\+.*['"]|SELECT.*`.*\$\{/i.test(trimmed) && !trimmed.includes('?')) {
        issues.push({
          id: `ISSUE-${counter++}`,
          severity: 'HIGH',
          category: 'Security',
          file: file.path,
          line: lineNum,
          title: 'Potential SQL Injection Risk via String Concatenation',
          description: 'Raw SQL query string concatenation detected. User-controlled inputs could manipulate query structure.',
          impact: 'Unauthorized database read/write access, table drops, and privilege escalation.',
          recommendation: 'Always use parameterized prepared statements with query placeholders.',
          codeSnippet: trimmed,
          suggestedFix: `// Use parameterized query\nconst [results] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);`,
        });
      }

      // 4. Synchronous blocking I/O
      if (/(readFileSync|writeFileSync)\s*\(/.test(trimmed)) {
        issues.push({
          id: `ISSUE-${counter++}`,
          severity: 'MEDIUM',
          category: 'Performance',
          file: file.path,
          line: lineNum,
          title: 'Synchronous File System Operation in Execution Path',
          description: 'Synchronous I/O operations block Node.js event loop, severely degrading concurrent throughput under production traffic.',
          impact: 'High latency spikes and stalled HTTP request processing for all concurrent active users.',
          recommendation: 'Refactor to asynchronous fs.promises methods (e.g. await fs.readFile()).',
          codeSnippet: trimmed,
          suggestedFix: `const content = await fs.promises.readFile(targetPath, 'utf8');`,
        });
      }

      // 5. Empty catch swallowing errors
      if (/catch\s*\(.*\)\s*\{\s*\}/.test(trimmed)) {
        issues.push({
          id: `ISSUE-${counter++}`,
          severity: 'MEDIUM',
          category: 'Error Handling',
          file: file.path,
          line: lineNum,
          title: 'Empty Catch Block Suppresses Exceptions',
          description: 'Swallowing errors without logging or handling creates silent failures that make debugging and observability very difficult.',
          impact: 'Failed transactions or corrupted states go unnoticed by monitoring systems, hindering recovery.',
          recommendation: 'Properly handle or log the exception within the catch block, or bubble it up to a central error handler.',
          codeSnippet: trimmed,
          suggestedFix: `catch (err) {\n  console.error('[Service Error]:', err);\n  throw err;\n}`,
        });
      }

      // 6. Loose equality
      if (/[^!=]==[^=]/.test(trimmed) && !trimmed.includes('typeof') && !trimmed.includes('null')) {
        issues.push({
          id: `ISSUE-${counter++}`,
          severity: 'LOW',
          category: 'Quality',
          file: file.path,
          line: lineNum,
          title: 'Loose Equality Operator (==)',
          description: 'Using double equals (==) causes implicit type coercion which frequently causes subtle runtime edge-case bugs.',
          impact: 'Unexpected truthiness coercion (e.g., "" == 0 evaluates to true) causing logical branch deviations.',
          recommendation: 'Use strict equality (===) to prevent unexpected truthiness coercions.',
          codeSnippet: trimmed,
          suggestedFix: trimmed.replace(/==/g, '==='),
        });
      }

      // 7. innerHTML XSS Risk
      if (/\.innerHTML\s*=/.test(trimmed)) {
        issues.push({
          id: `ISSUE-${counter++}`,
          severity: 'HIGH',
          category: 'Security',
          file: file.path,
          line: lineNum,
          title: 'Direct innerHTML Assignment (DOM XSS Risk)',
          description: 'Assigning unescaped user data directly to innerHTML can lead to Cross-Site Scripting (DOM XSS).',
          impact: 'Malicious scripts can hijack user session cookies, execute unauthorized actions, or deface the user interface.',
          recommendation: 'Use textContent, innerText, or a sanitization library like DOMPurify before injecting markup.',
          codeSnippet: trimmed,
          suggestedFix: trimmed.replace(/innerHTML/g, 'textContent'),
        });
      }
    });
  }

  const critical = issues.filter((i) => i.severity === 'CRITICAL').length;
  const high = issues.filter((i) => i.severity === 'HIGH').length;
  const medium = issues.filter((i) => i.severity === 'MEDIUM').length;
  const low = issues.filter((i) => i.severity === 'LOW').length;

  const score = Math.max(35, Math.min(98, 98 - critical * 25 - high * 15 - medium * 6 - low * 2));

  return {
    summary: `Code review completed for ${repository.owner}/${repository.name}. Analyzed ${files.length} primary source code files. Codebase health score: ${score}/100 with ${issues.length} detected observation(s). Note: Live Google Gemini LLM reasoning is active when GEMINI_API_KEY is configured in server/.env.`,
    score,
    stats: { critical, high, medium, low },
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
        stats: { critical: 0, high: 0, medium: 0, low: 0 },
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
        const modelName = config.ai.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.7-flash';

        // 1. Try with @google/genai SDK with 15s timeout
        try {
          const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
          const sdkPromise = ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SDK call timed out after 15s')), 15000)
          );

          const response = await Promise.race([sdkPromise, timeoutPromise]);

          if (response && response.text) {
            console.log(`[geminiService] Gemini SDK response received successfully using ${modelName}.`);
            return normalizeGeminiOutput(response.text, repository, files);
          }
        } catch (sdkErr) {
          console.warn(`[geminiService] SDK call (${modelName}) error: ${sdkErr.message}. Trying candidate models via REST fallback...`);
        }

        // 2. Direct REST Fallback (handles model variations with deduplication and 12s timeout)
        const candidateModels = Array.from(new Set([
          modelName,
          'gemini-3.7-flash',
          'gemini-3.5-flash',
          'gemini-flash-latest',
          'gemini-3.8-flash',
          'gemini-3.1-flash-lite',
        ]));

        for (const model of candidateModels) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(12000),
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
