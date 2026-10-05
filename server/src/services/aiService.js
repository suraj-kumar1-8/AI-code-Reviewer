import { config } from '../config/index.js';

/**
 * Builds the code prompt sent to the LLM
 */
function buildCodeReviewPrompt(repository, files) {
  let fileContext = '';

  for (const file of files) {
    const lines = file.content.split('\n');
    const numberedContent = lines
      .slice(0, 300) // inspect up to first 300 lines per file
      .map((line, idx) => `${idx + 1} | ${line}`)
      .join('\n');

    fileContext += `\n\n--- FILE: ${file.path} (${file.language}, ${file.lineCount} lines) ---\n${numberedContent}`;
  }

  return `You are a Principal Software Engineer and Cybersecurity Auditor.
Perform a thorough, actionable code review of the following GitHub repository: "${repository.owner}/${repository.name}" (branch: ${repository.default_branch || 'main'}).
Total files inspected: ${files.length}.

Review the code for:
1. Bugs & Logic Errors
2. Security Vulnerabilities (OWASP Top 10, injection, hardcoded secrets, authentication/authorization issues)
3. Performance Issues & Bottlenecks
4. Code Quality & Clean Code principles
5. Maintainability & Architecture
6. Best Practices

You MUST respond strictly with valid, parseable JSON matching this schema:
{
  "summary": "A 2-3 paragraph executive summary evaluating overall code health, architectural design, strengths, and priority remediation areas.",
  "score": <overall codebase health score integer from 0 to 100>,
  "metrics": {
    "codeQuality": <integer 0-100>,
    "security": <integer 0-100>,
    "performance": <integer 0-100>,
    "maintainability": <integer 0-100>
  },
  "issues": [
    {
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "category": "Security" | "Bugs" | "Performance" | "Quality" | "Maintainability",
      "file": "<relative file path matching input exactly>",
      "line": <line number integer>,
      "title": "<concise title of the issue>",
      "description": "<detailed explanation of what is wrong and why it is a risk>",
      "recommendation": "<actionable remediation advice>",
      "codeSnippet": "<exact code lines containing the issue>",
      "fixedCodeSnippet": "<refactored solution fixing the issue>"
    }
  ]
}

REPOSITORY CODE TO REVIEW:
${fileContext}`;
}

/**
 * Calls Google Gemini REST API
 */
async function callGeminiApi(prompt, apiKey) {
  const model = config.ai.geminiModel || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('No content returned by Gemini API');
  }

  return JSON.parse(rawText);
}

/**
 * Calls OpenAI Chat Completions API
 */
async function callOpenAiApi(prompt, apiKey) {
  const model = config.ai.openaiModel || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert static analysis and code review AI. Respond strictly with JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content;

  if (!rawText) {
    throw new Error('No content returned by OpenAI API');
  }

  return JSON.parse(rawText);
}

/**
 * High-Fidelity Static Security & Bug Rule Engine
 * Used when no external API key is set or when external APIs are rate limited
 */
function runStaticAnalysisEngine(repository, files) {
  const issues = [];
  let issueCounter = 1;

  for (const file of files) {
    const lines = file.content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      // 1. Hardcoded Secrets Detection
      if (
        /(api[_-]?key|secret|token|password|auth[_-]?key)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i.test(trimmed) &&
        !trimmed.toLowerCase().includes('process.env')
      ) {
        issues.push({
          id: `ISS-${issueCounter++}`,
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

      // 2. Dangerous eval() or new Function()
      if (/\beval\s*\(/.test(trimmed) || /new\s+Function\s*\(/.test(trimmed)) {
        issues.push({
          id: `ISS-${issueCounter++}`,
          severity: 'HIGH',
          category: 'Security',
          file: file.path,
          line: lineNum,
          title: 'Use of eval() or dynamic Function execution',
          description: 'Executing dynamic code via eval() or new Function() allows arbitrary code execution and code injection vulnerabilities.',
          recommendation: 'Replace dynamic evaluation with structured data parsers like JSON.parse() or dedicated dispatchers.',
          codeSnippet: trimmed,
          fixedCodeSnippet: `// Use safe parser instead of eval\nconst data = JSON.parse(input);`,
        });
      }

      // 3. Command Injection via child_process
      if (/child_process.*\.(exec|execSync)\s*\(/.test(trimmed) && !trimmed.includes('execFile')) {
        issues.push({
          id: `ISS-${issueCounter++}`,
          severity: 'HIGH',
          category: 'Security',
          file: file.path,
          line: lineNum,
          title: 'Insecure child_process.exec Execution',
          description: 'child_process.exec invokes a system shell which is vulnerable to command injection if unescaped variables are concatenated.',
          recommendation: 'Use child_process.execFile() or spawn() with explicit argument arrays to avoid shell expansion.',
          codeSnippet: trimmed,
          fixedCodeSnippet: `// Use execFile with arguments array\nexecFile('git', ['status'], (err, stdout) => { ... });`,
        });
      }

      // 4. SQL Injection via string concatenation
      if (/(SELECT|INSERT|UPDATE|DELETE).*\+.*['"]|SELECT.*`.*\$\{/i.test(trimmed) && !trimmed.includes('?')) {
        issues.push({
          id: `ISS-${issueCounter++}`,
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

      // 5. Synchronous I/O in server paths
      if (/(readFileSync|writeFileSync|existsSync)\s*\(/.test(trimmed) && (file.path.includes('server') || file.path.includes('route') || file.path.includes('controller'))) {
        issues.push({
          id: `ISS-${issueCounter++}`,
          severity: 'MEDIUM',
          category: 'Performance',
          file: file.path,
          line: lineNum,
          title: 'Synchronous File System Operation in Request Path',
          description: 'Synchronous I/O operations block Node.js event loop, severely degrading concurrent throughput under production traffic.',
          recommendation: 'Refactor to asynchronous fs.promises methods (e.g. await fs.readFile()).',
          codeSnippet: trimmed,
          fixedCodeSnippet: `const content = await fs.promises.readFile(targetPath, 'utf8');`,
        });
      }

      // 6. Loose Equality Comparisons
      if (/[^!=]==[^=]/.test(trimmed) && !trimmed.includes('typeof') && !trimmed.includes('null')) {
        issues.push({
          id: `ISS-${issueCounter++}`,
          severity: 'LOW',
          category: 'Quality',
          file: file.path,
          line: lineNum,
          title: 'Loose Equality Operator Used',
          description: 'Using double equals (==) causes implicit type coercion which frequently causes subtle runtime edge-case bugs.',
          recommendation: 'Use strict equality (===) to prevent unexpected truthiness coercions.',
          codeSnippet: trimmed,
          fixedCodeSnippet: trimmed.replace(/==/g, '==='),
        });
      }

      // 7. console.log in production code
      if (/console\.log\s*\(/.test(trimmed) && !file.path.includes('test') && !file.path.includes('script')) {
        issues.push({
          id: `ISS-${issueCounter++}`,
          severity: 'LOW',
          category: 'Maintainability',
          file: file.path,
          line: lineNum,
          title: 'Debug console.log Statement in Production Code',
          description: 'Leftover console statements clutter output streams, may leak internal object details, and can hinder performance in Node.js.',
          recommendation: 'Remove debug console.log calls or replace with a structured logger (Pino, Winston).',
          codeSnippet: trimmed,
          fixedCodeSnippet: `// logger.debug('Context info');`,
        });
      }

      // 8. Empty Catch Blocks
      if (/catch\s*\(.*\)\s*\{\s*\}/.test(trimmed)) {
        issues.push({
          id: `ISS-${issueCounter++}`,
          severity: 'MEDIUM',
          category: 'Bugs',
          file: file.path,
          line: lineNum,
          title: 'Empty Catch Block Suppresses Errors Silently',
          description: 'Swallowing errors without logging or handling them creates silent failures that make debugging and observability very difficult.',
          recommendation: 'Properly handle or log the exception within the catch block.',
          codeSnippet: trimmed,
          fixedCodeSnippet: `catch (err) {\n  console.error('[Service Error]:', err);\n  throw err;\n}`,
        });
      }
    });
  }

  // Calculate score based on issues found
  let penalty = 0;
  for (const issue of issues) {
    if (issue.severity === 'CRITICAL') penalty += 18;
    else if (issue.severity === 'HIGH') penalty += 10;
    else if (issue.severity === 'MEDIUM') penalty += 5;
    else penalty += 2;
  }

  const score = Math.max(35, Math.min(98, 96 - penalty));
  const securityScore = Math.max(30, Math.min(100, 95 - issues.filter((i) => i.category === 'Security').length * 15));
  const codeQualityScore = Math.max(40, Math.min(100, 92 - issues.filter((i) => i.category === 'Quality').length * 8));
  const performanceScore = Math.max(45, Math.min(100, 90 - issues.filter((i) => i.category === 'Performance').length * 10));
  const maintainabilityScore = Math.max(40, Math.min(100, 94 - issues.filter((i) => i.category === 'Maintainability').length * 6));

  return {
    summary: `Automated static code review completed for ${repository.owner}/${repository.name}. Analyzed ${files.length} primary source code files across security, logic bugs, performance, and maintainability. The codebase achieves an overall health score of ${score}/100. Identified ${issues.length} total areas for improvement across ${files.length} inspected source files. ${!config.ai.geminiApiKey && !config.ai.openaiApiKey ? 'Tip: Add GEMINI_API_KEY in server/.env to unlock deep generative AI reasoning and semantic code review.' : ''}`,
    score,
    metrics: {
      codeQuality: codeQualityScore,
      security: securityScore,
      performance: performanceScore,
      maintainability: maintainabilityScore,
    },
    issues,
  };
}

/**
 * Normalizes output format to ensure strict compatibility with client and user requirements
 */
function normalizeReviewResult(rawResult, repository, files) {
  const issues = Array.isArray(rawResult.issues) ? rawResult.issues : [];

  const normalizedIssues = issues.map((issue, idx) => {
    const rawSev = String(issue.severity || 'MEDIUM').toUpperCase();
    const severity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(rawSev) ? rawSev : 'MEDIUM';

    const rawCat = String(issue.category || 'Quality');
    let category = 'Quality';
    if (/security/i.test(rawCat)) category = 'Security';
    else if (/bug/i.test(rawCat)) category = 'Bugs';
    else if (/perf/i.test(rawCat)) category = 'Performance';
    else if (/maintain/i.test(rawCat)) category = 'Maintainability';

    const file = issue.file || issue.filePath || (files[0]?.path || 'source.js');
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

  const rawScore = Number(rawResult.score);
  const score = isNaN(rawScore) ? 80 : Math.max(0, Math.min(100, Math.round(rawScore)));

  const metrics = rawResult.metrics || {
    codeQuality: Math.round(score * 1.02),
    security: Math.round(score * 0.95),
    performance: Math.round(score * 0.98),
    maintainability: Math.round(score * 1.05),
  };

  return {
    summary: rawResult.summary || `Code review completed for ${repository.owner}/${repository.name}.`,
    score,
    metrics: {
      codeQuality: Math.min(100, Math.max(0, Number(metrics.codeQuality) || 80)),
      security: Math.min(100, Math.max(0, Number(metrics.security) || 80)),
      performance: Math.min(100, Math.max(0, Number(metrics.performance) || 80)),
      maintainability: Math.min(100, Math.max(0, Number(metrics.maintainability) || 80)),
    },
    issues: normalizedIssues,
    analyzedFilesCount: files.length,
    repository: {
      owner: repository.owner,
      name: repository.name,
      branch: repository.default_branch || 'main',
    },
    timestamp: new Date().toISOString(),
  };
}

export const aiService = {
  /**
   * Reviews codebase using AI API or resilient static engine
   */
  async analyzeCodebase({ repository, files }) {
    if (!files || files.length === 0) {
      return {
        summary: `No analyzable code files found in repository ${repository.owner}/${repository.name}. The repository might only contain binaries, documentation, or unsupported file formats.`,
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

    const prompt = buildCodeReviewPrompt(repository, files);
    let reviewResult = null;

    // 1. Try Gemini API
    if (config.ai.geminiApiKey) {
      try {
        console.log(`[aiService] Calling Gemini API for ${repository.owner}/${repository.name}...`);
        reviewResult = await callGeminiApi(prompt, config.ai.geminiApiKey);
        console.log(`[aiService] Gemini API review completed successfully.`);
      } catch (err) {
        console.warn(`[aiService] Gemini API call failed: ${err.message}. Falling back.`);
      }
    }

    // 2. Try OpenAI API
    if (!reviewResult && config.ai.openaiApiKey) {
      try {
        console.log(`[aiService] Calling OpenAI API for ${repository.owner}/${repository.name}...`);
        reviewResult = await callOpenAiApi(prompt, config.ai.openaiApiKey);
        console.log(`[aiService] OpenAI API review completed successfully.`);
      } catch (err) {
        console.warn(`[aiService] OpenAI API call failed: ${err.message}. Falling back.`);
      }
    }

    // 3. Fallback to resilient static rule engine
    if (!reviewResult) {
      console.log(`[aiService] Running static code analysis engine for ${repository.owner}/${repository.name}...`);
      reviewResult = runStaticAnalysisEngine(repository, files);
    }

    return normalizeReviewResult(reviewResult, repository, files);
  },
};

export default aiService;
