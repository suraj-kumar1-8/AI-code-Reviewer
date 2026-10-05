import { githubService } from '../services/githubService.js';

export const repoController = {
  /**
   * Fetches repositories for the authenticated user
   */
  async getRepos(req, res) {
    try {
      const { sort = 'updated', type = 'all', per_page = 100 } = req.query;
      const repos = await githubService.getUserRepos(req.githubAccessToken, {
        sort,
        type,
        per_page: Number(per_page),
      });

      res.json({
        success: true,
        count: repos.length,
        repositories: repos,
      });
    } catch (err) {
      console.error('[repoController.getRepos] Error:', err.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch repositories from GitHub.',
        details: err.message,
      });
    }
  },

  /**
   * Fetches single repository details
   */
  async getRepo(req, res) {
    const { owner, repo } = req.params;

    try {
      const repository = await githubService.getRepoDetails(req.githubAccessToken, owner, repo);
      res.json({
        success: true,
        repository,
      });
    } catch (err) {
      console.error(`[repoController.getRepo] Error fetching ${owner}/${repo}:`, err.message);
      res.status(404).json({
        success: false,
        error: `Repository ${owner}/${repo} not found or inaccessible.`,
      });
    }
  },
};

export default repoController;
