import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import db from '../db/index.js';
import { modelRateLimiter } from './modelRateLimiter.js';
import { secretDetector } from './secretDetector.js';

// Categories supported by Pro Security Scanner
export const SECURITY_CATEGORIES = [
  'SQL Injection',
  'XSS',
  'Command Injection',
  'Path Traversal',
  'SSRF',
  'Insecure Authentication',
  'Insecure Authorization',
  'Hardcoded Secrets',
  'API Key Exposure',
  'Weak Cryptography',
  'Insecure File Upload',
  'Unsafe Deserialization',
  'Sensitive Information Exposure',
];

/**
 * Creates unique fingerprint for deduplication
 */
function createFindingFingerprint(category, file, line, snippet) {
  const normalizedSnippet = (snippet || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const raw = `${category.toLowerCase()}:${file}:${line}:${normalizedSnippet}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

/**
 * Evaluates source code line-by-line with high-fidelity security heuristics
 */
function scanFileWithStaticRules(file) {
  const findings = [];
  const lines = file.content.split('\n');

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    const trimmed = lineText.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    // 1. SQL Injection: Raw string concatenation or template literal in SQL queries
    if (
      /(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\s+.*(?:\$\{[\w.]+\}|\+\s*[\w.]+)/i.test(trimmed) ||
      /(?:db\.query|db\.execute|connection\.query|pool\.query)\s*\(\s*`[^`]*\$\{/i.test(trimmed) ||
      /(?:db\.query|db\.execute|connection\.query|pool\.query)\s*\(\s*['"][^'"]*['"]\s*\+/i.test(trimmed)
    ) {
      if (!trimmed.includes('?') && !trimmed.includes('$1') && !trimmed.includes(':param')) {
        findings.push({
          severity: 'HIGH',
          category: 'SQL Injection',
          title: 'Potential SQL Injection via Unparameterized Query',
          file: file.path,
          line: lineNum,
          description: `Query constructed with direct string concatenation or template literals without parameter placeholders.`,
          impact: 'Attackers can execute arbitrary SQL statements, bypass authentication, exfiltrate data, or drop database tables.',
          recommendation: 'Use parameterized queries / prepared statements with placeholders (e.g., ?, $1) and pass parameters in an array.',
          confidence: 'HIGH',
          codeSnippet: trimmed,
          isSecret: false,
          maskedSecret: null,
        });
      }
    }

    // 2. Cross-Site Scripting (XSS): Direct innerHTML or dangerouslySetInnerHTML without sanitization
    if (
      /\.innerHTML\s*=/.test(trimmed) ||
      /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/.test(trimmed) ||
      /document\.write\s*\(/.test(trimmed)
    ) {
      if (!trimmed.includes('DOMPurify') && !trimmed.includes('sanitizeHtml')) {
        findings.push({
          severity: 'HIGH',
          category: 'XSS',
          title: 'Cross-Site Scripting (DOM XSS) Risk via Unsanitized Markup',
          file: file.path,
          line: lineNum,
          description: `Direct insertion of raw markup via innerHTML or dangerouslySetInnerHTML without HTML sanitization.`,
          impact: 'Attackers can inject malicious client-side JavaScript, hijack user sessions, steal cookies, or deface the interface.',
          recommendation: 'Use safe DOM assignment methods (textContent, innerText) or sanitize markup using DOMPurify before rendering.',
          confidence: 'HIGH',
          codeSnippet: trimmed,
          isSecret: false,
          maskedSecret: null,
        });
      }
    }

    // 3. Command Injection: Dynamic inputs passed to shell executors
    if (
      /(?:exec|spawn|execSync|child_process\.exec)\s*\(\s*`[^`]*\$\{/i.test(trimmed) ||
      /(?:exec|execSync)\s*\(\s*['"][^'"]*['"]\s*\+/i.test(trimmed)
    ) {
      findings.push({
        severity: 'CRITICAL',
        category: 'Command Injection',
        title: 'Command Injection via Unsanitized Shell Invocation',
        file: file.path,
        line: lineNum,
        description: `Direct dynamic string interpolation into shell execution functions (exec, execSync).`,
        impact: 'Permits full remote operating system command execution under the privileges of the running application process.',
        recommendation: 'Use execFile() or spawn() with argument arrays instead of a raw shell string, and avoid executing arbitrary shell strings.',
        confidence: 'HIGH',
        codeSnippet: trimmed,
        isSecret: false,
        maskedSecret: null,
      });
    }

    // 4. Path Traversal: Dynamic file paths without normalization or boundary validation
    if (
      /(?:fs\.readFile|fs\.readFileSync|fs\.createReadStream|res\.sendFile)\s*\([^)]*(?:req\.query|req\.params|req\.body)/i.test(trimmed)
    ) {
      if (!trimmed.includes('path.normalize') && !trimmed.includes('path.resolve')) {
        findings.push({
          severity: 'HIGH',
          category: 'Path Traversal',
          title: 'Path Traversal Vulnerability in File I/O',
          file: file.path,
          line: lineNum,
          description: `User-controlled request parameters used directly in file system operations without boundary validation.`,
          impact: 'Attackers can supply dot-dot-slash (../../) sequences to read sensitive system files (e.g., /etc/passwd, .env).',
          recommendation: 'Sanitize file names, enforce an allowlist, and verify that the resolved path is within the designated directory.',
          confidence: 'MEDIUM',
          codeSnippet: trimmed,
          isSecret: false,
          maskedSecret: null,
        });
      }
    }

    // 5. SSRF (Server-Side Request Forgery)
    if (
      /(?:axios\.get|axios\.post|fetch|http\.get|https\.get)\s*\([^)]*(?:req\.query|req\.body|req\.params)\./i.test(trimmed)
    ) {
      findings.push({
        severity: 'HIGH',
        category: 'SSRF',
        title: 'Server-Side Request Forgery (SSRF) Risk',
        file: file.path,
        line: lineNum,
        description: `HTTP client makes network requests to an unvalidated URL provided by client-controlled request parameters.`,
        impact: 'Enables attackers to probe internal microservices, cloud metadata endpoints (169.254.169.254), or bypass firewall protections.',
        recommendation: 'Validate target hostnames against a strict allowlist and restrict requests to private IP ranges (RFC 1918).',
        confidence: 'MEDIUM',
        codeSnippet: trimmed,
        isSecret: false,
        maskedSecret: null,
      });
    }

    // 6. Insecure Authentication: Weak password hashing algorithms
    if (
      /createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/i.test(trimmed) &&
      /(?:password|pwd|auth|credential|hash)/i.test(trimmed)
    ) {
      findings.push({
        severity: 'HIGH',
        category: 'Insecure Authentication',
        title: 'Use of Broken Cryptographic Hash for Authentication (MD5/SHA-1)',
        file: file.path,
        line: lineNum,
        description: `MD5 and SHA-1 are cryptographically broken and prone to collision attacks. They must never be used for passwords.`,
        impact: 'Attackers can reverse password hashes using precomputed rainbow tables or high-speed GPU cracking.',
        recommendation: 'Use salted key derivation functions such as bcrypt, argon2, or scrypt for password hashing.',
        confidence: 'HIGH',
        codeSnippet: trimmed,
        isSecret: false,
        maskedSecret: null,
      });
    }

    // 7. Insecure Authorization: Sensitive actions missing auth check
    if (
      /app\.(?:delete|put|post)\s*\([^)]*(?:admin|manage|delete|users)\s*,/i.test(trimmed) &&
      !/(?:auth|verify|protect|require)/i.test(trimmed)
    ) {
      findings.push({
        severity: 'MEDIUM',
        category: 'Insecure Authorization',
        title: 'Privileged Route Handler Lacks Explicit Authorization Middleware',
        file: file.path,
        line: lineNum,
        description: `Sensitive administrative endpoint declared without explicit authentication or role-based access control middleware.`,
        impact: 'Unauthenticated users may invoke administrative endpoints or perform unauthorized data mutations.',
        recommendation: 'Attach authentication and role authorization middleware to all protected administrative endpoints.',
        confidence: 'LOW',
        codeSnippet: trimmed,
        isSecret: false,
        maskedSecret: null,
      });
    }

    // 8. Weak Cryptography: Deprecated ciphers or Math.random() for security tokens
    if (
      /createCipher\s*\(\s*['"](?:des|rc4|blowfish|aes-128-ecb)['"]\s*,/i.test(trimmed) ||
      (trimmed.includes('Math.random()') && /(?:token|secret|session|salt|key|nonce|auth)/i.test(trimmed))
    ) {
      findings.push({
        severity: 'HIGH',
        category: 'Weak Cryptography',
        title: 'Cryptographically Insecure Randomness or Deprecated Cipher',
        file: file.path,
        line: lineNum,
        description: `Math.random() is pseudorandom and predictable. It is not suitable for cryptographic tokens, salts, or passwords.`,
        impact: 'Attackers can predict generated tokens, hijack active sessions, or forge authentication states.',
        recommendation: 'Use crypto.randomBytes() or crypto.randomUUID() for cryptographically secure pseudo-random number generation.',
        confidence: 'HIGH',
        codeSnippet: trimmed,
        isSecret: false,
        maskedSecret: null,
      });
    }

    // 9. Insecure File Upload: Missing type validation
    if (
      /(?:multer|formidable|busboy)/i.test(trimmed) &&
      /(?:dest|storage)/i.test(trimmed) &&
      !/(?:fileFilter|mimetype|limits)/i.test(trimmed)
    ) {
      findings.push({
        severity: 'MEDIUM',
        category: 'Insecure File Upload',
        title: 'Unrestricted File Upload Handler Configuration',
        file: file.path,
        line: lineNum,
        description: `File upload handler appears configured without strict MIME type whitelisting or file size constraints.`,
        impact: 'Attackers can upload executable scripts (.php, .html, .svg with JS) or trigger denial of service with oversized files.',
        recommendation: 'Configure multer with strict fileFilter (allowed MIME types), enforce maximum fileSize limits, and randomize file names.',
        confidence: 'MEDIUM',
        codeSnippet: trimmed,
        isSecret: false,
        maskedSecret: null,
      });
    }

    // 10. Unsafe Deserialization
    if (
      /(?:unserialize|serialize\.unserialize|yaml\.load)\s*\(/i.test(trimmed) &&
      !trimmed.includes('safeLoad') && !trimmed.includes('FAILSAFE_SCHEMA')
    ) {
      findings.push({
        severity: 'CRITICAL',
        category: 'Unsafe Deserialization',
        title: 'Unsafe Object Deserialization',
        file: file.path,
        line: lineNum,
        description: `Unsanitized deserialization of object streams can trigger arbitrary function execution via object prototype pollution.`,
        impact: 'Remote code execution via prototype pollution or gadget chain execution.',
        recommendation: 'Use JSON.parse() with strict schema validation (e.g. Zod) or yaml.load() with FAILSAFE_SCHEMA.',
        confidence: 'HIGH',
        codeSnippet: trimmed,
        isSecret: false,
        maskedSecret: null,
      });
    }

    // 11. Sensitive Information Exposure: Sending password or token in response body
    if (
      /res\.(?:json|send)\s*\([^)]*(?:password|token|secret|credit_card)/i.test(trimmed) &&
      !trimmed.includes('delete') && !trimmed.includes('omit')
    ) {
      findings.push({
        severity: 'MEDIUM',
        category: 'Sensitive Information Exposure',
        title: 'Potential Exposure of Sensitive Fields in HTTP Response',
        file: file.path,
        line: lineNum,
        description: `Direct response object contains fields matching passwords, tokens, or credentials.`,
        impact: 'Leakage of sensitive customer credentials or hashes over the network to client applications.',
        recommendation: 'Explicitly sanitize or exclude sensitive attributes before serializing responses.',
        confidence: 'MEDIUM',
        codeSnippet: trimmed,
        isSecret: false,
        maskedSecret: null,
      });
    }
  });

  return findings;
}

/**
 * Builds the AI Security Auditor prompt
 */
function buildSecurityPrompt(repository, files) {
  let fileContext = '';

  for (const file of files.slice(0, 15)) {
    const lines = file.content.split('\n').slice(0, 300);
    const numbered = lines.map((l, i) => `${i + 1} | ${l}`).join('\n');
    fileContext += `\n\n=== FILE: ${file.path} (${lines.length} lines) ===\n${numbered}`;
  }

  return `You are a Principal Security Auditor and Vulnerability Researcher.
Perform a strict, deep-security inspection on the source files for repository: "${repository.owner}/${repository.name}".

CATEGORIES TO AUDIT:
1. SQL Injection
2. XSS (Cross-Site Scripting)
3. Command Injection
4. Path Traversal
5. SSRF (Server-Side Request Forgery)
6. Insecure Authentication
7. Insecure Authorization
8. Hardcoded Secrets
9. API Key Exposure
10. Weak Cryptography
11. Insecure File Upload
12. Unsafe Deserialization
13. Sensitive Information Exposure

MANDATORY RULES:
- ONLY report findings with ACTUAL source code evidence.
- NEVER invent files or line numbers.
- Provide exact relative file path and integer line number.
- Output raw JSON strictly matching schema (no backticks, no \`\`\`json).

JSON SCHEMA:
{
  "summary": "Detailed security executive summary covering threat model, observed vulnerabilities, and mitigation roadmap.",
  "findings": [
    {
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
      "category": "SQL Injection" | "XSS" | "Command Injection" | "Path Traversal" | "SSRF" | "Insecure Authentication" | "Insecure Authorization" | "Hardcoded Secrets" | "API Key Exposure" | "Weak Cryptography" | "Insecure File Upload" | "Unsafe Deserialization" | "Sensitive Information Exposure",
      "title": "<Concise vulnerability title>",
      "file": "<Exact relative file path>",
      "line": <Integer line number>,
      "description": "<Technical vulnerability description>",
      "impact": "<Concrete security risk / exploit impact>",
      "recommendation": "<Remediation guidance>",
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "codeSnippet": "<Exact vulnerable code line from the source>"
    }
  ]
}

SOURCE CODE:
${fileContext}`;
}

export const securityScannerService = {
  /**
   * Runs comprehensive security scan on repository files
   */
  async runScan({ repository, files = [], commitSha = null, prNumber = null, scannedBy = 'system', force = false }) {
    const repoId = `${repository.owner}/${repository.name}`;
    const targetCommit = commitSha || repository.head_commit_sha || 'HEAD';

    // 1. Duplicate protection: Check if identical scan already exists
    if (!force) {
      try {
        const existingScan = await db.query(
          `SELECT * FROM security_scans 
           WHERE owner = $1 AND repo = $2 AND commit_sha = $3 
           ORDER BY created_at DESC LIMIT 1`,
          [repository.owner, repository.name, targetCommit]
        );

        if (existingScan.rows.length > 0) {
          const scan = existingScan.rows[0];
          console.log(`[SecurityScanner] Returning cached security scan #${scan.id} for ${repoId} @ ${targetCommit}`);

          const findingsRes = await db.query(
            `SELECT f.*, 
                    s.explanation as fix_explanation, s.recommended_fix, s.before_code, s.after_code, s.diff as fix_diff
             FROM security_findings f
             LEFT JOIN fix_suggestions s ON f.id = s.finding_id
             WHERE f.scan_id = $1 
             ORDER BY 
               CASE f.severity 
                 WHEN 'CRITICAL' THEN 1 
                 WHEN 'HIGH' THEN 2 
                 WHEN 'MEDIUM' THEN 3 
                 WHEN 'LOW' THEN 4 
                 ELSE 5 
               END ASC, f.id ASC`,
            [scan.id]
          );

          return {
            id: scan.id,
            repositoryId: repoId,
            owner: repository.owner,
            repo: repository.name,
            commitSha: scan.commit_sha,
            prNumber: scan.pr_number,
            status: scan.status,
            score: scan.score,
            stats: scan.stats,
            filesScanned: scan.files_scanned,
            summary: scan.summary,
            cached: true,
            createdAt: scan.created_at,
            findings: findingsRes.rows.map((r) => ({
              id: r.id,
              severity: r.severity,
              category: r.category,
              title: r.title,
              file: r.file,
              line: r.line,
              description: r.description,
              impact: r.impact,
              recommendation: r.recommendation,
              confidence: r.confidence,
              codeSnippet: r.code_snippet,
              isSecret: r.is_secret,
              maskedSecret: r.masked_secret,
              fingerprint: r.fingerprint,
              hasFix: !!r.fix_diff,
              fix: r.fix_diff ? {
                explanation: r.fix_explanation,
                recommendedFix: r.recommended_fix,
                beforeCode: r.before_code,
                afterCode: r.after_code,
                diff: r.fix_diff,
              } : null,
            })),
          };
        }
      } catch (checkErr) {
        console.warn('[SecurityScanner] Cache check failed:', checkErr.message);
      }
    }

    // 2. Handle empty repository
    if (!files || files.length === 0) {
      console.log(`[SecurityScanner] Repository ${repoId} has no source files to scan.`);
      const emptyStats = { critical: 0, high: 0, medium: 0, low: 0, info: 0, secrets: 0 };
      const emptySummary = `No analyzable code files detected in repository ${repoId}. Security score is 100/100.`;

      const insertRes = await db.query(
        `INSERT INTO security_scans 
         (repository_id, owner, repo, commit_sha, pr_number, scanned_by, status, score, stats, files_scanned, summary)
         VALUES ($1, $2, $3, $4, $5, $6, 'completed', 100, $7, 0, $8)
         RETURNING id, created_at`,
        [repoId, repository.owner, repository.name, targetCommit, prNumber, scannedBy, JSON.stringify(emptyStats), emptySummary]
      );

      return {
        id: insertRes.rows[0].id,
        repositoryId: repoId,
        owner: repository.owner,
        repo: repository.name,
        commitSha: targetCommit,
        prNumber,
        status: 'completed',
        score: 100,
        stats: emptyStats,
        filesScanned: 0,
        summary: emptySummary,
        cached: false,
        createdAt: insertRes.rows[0].created_at,
        findings: [],
      };
    }

    // 3. Limit to top 15 files for performance & payload safety
    const filesToScan = files.slice(0, 15);
    console.log(`[SecurityScanner] Scanning ${filesToScan.length} files for ${repoId} (commit: ${targetCommit})...`);

    // 4. Collect findings from Static Rules & Secret Detector
    const allFindings = [];

    for (const file of filesToScan) {
      // A. Secrets Scan (with safe masking)
      const secrets = secretDetector.scanFileForSecrets(file.path, file.content);
      allFindings.push(...secrets);

      // B. Static Vulnerability Heuristics
      const staticVulns = scanFileWithStaticRules(file);
      allFindings.push(...staticVulns);
    }

    // 4. Optional Gemini AI Deep Analysis (if configured and quota permits)
    const apiKey = config.ai?.geminiApiKey || process.env.GEMINI_API_KEY;
    let aiSummary = null;

    if (apiKey && apiKey.trim()) {
      try {
        const preferredModel = config.ai.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
        const fallbackList = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        const candidateModels = modelRateLimiter.getCandidateModels(preferredModel, fallbackList);
        const activeModel = candidateModels[0] || preferredModel;

        console.log(`[SecurityScanner] Running AI deep scan using ${activeModel}...`);
        const aiPrompt = buildSecurityPrompt(repository, filesToScan);
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

        const sdkPromise = ai.models.generateContent({
          model: activeModel,
          contents: aiPrompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI scan timed out after 15s')), 15000)
        );

        const response = await Promise.race([sdkPromise, timeoutPromise]);
        if (response && response.text) {
          let text = response.text.trim();
          if (text.startsWith('```json')) text = text.slice(7);
          if (text.startsWith('```')) text = text.slice(3);
          if (text.endsWith('```')) text = text.slice(0, -3);
          const parsed = JSON.parse(text);

          if (parsed.summary) aiSummary = parsed.summary;
          if (Array.isArray(parsed.findings)) {
            for (const f of parsed.findings) {
              if (f.file && f.codeSnippet) {
                let codeSnippet = String(f.codeSnippet || '');
                let isSecret = Boolean(f.isSecret);
                let maskedSecret = null;

                // Scan AI snippet for secrets to ensure no unmasked secrets leak
                const secretHits = secretDetector.scanFileForSecrets(f.file, codeSnippet);
                if (secretHits.length > 0) {
                  isSecret = true;
                  maskedSecret = secretHits[0].maskedSecret;
                  codeSnippet = secretHits[0].codeSnippet;
                } else if (
                  f.category === 'Hardcoded Secrets' ||
                  f.category === 'API Key Exposure' ||
                  f.category === 'Cloud Credentials' ||
                  f.category === 'Database Credentials'
                ) {
                  // Fallback masking on matching categories
                  isSecret = true;
                  codeSnippet = codeSnippet.replace(
                    /(['"])(sk-[a-zA-Z0-9_\-]{16,}|ghp_[a-zA-Z0-9]{30,}|AIza[0-9A-Za-z_\-]{30,}|AKIA[0-9A-Z]{16}|[a-zA-Z0-9_\-]{24,})(['"])/g,
                    (m, q1, token, q2) => {
                      const masked = secretDetector.maskSecret(token);
                      if (!maskedSecret) maskedSecret = masked;
                      return `${q1}${masked}${q2}`;
                    }
                  );
                }

                allFindings.push({
                  severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(String(f.severity).toUpperCase())
                    ? String(f.severity).toUpperCase()
                    : 'MEDIUM',
                  category: f.category || 'Quality',
                  title: f.title || 'Security Observation',
                  file: f.file,
                  line: Number(f.line) || 1,
                  description: f.description || '',
                  impact: f.impact || 'Security risk to application components.',
                  recommendation: f.recommendation || 'Remediate according to OWASP guidelines.',
                  confidence: f.confidence || 'HIGH',
                  codeSnippet,
                  isSecret,
                  maskedSecret,
                });
              }
            }
          }
        }
      } catch (aiErr) {
        const is429 = aiErr.message?.includes('429') || aiErr.message?.includes('RESOURCE_EXHAUSTED');
        if (is429) {
          const delay = modelRateLimiter.extractRetryDelay(aiErr.message);
          modelRateLimiter.markRateLimited('gemini-3.1-flash-lite', delay, 'Security Scan 429');
        }
        console.warn(`[SecurityScanner] AI scan bypassed (${aiErr.message}). Static analysis findings preserved.`);
      }
    }

    // 5. Deduplicate findings by fingerprint (category + file + line)
    const seenKeys = new Set();
    const uniqueFindings = [];

    for (const f of allFindings) {
      // Create dedup key: file + line + category (or secret type)
      const dedupKey = f.isSecret
        ? `secret:${f.file}:${f.line}`
        : `${f.category.toLowerCase()}:${f.file}:${f.line}`;

      if (!seenKeys.has(dedupKey)) {
        seenKeys.add(dedupKey);
        const fp = createFindingFingerprint(f.category, f.file, f.line, f.codeSnippet);
        uniqueFindings.push({ ...f, fingerprint: fp });
      }
    }

    // 6. Calculate statistics & score based on actual findings
    const stats = {
      critical: uniqueFindings.filter((f) => f.severity === 'CRITICAL').length,
      high: uniqueFindings.filter((f) => f.severity === 'HIGH').length,
      medium: uniqueFindings.filter((f) => f.severity === 'MEDIUM').length,
      low: uniqueFindings.filter((f) => f.severity === 'LOW').length,
      info: uniqueFindings.filter((f) => f.severity === 'INFO').length,
      secrets: uniqueFindings.filter((f) => f.isSecret).length,
    };

    // Calculate score: 100 - (critical * 25 + high * 15 + medium * 5 + low * 2 + secrets * 10)
    let score = 100 - (stats.critical * 25 + stats.high * 15 + stats.medium * 5 + stats.low * 2 + stats.secrets * 10);
    score = Math.max(0, Math.min(100, Math.round(score)));

    const summary =
      aiSummary ||
      `Security scan completed for ${repoId}. Scanned ${filesToScan.length} source file(s). Found ${uniqueFindings.length} issue(s) (${stats.critical} Critical, ${stats.high} High, ${stats.medium} Medium, ${stats.secrets} Secrets). Security Health Score: ${score}/100.`;

    // 7. Persist to PostgreSQL (security_scans + security_findings)
    const client = await db.pool.connect();
    let scanId;
    let createdAt;

    try {
      await client.query('BEGIN');

      const scanInsert = await client.query(
        `INSERT INTO security_scans
         (repository_id, owner, repo, commit_sha, pr_number, scanned_by, status, score, stats, files_scanned, summary)
         VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8, $9, $10)
         RETURNING id, created_at`,
        [
          repoId,
          repository.owner,
          repository.name,
          targetCommit,
          prNumber,
          scannedBy,
          score,
          JSON.stringify(stats),
          filesToScan.length,
          summary,
        ]
      );

      scanId = scanInsert.rows[0].id;
      createdAt = scanInsert.rows[0].created_at;

      // Insert findings
      for (const finding of uniqueFindings) {
        const findingInsert = await client.query(
          `INSERT INTO security_findings
           (scan_id, repository_id, severity, category, title, file, line, description, impact, recommendation, confidence, code_snippet, is_secret, masked_secret, fingerprint)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING id`,
          [
            scanId,
            repoId,
            finding.severity,
            finding.category,
            finding.title,
            finding.file,
            finding.line,
            finding.description,
            finding.impact,
            finding.recommendation,
            finding.confidence,
            finding.codeSnippet,
            finding.isSecret || false,
            finding.maskedSecret || null,
            finding.fingerprint,
          ]
        );
        finding.id = findingInsert.rows[0].id;
      }

      await client.query('COMMIT');
      console.log(`✅ [SecurityScanner] Saved scan #${scanId} for ${repoId} with ${uniqueFindings.length} findings.`);
    } catch (dbErr) {
      await client.query('ROLLBACK');
      console.error('[SecurityScanner DB Error]:', dbErr.message);
      throw dbErr;
    } finally {
      client.release();
    }

    return {
      id: scanId,
      repositoryId: repoId,
      owner: repository.owner,
      repo: repository.name,
      commitSha: targetCommit,
      prNumber,
      status: 'completed',
      score,
      stats,
      filesScanned: filesToScan.length,
      summary,
      cached: false,
      createdAt,
      findings: uniqueFindings,
    };
  },

  /**
   * Retrieves latest scan for a repository
   */
  async getLatestScan(owner, repo) {
    const res = await db.query(
      `SELECT * FROM security_scans 
       WHERE owner = $1 AND repo = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [owner, repo]
    );

    if (res.rows.length === 0) return null;
    const scan = res.rows[0];

    const findingsRes = await db.query(
      `SELECT f.*, 
              s.explanation as fix_explanation, s.recommended_fix, s.before_code, s.after_code, s.diff as fix_diff
       FROM security_findings f
       LEFT JOIN fix_suggestions s ON f.id = s.finding_id
       WHERE f.scan_id = $1
       ORDER BY 
         CASE f.severity 
           WHEN 'CRITICAL' THEN 1 
           WHEN 'HIGH' THEN 2 
           WHEN 'MEDIUM' THEN 3 
           WHEN 'LOW' THEN 4 
           ELSE 5 
         END ASC, f.id ASC`,
      [scan.id]
    );

    return {
      id: scan.id,
      repositoryId: scan.repository_id,
      owner: scan.owner,
      repo: scan.repo,
      commitSha: scan.commit_sha,
      prNumber: scan.pr_number,
      status: scan.status,
      score: scan.score,
      stats: scan.stats,
      filesScanned: scan.files_scanned,
      summary: scan.summary,
      createdAt: scan.created_at,
      findings: findingsRes.rows.map((r) => ({
        id: r.id,
        severity: r.severity,
        category: r.category,
        title: r.title,
        file: r.file,
        line: r.line,
        description: r.description,
        impact: r.impact,
        recommendation: r.recommendation,
        confidence: r.confidence,
        codeSnippet: r.code_snippet,
        isSecret: r.is_secret,
        maskedSecret: r.masked_secret,
        fingerprint: r.fingerprint,
        hasFix: !!r.fix_diff,
        fix: r.fix_diff ? {
          explanation: r.fix_explanation,
          recommendedFix: r.recommended_fix,
          beforeCode: r.before_code,
          afterCode: r.after_code,
          diff: r.fix_diff,
        } : null,
      })),
    };
  },
};

export default securityScannerService;
