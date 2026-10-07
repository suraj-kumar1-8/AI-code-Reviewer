import { technicalDebtService } from '../services/technicalDebtService.js';
import { codeComplexityService } from '../services/codeComplexityService.js';
import { repoFileFetcher } from '../services/repoFileFetcher.js';

function sanitizeErrorMessage(msg = '') {
  if (!msg || typeof msg !== 'string') return 'An unexpected error occurred';
  return msg
    .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=***')
    .replace(/Bearer\s+[a-zA-Z0-9_\.\-]+/gi, 'Bearer ***')
    .replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://***:***@')
    .slice(0, 300);
}

export const technicalDebtController = {
  /**
   * POST /api/technical-debt/scan
   * Scans repository for technical debt and complexity indicators
   */
  async scan(req, res) {
    try {
      const { owner, repo, branch, force } = req.body;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Missing required parameters: "owner" and "repo" must be provided.',
        });
      }

      const accessToken = req.githubAccessToken || req.user?.accessToken;
      const scannedBy = req.user?.username || req.user?.login || 'developer';

      const result = await technicalDebtService.scanRepository({
        accessToken,
        owner: owner.trim(),
        repo: repo.trim(),
        branch: branch ? branch.trim() : undefined,
        force: Boolean(force),
        scannedBy,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[TechnicalDebtController.scan Error]:', sanitizeErrorMessage(raw));

      if (/404|not found/i.test(raw)) {
        return res.status(404).json({
          error: 'Repository not found',
          message: `Repository "${req.body?.owner}/${req.body?.repo}" was not found on GitHub.`,
        });
      }

      return res.status(500).json({
        error: 'Failed to scan repository technical debt',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * GET /api/technical-debt/:owner/:repo
   * Retrieves debt findings with optional filtering (severity, category, file)
   */
  async getFindings(req, res) {
    try {
      const { owner, repo } = req.params;
      const { severity, category, file } = req.query;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Missing required route parameters: "owner" and "repo".',
        });
      }

      const findings = await technicalDebtService.getFindings(owner.trim(), repo.trim(), {
        severity,
        category,
        file,
      });

      // Calculate stats
      const stats = {
        total: findings.length,
        critical: findings.filter((f) => f.severity === 'CRITICAL').length,
        high: findings.filter((f) => f.severity === 'HIGH').length,
        medium: findings.filter((f) => f.severity === 'MEDIUM').length,
        low: findings.filter((f) => f.severity === 'LOW').length,
        byCategory: {
          Complexity: findings.filter((f) => f.category === 'Complexity').length,
          Duplication: findings.filter((f) => f.category === 'Duplication').length,
          Maintainability: findings.filter((f) => f.category === 'Maintainability').length,
          Architecture: findings.filter((f) => f.category === 'Architecture').length,
          'Error Handling': findings.filter((f) => f.category === 'Error Handling').length,
          'Code Quality': findings.filter((f) => f.category === 'Code Quality').length,
        },
      };

      return res.status(200).json({
        success: true,
        repositoryId: `${owner.toLowerCase()}/${repo.toLowerCase()}`,
        owner,
        repo,
        stats,
        findings,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[TechnicalDebtController.getFindings Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to retrieve technical debt findings',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * GET /api/technical-debt/:owner/:repo/complexity
   * Retrieves deterministic code complexity analysis
   */
  async getComplexity(req, res) {
    try {
      const { owner, repo } = req.params;
      const { branch } = req.query;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Missing required route parameters: "owner" and "repo".',
        });
      }

      const accessToken = req.githubAccessToken || req.user?.accessToken;

      const { files } = await repoFileFetcher.fetchRepoSourceFiles({
        accessToken,
        owner: owner.trim(),
        repo: repo.trim(),
        branch: branch ? branch.trim() : undefined,
      });

      const complexity = codeComplexityService.analyzeRepositoryFiles(files);

      return res.status(200).json({
        success: true,
        repositoryId: `${owner.toLowerCase()}/${repo.toLowerCase()}`,
        owner,
        repo,
        complexity,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[TechnicalDebtController.getComplexity Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to compute code complexity',
        message: sanitizeErrorMessage(raw),
      });
    }
  },
};

export default technicalDebtController;
