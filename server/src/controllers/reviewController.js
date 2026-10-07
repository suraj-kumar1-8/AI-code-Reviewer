import { repoFileFetcher } from '../services/repoFileFetcher.js';
import { geminiService } from '../services/geminiService.js';
import { githubService } from '../services/githubService.js';

// In-memory review cache to avoid repeated expensive AI and API requests
const reviewCache = new Map();
// In-flight analysis deduplication map: cacheKey -> Promise<payload>
const inFlightAnalyses = new Map();

export const reviewController = {
  /**
   * POST /api/reviews/analyze
   * Analyzes repository source files using GitHub API + AI review service
   */
  async analyze(req, res, next) {
    try {
      let { owner, repo, branch, force = false } = req.body;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Both "owner" and "repo" parameters are required.',
        });
      }

      owner = String(owner).trim();
      repo = String(repo).trim();
      branch = branch ? String(branch).trim() : '';

      const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}:${branch || 'default'}`;

      // Return cached review if fresh (< 15 mins) and force is not requested
      if (!force && reviewCache.has(cacheKey)) {
        const cached = reviewCache.get(cacheKey);
        const ageMs = Date.now() - new Date(cached.timestamp).getTime();
        if (ageMs < 15 * 60 * 1000) {
          return res.json({
            success: true,
            cached: true,
            ...cached,
          });
        }
      }

      // Deduplicate simultaneous requests in flight
      if (!force && inFlightAnalyses.has(cacheKey)) {
        console.log(`[reviewController] Deduplicating in-flight analysis for ${cacheKey}...`);
        const payload = await inFlightAnalyses.get(cacheKey);
        return res.json({
          success: true,
          deduplicated: true,
          ...payload,
        });
      }

      const accessToken = req.githubAccessToken;

      if (!accessToken) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'GitHub access token missing. Please sign in via GitHub OAuth.',
        });
      }

      const runAnalysis = async () => {
        console.log(`[reviewController] Starting analysis for ${owner}/${repo} (branch: ${branch || 'default'})...`);

        // 1. Fetch repository source files
        const { repoDetails, files, targetBranch, totalFilesConsidered } =
          await repoFileFetcher.fetchRepoSourceFiles({
            accessToken,
            owner,
            repo,
            branch,
          });

        console.log(`[reviewController] Fetched ${files.length} code files out of ${totalFilesConsidered} total files.`);

        // 2. Run Gemini AI Code Review
        const reviewResult = await geminiService.analyzeCodebase({
          repository: repoDetails,
          files,
        });

        // 3. Cache and return response
        const payload = {
          summary: reviewResult.summary,
          score: reviewResult.score,
          stats: reviewResult.stats || { critical: 0, high: 0, medium: 0, low: 0 },
          metrics: reviewResult.metrics,
          issues: reviewResult.issues,
          analyzedFilesCount: reviewResult.analyzedFilesCount,
          sourceFiles: files.map((f) => ({
            path: f.path,
            language: f.language,
            content: f.content,
            lineCount: f.lineCount,
          })),
          repository: {
            id: repoDetails.id,
            owner: repoDetails.owner,
            name: repoDetails.name,
            full_name: repoDetails.full_name,
            default_branch: repoDetails.default_branch,
            targetBranch,
            html_url: repoDetails.html_url,
            stars: repoDetails.stars,
            forks: repoDetails.forks,
            language: repoDetails.language,
          },
          timestamp: new Date().toISOString(),
        };

        reviewCache.set(cacheKey, payload);
        return payload;
      };

      const analysisPromise = runAnalysis();
      inFlightAnalyses.set(cacheKey, analysisPromise);

      try {
        const payload = await analysisPromise;
        return res.json({
          success: true,
          ...payload,
        });
      } finally {
        inFlightAnalyses.delete(cacheKey);
      }
    } catch (err) {
      console.error('[reviewController.analyze Error]:', err);
      return res.status(500).json({
        error: 'Analysis Failed',
        message: err.message || 'An error occurred during repository analysis.',
      });
    }
  },

  /**
   * GET /api/reviews/:owner/:repo
   * Retrieves current or cached review for repository
   */
  async getReview(req, res, next) {
    try {
      const { owner, repo } = req.params;
      const { branch } = req.query;

      const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}:${branch || 'default'}`;

      if (reviewCache.has(cacheKey)) {
        return res.json({
          success: true,
          cached: true,
          ...reviewCache.get(cacheKey),
        });
      }

      // If not cached, trigger analysis
      req.body = { owner, repo, branch };
      return reviewController.analyze(req, res, next);
    } catch (err) {
      next(err);
    }
  },
};

export default reviewController;
