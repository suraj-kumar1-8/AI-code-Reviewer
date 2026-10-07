import { codebaseIndexer } from '../services/codebaseIndexer.js';
import { ragService } from '../services/ragService.js';
import { codebaseHealthService } from '../services/codebaseHealthService.js';
import { codeExplanationService } from '../services/codeExplanationService.js';
import { codebaseSearchService } from '../services/codebaseSearchService.js';

/**
 * Sanitizes error messages to prevent leaking API keys, tokens, or raw connection strings
 */
function sanitizeErrorMessage(msg = '') {
  if (!msg || typeof msg !== 'string') return 'An unexpected error occurred';
  return msg
    .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=***')
    .replace(/Bearer\s+[a-zA-Z0-9_\.\-]+/gi, 'Bearer ***')
    .replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://***:***@')
    .slice(0, 300);
}

export const codebaseController = {
  /**
   * POST /api/codebase/index
   * Index or re-index a repository into pgvector
   */
  async index(req, res) {
    try {
      const { owner, repo, branch, force } = req.body;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Missing required parameters: "owner" and "repo" must be provided.',
        });
      }

      // Access token from user session or authorization header if available
      const accessToken = req.githubAccessToken || req.user?.accessToken;

      const result = await codebaseIndexer.indexRepository({
        accessToken,
        owner: owner.trim(),
        repo: repo.trim(),
        branch: branch ? branch.trim() : undefined,
        force: Boolean(force),
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      const rawMessage = err.message || '';
      console.error('[CodebaseController.index Error]:', sanitizeErrorMessage(rawMessage));

      // 1. GitHub 404 / access denied
      if (/404|not found/i.test(rawMessage)) {
        return res.status(404).json({
          error: 'Repository not found',
          message: `Repository "${req.body?.owner}/${req.body?.repo}" was not found on GitHub. If this is a private repository, please ensure you are logged in with GitHub.`,
        });
      }

      // 2. Database connection issue
      if (/ECONNREFUSED|connect|pgvector|pool/i.test(rawMessage)) {
        return res.status(503).json({
          error: 'Database unavailable',
          message: 'PostgreSQL + pgvector connection is currently unavailable. Please verify the database container is running.',
        });
      }

      // 3. Gemini / AI rate limit
      if (/429|quota|RESOURCE_EXHAUSTED/i.test(rawMessage)) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'AI embedding quota/rate limit temporarily reached. Please retry in a few moments.',
        });
      }

      return res.status(500).json({
        error: 'Failed to index repository',
        message: sanitizeErrorMessage(rawMessage),
      });
    }
  },

  /**
   * POST /api/codebase/ask
   * Ask questions to indexed repository codebase
   */
  async ask(req, res) {
    try {
      const { repositoryId, repository, question, owner, repo } = req.body;

      if (!question || !question.trim()) {
        return res.status(400).json({
          error: 'Missing required parameter: "question" must be provided.',
        });
      }

      // Support repositoryId, repository ("owner/repo"), or separate owner & repo
      let targetRepoId = repositoryId || repository;
      if (!targetRepoId && owner && repo) {
        targetRepoId = `${owner.trim().toLowerCase()}/${repo.trim().toLowerCase()}`;
      }

      if (!targetRepoId) {
        return res.status(400).json({
          error: 'Either "repositoryId" (e.g. "owner/repo") or both "owner" and "repo" must be provided.',
        });
      }

      const result = await ragService.ask({
        repositoryId: targetRepoId.toLowerCase(),
        question: question.trim(),
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      const rawMessage = err.message || '';
      console.error('[CodebaseController.ask Error]:', sanitizeErrorMessage(rawMessage));

      // Handle not-indexed case
      if (rawMessage.includes('not indexed')) {
        return res.status(404).json({
          error: 'Repository not indexed',
          message: rawMessage,
          needsIndexing: true,
        });
      }

      // Database connection issue
      if (/ECONNREFUSED|connect|pgvector|pool/i.test(rawMessage)) {
        return res.status(503).json({
          error: 'Database unavailable',
          message: 'PostgreSQL + pgvector connection is currently unavailable. Please verify the database container is running.',
        });
      }

      // Rate limit
      if (/429|quota|RESOURCE_EXHAUSTED/i.test(rawMessage)) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'AI quota/rate limit temporarily reached. Please wait a moment and try again.',
        });
      }

      return res.status(500).json({
        error: 'Failed to process question',
        message: sanitizeErrorMessage(rawMessage),
      });
    }
  },

  /**
   * GET /api/codebase/status
   * Check if repository is indexed
   */
  async getStatus(req, res) {
    try {
      const { owner, repo, repositoryId } = req.query;

      let targetId = repositoryId;
      if (!targetId && owner && repo) {
        targetId = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
      }

      if (!targetId) {
        return res.status(400).json({
          error: 'Either "repositoryId" or "owner" and "repo" query parameters are required.',
        });
      }

      const status = await codebaseIndexer.getStatus(targetId);
      return res.status(200).json(status);
    } catch (err) {
      const rawMessage = err.message || '';
      console.error('[CodebaseController.getStatus Error]:', sanitizeErrorMessage(rawMessage));

      if (/ECONNREFUSED|connect/i.test(rawMessage)) {
        return res.status(200).json({
          isIndexed: false,
          repositoryId: req.query?.repositoryId,
          dbOnline: false,
        });
      }

      return res.status(500).json({
        error: 'Failed to fetch repository status',
        message: sanitizeErrorMessage(rawMessage),
      });
    }
  },

  /**
   * GET /api/codebase/repositories
   * List all indexed repositories
   */
  async getRepositories(req, res) {
    try {
      const repos = await codebaseIndexer.listIndexedRepositories();
      return res.status(200).json({
        count: repos.length,
        repositories: repos,
      });
    } catch (err) {
      const rawMessage = err.message || '';
      console.error('[CodebaseController.getRepositories Error]:', sanitizeErrorMessage(rawMessage));

      // If DB is offline, return empty list gracefully so the frontend page renders cleanly
      if (/ECONNREFUSED|connect/i.test(rawMessage)) {
        return res.status(200).json({
          count: 0,
          repositories: [],
          dbOnline: false,
          warning: 'Database is currently offline. Start pgvector container to view indexed repositories.',
        });
      }

      return res.status(500).json({
        error: 'Failed to list indexed repositories',
        message: sanitizeErrorMessage(rawMessage),
      });
    }
  },

  /**
   * GET /api/codebase/health/:owner/:repo
   * Computes or retrieves deterministic codebase health scores and historical trends
   */
  async getHealth(req, res) {
    try {
      const { owner, repo } = req.params;
      const { branch, force } = req.query;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Missing required parameters: "owner" and "repo" must be provided.',
        });
      }

      const accessToken = req.githubAccessToken || req.user?.accessToken;
      const scannedBy = req.user?.username || req.user?.login || 'developer';

      const result = await codebaseHealthService.computeHealthScores({
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
      console.error('[CodebaseController.getHealth Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to compute codebase health scores',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * POST /api/codebase/explain
   * Explains a specific file, function, or code block grounded in repository context
   */
  async explain(req, res) {
    try {
      const { repositoryId, filePath, codeSnippet, functionName, owner, repo } = req.body;

      if (!filePath && !functionName && !codeSnippet) {
        return res.status(400).json({
          error: 'At least one of "filePath", "functionName", or "codeSnippet" must be provided.',
        });
      }

      const result = await codeExplanationService.explainCode({
        repositoryId,
        filePath,
        codeSnippet,
        functionName,
        owner,
        repo,
      });

      return res.status(200).json(result);
    } catch (err) {
      const raw = err.message || '';
      console.error('[CodebaseController.explain Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to explain code',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * GET /api/codebase/search & POST /api/codebase/search
   * Powerful search across filenames, functions, classes, APIs, symbols, and keywords
   */
  async search(req, res) {
    try {
      const repositoryId = req.query.repositoryId || req.body.repositoryId || (req.query.owner && req.query.repo ? `${req.query.owner}/${req.query.repo}` : null);
      const query = req.query.q || req.query.query || req.body.query || req.body.q;
      const type = req.query.type || req.body.type || 'all';
      const limit = parseInt(req.query.limit || req.body.limit || '25', 10);

      if (!query || !query.trim()) {
        return res.status(400).json({
          error: 'Search query parameter is required.',
        });
      }

      if (!repositoryId) {
        return res.status(400).json({
          error: 'repositoryId parameter is required (e.g. "owner/repo").',
        });
      }

      const result = await codebaseSearchService.search({
        repositoryId,
        query: query.trim(),
        type,
        limit,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[CodebaseController.search Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to search codebase',
        message: sanitizeErrorMessage(raw),
      });
    }
  },
};

export default codebaseController;
