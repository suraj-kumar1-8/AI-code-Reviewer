import { securityScannerService } from '../services/securityScannerService.js';
import { fixSuggestionService } from '../services/fixSuggestionService.js';
import { repoFileFetcher } from '../services/repoFileFetcher.js';
import db from '../db/index.js';

export const securityController = {
  /**
   * POST /api/security/scan
   * Runs or caches a security scan on a repository
   */
  async scanRepository(req, res) {
    try {
      const { owner, repo, branch = 'main', commitSha, prNumber, force = false, files: directFiles } = req.body;

      if (!owner || !repo) {
        return res.status(400).json({
          success: false,
          error: 'Parameters "owner" and "repo" are required.',
        });
      }

      // Check for valid repository identifier format to prevent injection
      if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid repository owner or name format.',
        });
      }

      const scannedBy = req.user?.login || 'guest';
      const accessToken = req.githubAccessToken || req.session?.githubAccessToken;

      let filesToScan = [];
      let headSha = commitSha || null;

      // If files provided directly (even if empty array for empty repo test)
      if (Array.isArray(directFiles)) {
        filesToScan = directFiles;
      } else {
        try {
          const fetchResult = await repoFileFetcher.fetchRepositorySourceFiles({
            owner,
            repo,
            branch,
            accessToken,
          });
          filesToScan = fetchResult.files || [];
          if (!headSha && fetchResult.repoDetails?.head_commit_sha) {
            headSha = fetchResult.repoDetails.head_commit_sha;
          }
        } catch (fetchErr) {
          console.warn(`[securityController] GitHub file fetch failed for ${owner}/${repo}: ${fetchErr.message}`);
          return res.status(400).json({
            success: false,
            error: `Failed to fetch repository files from GitHub: ${fetchErr.message}`,
          });
        }
      }

      const scanResult = await securityScannerService.runScan({
        repository: { owner, name: repo, default_branch: branch, head_commit_sha: headSha },
        files: filesToScan,
        commitSha: headSha || 'HEAD',
        prNumber: prNumber ? Number(prNumber) : null,
        scannedBy,
        force: Boolean(force),
      });

      return res.status(200).json({
        success: true,
        scan: scanResult,
      });
    } catch (err) {
      console.error('[securityController.scanRepository Error]:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Internal server error while executing security scan.',
      });
    }
  },

  /**
   * GET /api/security/:owner/:repo
   * Retrieves latest security scan for repository
   */
  async getLatestScan(req, res) {
    try {
      const { owner, repo } = req.params;

      if (!owner || !repo) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: owner and repo.',
        });
      }

      const scan = await securityScannerService.getLatestScan(owner, repo);

      if (!scan) {
        return res.status(200).json({
          success: true,
          scan: null,
          message: `No security scans found for ${owner}/${repo}. Run a scan to evaluate code health.`,
        });
      }

      return res.status(200).json({
        success: true,
        scan,
      });
    } catch (err) {
      console.error('[securityController.getLatestScan Error]:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to fetch latest security scan.',
      });
    }
  },

  /**
   * GET /api/security/:owner/:repo/findings
   * Retrieves findings for a repository with optional filters
   */
  async getFindings(req, res) {
    try {
      const { owner, repo } = req.params;
      const { severity, category, file, search, scanId } = req.query;

      let targetScanId = scanId ? Number(scanId) : null;

      if (!targetScanId) {
        const latest = await db.query(
          `SELECT id FROM security_scans WHERE owner = $1 AND repo = $2 ORDER BY created_at DESC LIMIT 1`,
          [owner, repo]
        );
        if (latest.rows.length === 0) {
          return res.status(200).json({
            success: true,
            count: 0,
            findings: [],
            scan: null,
          });
        }
        targetScanId = latest.rows[0].id;
      }

      let queryText = `
        SELECT f.*, 
               s.explanation as fix_explanation, s.recommended_fix, s.before_code, s.after_code, s.diff as fix_diff, s.model as fix_model
        FROM security_findings f
        LEFT JOIN fix_suggestions s ON f.id = s.finding_id
        WHERE f.scan_id = $1
      `;
      const queryParams = [targetScanId];

      if (severity && severity !== 'ALL') {
        queryParams.push(severity.toUpperCase());
        queryText += ` AND f.severity = $${queryParams.length}`;
      }

      if (category && category !== 'ALL') {
        queryParams.push(category);
        queryText += ` AND f.category = $${queryParams.length}`;
      }

      if (file) {
        queryParams.push(`%${file}%`);
        queryText += ` AND f.file ILIKE $${queryParams.length}`;
      }

      if (search) {
        queryParams.push(`%${search}%`);
        queryText += ` AND (f.title ILIKE $${queryParams.length} OR f.description ILIKE $${queryParams.length} OR f.code_snippet ILIKE $${queryParams.length})`;
      }

      queryText += `
        ORDER BY 
          CASE f.severity 
            WHEN 'CRITICAL' THEN 1 
            WHEN 'HIGH' THEN 2 
            WHEN 'MEDIUM' THEN 3 
            WHEN 'LOW' THEN 4 
            ELSE 5 
          END ASC, f.id ASC
      `;

      const findingsRes = await db.query(queryText, queryParams);

      const findings = findingsRes.rows.map((r) => ({
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
          model: r.fix_model,
        } : null,
      }));

      return res.status(200).json({
        success: true,
        scanId: targetScanId,
        count: findings.length,
        findings,
      });
    } catch (err) {
      console.error('[securityController.getFindings Error]:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to fetch security findings.',
      });
    }
  },

  /**
   * POST /api/security/findings/:findingId/fix
   * Generates or retrieves AI fix suggestion for a finding
   */
  async generateFix(req, res) {
    try {
      const { findingId } = req.params;

      if (!findingId || isNaN(Number(findingId))) {
        return res.status(400).json({
          success: false,
          error: 'Valid finding ID is required.',
        });
      }

      const fix = await fixSuggestionService.generateFixForFinding(Number(findingId));

      return res.status(200).json({
        success: true,
        fix,
      });
    } catch (err) {
      console.error('[securityController.generateFix Error]:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to generate AI fix for finding.',
      });
    }
  },
};

export default securityController;
