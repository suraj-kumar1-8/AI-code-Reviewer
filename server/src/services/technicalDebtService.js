import crypto from 'crypto';
import db from '../db/index.js';
import { codeComplexityService } from './codeComplexityService.js';
import { repoFileFetcher } from './repoFileFetcher.js';
import { githubService } from './githubService.js';

export const DEBT_CATEGORIES = [
  'Complexity',
  'Duplication',
  'Maintainability',
  'Architecture',
  'Error Handling',
  'Code Quality',
];

export const EFFORT_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

function createFindingFingerprint(category, file, line, title) {
  const raw = `${category.toLowerCase()}:${file}:${line}:${title.toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export class TechnicalDebtService {
  /**
   * Scans a set of files for technical debt indicators
   */
  detectTechnicalDebtInFiles(files = []) {
    const findings = [];

    // Run complexity analysis first
    const complexityAnalysis = codeComplexityService.analyzeRepositoryFiles(files);

    // 1. Analyze files for size & nesting
    for (const fileReport of complexityAnalysis.fileReports) {
      const { path: filePath, totalLines, maxNestingDepth, functions } = fileReport;

      // Indicator: Very large file (> 350 lines)
      if (totalLines > 350) {
        findings.push({
          severity: totalLines > 700 ? 'HIGH' : 'MEDIUM',
          category: 'Maintainability',
          title: `Oversized File (${totalLines} lines)`,
          file: filePath,
          line: 1,
          description: `The file "${filePath}" spans ${totalLines} lines, exceeding the recommended limit of 300 lines for modular maintainability.`,
          impact: 'Large files increase cognitive load, create merge conflicts, and often violate the Single Responsibility Principle.',
          recommendation: 'Refactor this module into smaller, cohesive domain-focused components or helper utility files.',
          estimatedEffort: totalLines > 700 ? 'HIGH' : 'MEDIUM',
          codeSnippet: `// File length: ${totalLines} lines`,
        });
      }

      // Indicator: Excessive nesting depth (> 4 levels)
      if (maxNestingDepth >= 4) {
        findings.push({
          severity: maxNestingDepth >= 6 ? 'HIGH' : 'MEDIUM',
          category: 'Complexity',
          title: `Excessive Nesting Depth (Level ${maxNestingDepth})`,
          file: filePath,
          line: 1,
          description: `Code in "${filePath}" reaches a nesting depth of ${maxNestingDepth} levels deep.`,
          impact: 'Deeply nested blocks create high cyclomatic complexity, making branch coverage difficult and increasing the likelihood of regression bugs.',
          recommendation: 'Use early return guard clauses, invert conditionals, or extract inner logic into dedicated helper functions.',
          estimatedEffort: 'LOW',
          codeSnippet: `// Max nesting detected: ${maxNestingDepth} levels deep`,
        });
      }

      // 2. Analyze functions in the file
      for (const fn of functions) {
        // Indicator: Overly complex functions (cyclomatic complexity > 10)
        if (fn.cyclomaticComplexity > 10) {
          findings.push({
            severity: fn.cyclomaticComplexity > 18 ? 'CRITICAL' : 'HIGH',
            category: 'Complexity',
            title: `High Cyclomatic Complexity in "${fn.name}" (${fn.cyclomaticComplexity})`,
            file: filePath,
            line: fn.startLine,
            description: `Function "${fn.name}" has a cyclomatic complexity of ${fn.cyclomaticComplexity} with multiple decision branches.`,
            impact: 'Complex functions with excessive branching are difficult to test exhaustively and are frequent sources of edge-case bugs.',
            recommendation: 'Decompose the function using strategy patterns, lookup maps, or extract distinct sub-tasks into pure helper functions.',
            estimatedEffort: fn.cyclomaticComplexity > 18 ? 'HIGH' : 'MEDIUM',
            codeSnippet: `function ${fn.name}(${fn.parameters.join(', ')}) { ... }`,
          });
        }

        // Indicator: Very large function (> 50 lines)
        if (fn.linesCount > 50) {
          findings.push({
            severity: fn.linesCount > 100 ? 'HIGH' : 'MEDIUM',
            category: 'Maintainability',
            title: `Large Function "${fn.name}" (${fn.linesCount} lines)`,
            file: filePath,
            line: fn.startLine,
            description: `Function "${fn.name}" spans ${fn.linesCount} lines from line ${fn.startLine} to line ${fn.endLine}.`,
            impact: 'Long functions usually perform multiple responsibilities, increasing coupling and making unit testing cumbersome.',
            recommendation: 'Break down into smaller single-responsibility functions under 30 lines each.',
            estimatedEffort: 'MEDIUM',
            codeSnippet: `function ${fn.name}(...) /* ${fn.linesCount} lines */`,
          });
        }

        // Indicator: Long parameter list (> 4 params)
        if (fn.parameterCount >= 5) {
          findings.push({
            severity: 'LOW',
            category: 'Code Quality',
            title: `Long Parameter List in "${fn.name}" (${fn.parameterCount} arguments)`,
            file: filePath,
            line: fn.startLine,
            description: `Function takes ${fn.parameterCount} positional arguments: (${fn.parameters.join(', ')}).`,
            impact: 'Positional parameters are prone to argument order mismatches and make function signatures rigid.',
            recommendation: 'Consolidate multiple parameters into a single structured configuration object or options interface.',
            estimatedEffort: 'LOW',
            codeSnippet: `function ${fn.name}(${fn.parameters.join(', ')})`,
          });
        }
      }
    }

    // 3. Static line-by-line inspection for Error Handling, Duplication, Naming & Dead Code
    const seenBlockSignatures = new Map();

    for (const file of files) {
      if (!file || !file.content) continue;
      const lines = file.content.split('\n');

      // Detect missing error handling in async route handlers or DB calls
      let inAsyncFunction = false;
      let hasTryCatch = false;
      let asyncStartLine = 0;
      let asyncFnName = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNum = i + 1;

        // Missing error handling: async without try/catch
        if (/async\s+(?:function\s+([a-zA-Z0-9_$]+)|\(([a-zA-Z0-9_$,\s]*)\)\s*=>|([a-zA-Z0-9_$]+)\s*\()/.test(line)) {
          if (inAsyncFunction && !hasTryCatch && asyncFnName) {
            // previous async function had no try/catch
            findings.push({
              severity: 'HIGH',
              category: 'Error Handling',
              title: `Missing Error Handling in Async Handler "${asyncFnName}"`,
              file: file.path,
              line: asyncStartLine,
              description: `Async function "${asyncFnName}" lacks a try/catch block or error boundary. Unhandled promise rejections may crash the process.`,
              impact: 'Exceptions thrown during asynchronous execution will bypass normal error boundaries and could trigger 502/crash states.',
              recommendation: 'Wrap asynchronous operations with try/catch or delegate to an express-async-handler middleware.',
              estimatedEffort: 'LOW',
              codeSnippet: lines[asyncStartLine - 1]?.trim() || line,
            });
          }

          inAsyncFunction = true;
          hasTryCatch = false;
          asyncStartLine = lineNum;
          asyncFnName = line.match(/(?:function\s+|const\s+|async\s+)([a-zA-Z0-9_$]+)/)?.[1] || `handler_L${lineNum}`;
        }

        if (inAsyncFunction && line.includes('try {')) {
          hasTryCatch = true;
        }

        // Indicator: Poor / cryptic naming (single-letter variables in non-loop statements)
        if (/(?:const|let|var)\s+([a-z])\s*=\s*(?:await\s+)?(?:[a-zA-Z0-9_$.()]+\s*\(|{)/.test(line)) {
          const varName = line.match(/(?:const|let|var)\s+([a-z])\s*=/)?.[1];
          if (varName && !['i', 'j', 'k', 'e', '_'].includes(varName)) {
            findings.push({
              severity: 'LOW',
              category: 'Code Quality',
              title: `Cryptic Single-Letter Variable "${varName}"`,
              file: file.path,
              line: lineNum,
              description: `Variable "${varName}" lacks descriptive semantic context.`,
              impact: 'Obscure variable names impair code readability and hinder onboarding for new engineers.',
              recommendation: 'Rename to a descriptive name representing the entity or operation result.',
              estimatedEffort: 'LOW',
              codeSnippet: line,
            });
          }
        }

        // Indicator: Architectural Coupling: Raw DB calls inside Express routes
        if (
          file.path.includes('routes/') &&
          (/(?:pool\.query|db\.query|new Pool|mongoose\.model)\s*\(/.test(line))
        ) {
          findings.push({
            severity: 'HIGH',
            category: 'Architecture',
            title: 'Direct Database Access in Route Layer',
            file: file.path,
            line: lineNum,
            description: `Route file "${file.path}" directly invokes database queries instead of delegating to a dedicated controller or service layer.`,
            impact: 'Violates separation of concerns. Makes business logic impossible to unit test without database mocks, and introduces tight architectural coupling.',
            recommendation: 'Extract database operations into a dedicated service layer or repository pattern.',
            estimatedEffort: 'MEDIUM',
            codeSnippet: line,
          });
        }

        // Indicator: Suspicious Dead Code (commented-out blocks of executable code)
        if (
          line.startsWith('//') &&
          /(?:const|let|var|function|return|import|export|if\s*\(|await)\s+/.test(line.slice(2).trim()) &&
          !line.includes('eslint') && !line.includes('ts-ignore') && !line.includes('TODO')
        ) {
          // Check if followed by more commented code
          const nextLine = lines[i + 1]?.trim() || '';
          if (nextLine.startsWith('//') && /(?:const|let|var|function|return|import|export|if\s*\(|await)\s+/.test(nextLine.slice(2).trim())) {
            findings.push({
              severity: 'LOW',
              category: 'Maintainability',
              title: 'Commented-Out Dead Code Block',
              file: file.path,
              line: lineNum,
              description: `Commented-out code snippet detected at line ${lineNum}.`,
              impact: 'Commented code clutters the codebase, confuses maintainers about intended behavior, and is preserved in Git history anyway.',
              recommendation: 'Delete obsolete commented code. Git history retains past implementations if ever needed.',
              estimatedEffort: 'LOW',
              codeSnippet: `${line}\n${nextLine}`,
            });
            i++; // skip next line to avoid duplicating
          }
        }

        // Indicator: Duplicated code blocks (hashing 4-line blocks)
        if (i + 3 < lines.length) {
          const block = [lines[i], lines[i + 1], lines[i + 2], lines[i + 3]]
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('//') && !l.startsWith('/*'))
            .join('\n');

          if (block.length > 60 && !block.includes('import ') && !block.includes('export ')) {
            const blockHash = crypto.createHash('md5').update(block).digest('hex');
            if (seenBlockSignatures.has(blockHash)) {
              const previous = seenBlockSignatures.get(blockHash);
              if (previous.file !== file.path || Math.abs(previous.line - lineNum) > 10) {
                findings.push({
                  severity: 'MEDIUM',
                  category: 'Duplication',
                  title: 'Duplicate Logic Pattern Detected',
                  file: file.path,
                  line: lineNum,
                  description: `4-line code pattern matches identical block found in "${previous.file}" at line ${previous.line}.`,
                  impact: 'Duplicated logic requires multiple edits during bug fixes and feature updates, risking divergence.',
                  recommendation: 'Extract identical logic into a shared utility function or helper module.',
                  estimatedEffort: 'LOW',
                  codeSnippet: block.split('\n').slice(0, 3).join('\n'),
                });
              }
            } else {
              seenBlockSignatures.set(blockHash, { file: file.path, line: lineNum });
            }
          }
        }
      }
    }

    // Assign fingerprints & deduplicate
    const uniqueMap = new Map();
    for (const f of findings) {
      const fingerprint = createFindingFingerprint(f.category, f.file, f.line, f.title);
      if (!uniqueMap.has(fingerprint)) {
        uniqueMap.set(fingerprint, { ...f, fingerprint });
      }
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Scans a repository and persists findings
   */
  async scanRepository({ accessToken, owner, repo, branch, force = false, scannedBy = 'system' }) {
    const repoKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;

    // Get head commit SHA from GitHub if possible
    let commitSha = '';
    try {
      const branches = await githubService.getBranches(accessToken, owner, repo);
      const targetBranch = branch || branches[0]?.name || 'main';
      const branchInfo = branches.find(b => b.name === targetBranch);
      commitSha = branchInfo?.commit?.sha || '';
    } catch {
      // Continue without commit sha if network error
    }

    // Check cache if not forced
    if (!force && commitSha) {
      const cached = await db.query(
        `SELECT * FROM technical_debt_findings 
         WHERE owner = $1 AND repo = $2 AND commit_sha = $3 
         ORDER BY id ASC;`,
        [owner.toLowerCase(), repo.toLowerCase(), commitSha]
      );

      if (cached.rows.length > 0) {
        return {
          isCached: true,
          repositoryId: repoKey,
          owner,
          repo,
          commitSha,
          totalFindings: cached.rows.length,
          findings: cached.rows.map(this.mapDbRowToFinding),
        };
      }
    }

    // Fetch repository files
    const { files, targetBranch } = await repoFileFetcher.fetchRepoSourceFiles({
      accessToken,
      owner,
      repo,
      branch,
    });

    // Detect technical debt
    const findings = this.detectTechnicalDebtInFiles(files);

    // Complexity analysis metrics
    const complexityMetrics = codeComplexityService.analyzeRepositoryFiles(files);

    // Save to database
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Remove existing findings for this repo/commit if re-scanning
      await client.query(
        `DELETE FROM technical_debt_findings WHERE owner = $1 AND repo = $2 AND commit_sha = $3;`,
        [owner.toLowerCase(), repo.toLowerCase(), commitSha || '']
      );

      const insertQuery = `
        INSERT INTO technical_debt_findings (
          repository_id, owner, repo, commit_sha, severity, category,
          title, file, line, description, impact, recommendation,
          estimated_effort, code_snippet, fingerprint, scanned_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
        RETURNING id;
      `;

      for (const item of findings) {
        await client.query(insertQuery, [
          repoKey,
          owner.toLowerCase(),
          repo.toLowerCase(),
          commitSha || '',
          item.severity,
          item.category,
          item.title,
          item.file,
          item.line,
          item.description,
          item.impact,
          item.recommendation,
          item.estimatedEffort || 'MEDIUM',
          item.codeSnippet || '',
          item.fingerprint,
          scannedBy,
        ]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[TechnicalDebtService] DB transaction failed:', err.message);
      throw err;
    } finally {
      client.release();
    }

    return {
      isCached: false,
      repositoryId: repoKey,
      owner,
      repo,
      branch: targetBranch,
      commitSha,
      totalFindings: findings.length,
      complexityMetrics: {
        score: complexityMetrics.complexityScore,
        mostComplexFiles: complexityMetrics.mostComplexFiles,
        mostComplexFunctions: complexityMetrics.mostComplexFunctions,
      },
      findings,
    };
  }

  /**
   * Retrieves debt findings with filters
   */
  async getFindings(owner, repo, filters = {}) {
    const { severity, category, file } = filters;
    let query = `
      SELECT * FROM technical_debt_findings
      WHERE owner = $1 AND repo = $2
    `;
    const params = [owner.toLowerCase(), repo.toLowerCase()];

    if (severity && severity !== 'ALL') {
      params.push(severity.toUpperCase());
      query += ` AND severity = $${params.length}`;
    }

    if (category && category !== 'ALL') {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    if (file) {
      params.push(`%${file}%`);
      query += ` AND file ILIKE $${params.length}`;
    }

    query += ` ORDER BY CASE severity
      WHEN 'CRITICAL' THEN 1
      WHEN 'HIGH' THEN 2
      WHEN 'MEDIUM' THEN 3
      WHEN 'LOW' THEN 4
      ELSE 5 END, id ASC;`;

    const result = await db.query(query, params);
    return result.rows.map(this.mapDbRowToFinding);
  }

  mapDbRowToFinding(row) {
    return {
      id: row.id,
      repositoryId: row.repository_id,
      owner: row.owner,
      repo: row.repo,
      commitSha: row.commit_sha,
      severity: row.severity,
      category: row.category,
      title: row.title,
      file: row.file,
      line: row.line,
      description: row.description,
      impact: row.impact,
      recommendation: row.recommendation,
      estimatedEffort: row.estimated_effort,
      codeSnippet: row.code_snippet,
      fingerprint: row.fingerprint,
      scannedBy: row.scanned_by,
      createdAt: row.created_at,
    };
  }
}

export const technicalDebtService = new TechnicalDebtService();
export default technicalDebtService;
