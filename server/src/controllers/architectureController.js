import { architectureService } from '../services/architectureService.js';

function sanitizeErrorMessage(msg = '') {
  if (!msg || typeof msg !== 'string') return 'An unexpected error occurred';
  return msg
    .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=***')
    .replace(/Bearer\s+[a-zA-Z0-9_\.\-]+/gi, 'Bearer ***')
    .replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://***:***@')
    .slice(0, 300);
}

export const architectureController = {
  /**
   * POST /api/architecture/analyze
   * Analyzes actual repository architecture, components, and risks
   */
  async analyze(req, res) {
    try {
      const { owner, repo, branch, force } = req.body;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Missing required parameters: "owner" and "repo" must be provided.',
        });
      }

      const accessToken = req.githubAccessToken || req.user?.accessToken;
      const scannedBy = req.user?.username || req.user?.login || 'developer';

      const result = await architectureService.analyzeRepository({
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
      console.error('[ArchitectureController.analyze Error]:', sanitizeErrorMessage(raw));

      if (/404|not found/i.test(raw)) {
        return res.status(404).json({
          error: 'Repository not found',
          message: `Repository "${req.body?.owner}/${req.body?.repo}" was not found on GitHub.`,
        });
      }

      if (/429|quota|RESOURCE_EXHAUSTED/i.test(raw)) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'AI quota/rate limit temporarily reached. Please retry in a few moments.',
        });
      }

      return res.status(500).json({
        error: 'Failed to analyze repository architecture',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * GET /api/architecture/:owner/:repo
   * Retrieves latest architecture scan for repository
   */
  async getScan(req, res) {
    try {
      const { owner, repo } = req.params;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Missing required route parameters: "owner" and "repo".',
        });
      }

      const scan = await architectureService.getLatestScan(owner.trim(), repo.trim());

      if (!scan) {
        return res.status(404).json({
          error: 'Architecture scan not found',
          message: `No architecture scan found for "${owner}/${repo}". Please run an analysis scan first.`,
          needsScan: true,
        });
      }

      return res.status(200).json({
        success: true,
        ...scan,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[ArchitectureController.getScan Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to retrieve architecture scan',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * GET /api/architecture/:owner/:repo/components
   * Retrieves detected components for repository
   */
  async getComponents(req, res) {
    try {
      const { owner, repo } = req.params;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Missing required route parameters: "owner" and "repo".',
        });
      }

      const components = await architectureService.getComponents(owner.trim(), repo.trim());

      return res.status(200).json({
        success: true,
        count: components.length,
        components,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[ArchitectureController.getComponents Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to retrieve architecture components',
        message: sanitizeErrorMessage(raw),
      });
    }
  },
};

export default architectureController;
