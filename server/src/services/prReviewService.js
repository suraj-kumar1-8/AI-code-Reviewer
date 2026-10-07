import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import { modelRateLimiter } from './modelRateLimiter.js';
import db from '../db/index.js';
import { secretDetector } from './secretDetector.js';

// File extensions and directories to ignore in PR review
const IGNORED_DIRECTORIES = new Set([
  '.git', '.github', 'node_modules', 'dist', 'build', 'out',
  '.next', '.nuxt', 'coverage', '.vscode', '.idea', 'vendor', 'temp', 'tmp'
]);

const IGNORED_FILENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock', 'Cargo.lock',
  '.DS_Store', 'thumbs.db'
]);

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'pdf', 'zip', 'tar', 'gz',
  'woff', 'woff2', 'ttf', 'eot', 'mp4', 'webm', 'mp3', 'wav', 'wasm', 'exe', 'dll'
]);

const MAX_PR_FILES_LIMIT = 20;
const MAX_PATCH_LINES = 350;

/**
 * Builds Gemini prompt for Pull Request code changes
 */
function buildPRPrompt(repository, pullRequest, files) {
  let diffContext = '';

  for (const file of files) {
    const patchLines = (file.patch || '').split('\n').slice(0, MAX_PATCH_LINES).join('\n');
    diffContext += `\n\n=== FILE: ${file.filename} (Status: ${file.status}, +${file.additions}/-${file.deletions}) ===\n${patchLines || '(Binary or metadata change)'}`;
  }

  return `You are a Principal Software Engineer and Lead Security Auditor conducting an AI Pull Request Review.
Repository: "${repository.owner}/${repository.name}"
Pull Request #${pullRequest.number}: "${pullRequest.title}" (by @${pullRequest.author})
Branch: ${pullRequest.baseBranch} <- ${pullRequest.headBranch}
Target Commit SHA: ${pullRequest.headSha}
Total changed files provided: ${files.length}.

GROUNDING RULES (MANDATORY):
1. Review EXCLUSIVELY the code additions and modifications shown in the git diffs below.
2. Do NOT report issues on unchanged files or lines not present in the provided diffs.
3. The "file" field MUST strictly match one of the changed files listed below.
4. The "line" field should refer to the approximate new line number in the modified file.
5. Prioritize severe security vulnerabilities, runtime bugs, and breaking changes over stylistic comments.
6. Return STRICT raw JSON without markdown formatting (no backticks, no \`\`\`json).

STRICT OUTPUT JSON SCHEMA:
{
  "summary": "Detailed 2-paragraph executive review of the PR changes, architecture impact, and readiness to merge.",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "score": <integer from 0 to 100 representing code health>,
  "issues": [
    {
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "category": "Security" | "Bugs" | "Performance" | "Quality" | "Breaking Changes" | "Error Handling" | "Bad Practices",
      "file": "<exact file path from the diff>",
      "line": <integer line number>,
      "title": "<Concise issue title>",
      "description": "<Detailed explanation of the flaw or defect>",
      "recommendation": "<Actionable guidance on how to fix this issue>"
    }
  ]
}

PULL REQUEST CODE DIFFS:
${diffContext}`;
}

/**
 * Parses and normalizes Gemini output
 */
function normalizePROutput(raw, pullRequest, files) {
  let parsed = raw;

  if (typeof raw === 'string') {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      try {
        const repaired = cleaned.replace(/,\s*([}\]])/g, '$1');
        parsed = JSON.parse(repaired);
      } catch {
        parsed = runStaticPRFallback(pullRequest, files);
      }
    }
  }

  const rawIssues = Array.isArray(parsed?.issues) ? parsed.issues : [];
  const fileSet = new Set(files.map((f) => f.filename));

  const issues = rawIssues.map((issue) => {
    let file = issue.file || files[0]?.filename || 'changed_file';
    if (!fileSet.has(file)) {
      const match = files.find((f) => f.filename.endsWith(file) || file.endsWith(f.filename));
      file = match ? match.filename : (files[0]?.filename || file);
    }

    const rawSev = String(issue.severity || 'MEDIUM').toUpperCase();
    const severity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(rawSev) ? rawSev : 'MEDIUM';

    return {
      severity,
      category: issue.category || 'Quality',
      file,
      line: Math.max(1, Number(issue.line) || 1),
      title: issue.title || 'Code Observation',
      description: issue.description || 'No description provided.',
      recommendation: issue.recommendation || 'Follow recommended coding standards.',
    };
  });

  // Security Integration: Scan PR patches for secrets and add non-duplicate findings
  for (const f of files) {
    const patch = f.patch || '';
    if (!patch) continue;
    const detectedSecrets = secretDetector.scanFileForSecrets(f.filename, patch);
    for (const sec of detectedSecrets) {
      const alreadyPresent = issues.some(
        (existing) =>
          existing.file === sec.file &&
          (existing.title.toLowerCase().includes('secret') || existing.title.toLowerCase().includes('key') || existing.category === sec.category)
      );
      if (!alreadyPresent) {
        issues.push({
          severity: sec.severity,
          category: sec.category,
          file: sec.file,
          line: sec.line,
          title: sec.title,
          description: sec.description,
          recommendation: sec.recommendation,
        });
      }
    }
  }

  const rawRisk = String(parsed?.riskLevel || '').toUpperCase();
  const riskLevel = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(rawRisk)
    ? rawRisk
    : issues.some((i) => i.severity === 'CRITICAL')
    ? 'CRITICAL'
    : issues.some((i) => i.severity === 'HIGH')
    ? 'HIGH'
    : issues.length > 2
    ? 'MEDIUM'
    : 'LOW';

  const score = typeof parsed?.score === 'number'
    ? Math.max(0, Math.min(100, Math.round(parsed.score)))
    : Math.max(0, Math.min(100, 100 - issues.filter((i) => i.severity === 'CRITICAL').length * 30 - issues.filter((i) => i.severity === 'HIGH').length * 15 - issues.length * 4));

  // Extract deduplicated security findings for PR overview
  const securityFindings = issues
    .filter((i) => ['Security', 'SQL Injection', 'XSS', 'Command Injection', 'Path Traversal', 'Hardcoded Secrets', 'API Key Exposure', 'Insecure Authorization', 'Insecure Authentication', 'Cloud Credentials', 'Database Credentials'].includes(i.category))
    .map((i) => ({
      severity: i.severity,
      category: i.category,
      title: i.title,
      file: i.file,
      line: i.line,
    }));

  return {
    summary: parsed?.summary || `AI review completed for PR #${pullRequest.number}. Analyzed ${files.length} changed file(s).`,
    riskLevel,
    score,
    issues,
    securityFindings,
  };
}

/**
 * Resilient static rule fallback for PR changes
 */
function runStaticPRFallback(pullRequest, files) {
  const issues = [];

  for (const file of files) {
    const patch = file.patch || '';
    const lines = patch.split('\n');

    lines.forEach((line, index) => {
      // Only inspect added lines
      if (!line.startsWith('+') || line.startsWith('+++')) return;
      const content = line.substring(1).trim();

      if (/(api[_-]?key|secret|password|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i.test(content)) {
        issues.push({
          severity: 'CRITICAL',
          category: 'Security',
          file: file.filename,
          line: index + 1,
          title: 'Potential Hardcoded Secret in PR Diff',
          description: 'A plain-text secret or API key appears to be committed in this pull request.',
          recommendation: 'Remove credentials immediately and use environment variables.',
        });
      }

      if (/\beval\s*\(/.test(content)) {
        issues.push({
          severity: 'HIGH',
          category: 'Security',
          file: file.filename,
          line: index + 1,
          title: 'Dangerous eval() Invocation Added',
          description: 'Executing dynamic code via eval() introduces remote code execution risks.',
          recommendation: 'Use structured parsing methods like JSON.parse() instead.',
        });
      }
    });
  }

  return {
    summary: `Static PR review completed for #${pullRequest.number}. Scanned ${files.length} changed file(s) for security and defect patterns.`,
    riskLevel: issues.some((i) => i.severity === 'CRITICAL') ? 'CRITICAL' : issues.length > 0 ? 'HIGH' : 'LOW',
    score: issues.length > 0 ? 70 : 95,
    issues,
  };
}

export const prReviewService = {
  /**
   * Fetches changed files for a pull request from GitHub API
   */
  async fetchPRFiles({ owner, repo, pullNumber, accessToken }) {
    const token = accessToken || config.github?.token || process.env.GITHUB_TOKEN || null;
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'AI-Code-Reviewer',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const url = `${config.github.apiBaseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to fetch PR files: ${response.status} ${errText.slice(0, 150)}`);
    }

    const allFiles = await response.json();

    // Filter candidate changed files
    const filtered = allFiles.filter((file) => {
      if (file.status === 'removed') return false;

      const pathSegments = file.filename.split('/');
      const fileName = pathSegments[pathSegments.length - 1];
      const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';

      if (pathSegments.some((seg) => IGNORED_DIRECTORIES.has(seg))) return false;
      if (IGNORED_FILENAMES.has(fileName)) return false;
      if (ext && BINARY_EXTENSIONS.has(ext)) return false;

      return true;
    });

    return filtered.slice(0, MAX_PR_FILES_LIMIT);
  },

  /**
   * Reviews pull request code changes using Google Gemini API
   */
  async reviewPullRequest({ repository, pullRequest, files }) {
    if (!files || files.length === 0) {
      return {
        summary: `No analyzable code changes found in PR #${pullRequest.number}.`,
        riskLevel: 'LOW',
        score: 100,
        issues: [],
      };
    }

    const apiKey = config.ai.geminiApiKey || process.env.GEMINI_API_KEY;
    const prompt = buildPRPrompt(repository, pullRequest, files);

    if (apiKey && apiKey.trim()) {
      const preferredModel = config.ai.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
      const fallbackList = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
      const candidateModels = modelRateLimiter.getCandidateModels(preferredModel, fallbackList);
      const primaryModel = candidateModels[0] || preferredModel;

      console.log(`[prReviewService] Reviewing PR #${pullRequest.number} using Gemini (${primaryModel})...`);

      // 1. Try with Google GenAI SDK
      try {
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        const res = await ai.models.generateContent({
          model: primaryModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        if (res && res.text) {
          console.log(`[prReviewService] Gemini SDK review generated successfully using ${primaryModel}.`);
          return normalizePROutput(res.text, pullRequest, files);
        }
      } catch (sdkErr) {
        if (sdkErr.message?.includes('429') || sdkErr.message?.includes('RESOURCE_EXHAUSTED')) {
          const delay = modelRateLimiter.extractRetryDelay(sdkErr.message);
          modelRateLimiter.markRateLimited(primaryModel, delay, '429 Quota Exhausted');
        }
        console.warn(`[prReviewService] SDK error on ${primaryModel}: ${sdkErr.message}. Trying candidate REST fallback...`);
      }

      // 2. Direct REST Fallback
      const restCandidates = modelRateLimiter.getCandidateModels(candidateModels[1] || 'gemini-3.1-flash-lite', fallbackList);
      for (const model of restCandidates) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                response_mime_type: 'application/json',
                temperature: 0.1,
              },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              console.log(`[prReviewService] Gemini REST review generated successfully using ${model}.`);
              return normalizePROutput(text, pullRequest, files);
            }
          } else {
            const errBody = await res.text();
            if (res.status === 429) {
              const delay = modelRateLimiter.extractRetryDelay(errBody);
              modelRateLimiter.markRateLimited(model, delay, '429 Quota Exhausted');
            }
            console.warn(`[prReviewService] Model ${model} returned HTTP ${res.status}`);
          }
        } catch (modelErr) {
          console.warn(`[prReviewService] Attempt for ${model} failed: ${modelErr.message}`);
        }
      }
    }

    // Static analysis fallback if Gemini unavailable
    console.log(`[prReviewService] Running static PR review fallback for PR #${pullRequest.number}.`);
    return runStaticPRFallback(pullRequest, files);
  },

  /**
   * Formats PR review into a developer-friendly markdown comment
   */
  formatPRReviewComment(reviewResult, pullRequest, commitSha) {
    const riskBadge =
      reviewResult.riskLevel === 'CRITICAL' ? '🔴 **CRITICAL RISK**' :
      reviewResult.riskLevel === 'HIGH' ? '🟠 **HIGH RISK**' :
      reviewResult.riskLevel === 'MEDIUM' ? '🟡 **MEDIUM RISK**' :
      '🟢 **LOW RISK**';

    let markdown = `## 🤖 AI Pull Request Review (Antigravity Code Reviewer)\n\n`;
    markdown += `**Overall Risk:** ${riskBadge} | **Health Score:** \`${reviewResult.score}/100\`\n`;
    markdown += `**Target Commit:** \`${commitSha ? commitSha.slice(0, 7) : 'HEAD'}\` | **Issues Found:** ${reviewResult.issues.length}\n\n`;
    markdown += `### 📋 Executive Summary\n${reviewResult.summary}\n\n`;

    if (reviewResult.securityFindings && reviewResult.securityFindings.length > 0) {
      markdown += `### 🛡️ Security Findings (${reviewResult.securityFindings.length})\n`;
      reviewResult.securityFindings.forEach((sec) => {
        markdown += `- **${sec.severity}** — ${sec.category} (\`${sec.file}:${sec.line}\`)\n`;
      });
      markdown += `\n`;
    }

    if (reviewResult.issues.length > 0) {
      markdown += `### ⚠️ Findings & Recommendations (${reviewResult.issues.length})\n\n`;
      reviewResult.issues.forEach((issue, idx) => {
        const icon =
          issue.severity === 'CRITICAL' ? '🔴' :
          issue.severity === 'HIGH' ? '🟠' :
          issue.severity === 'MEDIUM' ? '🟡' : '🔵';

        markdown += `${idx + 1}. ${icon} **[${issue.severity}] ${issue.category}**: \`${issue.file}${issue.line ? `:${issue.line}` : ''}\`\n`;
        markdown += `   - **Issue:** ${issue.title}\n`;
        markdown += `   - **Details:** ${issue.description}\n`;
        markdown += `   - **Recommendation:** ${issue.recommendation}\n\n`;
      });
    } else {
      markdown += `### ✅ Clean Code Changes\nNo critical security vulnerabilities or architectural bugs were detected in this pull request diff.\n\n`;
    }

    markdown += `---\n*Automated review conducted via Google Gemini AI & Antigravity IDE.*`;
    return markdown;
  },

  /**
   * Posts review comment to GitHub PR
   */
  async postPRComment({ owner, repo, pullNumber, markdownBody, accessToken }) {
    if (!accessToken) {
      console.log(`[prReviewService] No GitHub access token available; skipping remote PR comment creation.`);
      return null;
    }

    try {
      const url = `${config.github.apiBaseUrl}/repos/${owner}/${repo}/issues/${pullNumber}/comments`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Code-Reviewer',
        },
        body: JSON.stringify({ body: markdownBody }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[prReviewService] Failed to post comment on PR #${pullNumber}: ${response.status} ${errText.slice(0, 150)}`);
        return null;
      }

      const comment = await response.json();
      console.log(`✅ [prReviewService] Successfully posted review comment on PR #${pullNumber} (ID: ${comment.id}).`);
      return {
        commentId: comment.id,
        commentUrl: comment.html_url,
      };
    } catch (err) {
      console.warn(`[prReviewService] Error posting PR comment: ${err.message}`);
      return null;
    }
  },

  /**
   * Stores PR review in PostgreSQL database
   */
  async savePRReview({
    repositoryId,
    owner,
    repo,
    prNumber,
    prTitle,
    prAuthor,
    commitSha,
    action,
    riskLevel,
    score,
    summary,
    issues,
    commentId = null,
    commentUrl = null,
  }) {
    const query = `
      INSERT INTO pr_reviews (
        repository_id, owner, repo, pr_number, pr_title, pr_author,
        commit_sha, action, status, risk_level, score, summary,
        issues, comment_id, comment_url, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (repository_id, pr_number, commit_sha)
      DO UPDATE SET
        pr_title = EXCLUDED.pr_title,
        action = EXCLUDED.action,
        risk_level = EXCLUDED.risk_level,
        score = EXCLUDED.score,
        summary = EXCLUDED.summary,
        issues = EXCLUDED.issues,
        comment_id = COALESCE(EXCLUDED.comment_id, pr_reviews.comment_id),
        comment_url = COALESCE(EXCLUDED.comment_url, pr_reviews.comment_url),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const res = await db.query(query, [
      repositoryId.toLowerCase(),
      owner,
      repo,
      prNumber,
      prTitle,
      prAuthor,
      commitSha,
      action,
      riskLevel,
      score,
      summary,
      JSON.stringify(issues),
      commentId,
      commentUrl,
    ]);

    return res.rows[0];
  },

  /**
   * Retrieves existing review for a commit SHA if already performed
   */
  async getExistingReview(repositoryId, prNumber, commitSha) {
    const res = await db.query(
      `SELECT * FROM pr_reviews 
       WHERE repository_id = $1 AND pr_number = $2 AND commit_sha = $3`,
      [repositoryId.toLowerCase(), prNumber, commitSha]
    );
    return res.rows[0] || null;
  },

  /**
   * Lists PR reviews from database
   */
  async listPRReviews({ owner, repo, repositoryId, limit = 50 } = {}) {
    let query = `SELECT * FROM pr_reviews`;
    const params = [];

    if (repositoryId) {
      params.push(repositoryId.toLowerCase());
      query += ` WHERE repository_id = $${params.length}`;
    } else if (owner && repo) {
      params.push(owner.toLowerCase(), repo.toLowerCase());
      query += ` WHERE LOWER(owner) = $1 AND LOWER(repo) = $2`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1};`;
    params.push(limit);

    const res = await db.query(query, params);
    return res.rows;
  },

  /**
   * Get single PR review details
   */
  async getPRReviewDetails(owner, repo, prNumber) {
    const res = await db.query(
      `SELECT * FROM pr_reviews 
       WHERE LOWER(owner) = $1 AND LOWER(repo) = $2 AND pr_number = $3 
       ORDER BY created_at DESC LIMIT 1`,
      [owner.toLowerCase(), repo.toLowerCase(), Number(prNumber)]
    );
    return res.rows[0] || null;
  },
};

export default prReviewService;
