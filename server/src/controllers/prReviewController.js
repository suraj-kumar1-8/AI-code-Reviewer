import { prReviewService } from '../services/prReviewService.js';
import { githubService } from '../services/githubService.js';
import { config } from '../config/index.js';

export const prReviewController = {
  /**
   * GET /api/reviews/pr
   * List all stored PR reviews
   */
  async listReviews(req, res) {
    try {
      const { owner, repo, repositoryId, limit } = req.query;

      const reviews = await prReviewService.listPRReviews({
        owner,
        repo,
        repositoryId,
        limit: Number(limit) || 50,
      });

      return res.status(200).json({
        count: reviews.length,
        reviews,
      });
    } catch (err) {
      console.error('[prReviewController.listReviews Error]:', err.message);
      return res.status(500).json({
        error: 'Failed to retrieve PR reviews',
        message: err.message,
      });
    }
  },

  /**
   * GET /api/reviews/pr/:owner/:repo/:prNumber
   * Retrieve single PR review details
   */
  async getReview(req, res) {
    try {
      const { owner, repo, prNumber } = req.params;

      if (!owner || !repo || !prNumber) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Parameters "owner", "repo", and "prNumber" are required.',
        });
      }

      const review = await prReviewService.getPRReviewDetails(owner, repo, prNumber);

      if (!review) {
        return res.status(404).json({
          error: 'Not Found',
          message: `No AI review found for ${owner}/${repo} PR #${prNumber}.`,
        });
      }

      return res.status(200).json({
        success: true,
        review,
      });
    } catch (err) {
      console.error('[prReviewController.getReview Error]:', err.message);
      return res.status(500).json({
        error: 'Failed to retrieve PR review',
        message: err.message,
      });
    }
  },

  /**
   * POST /api/reviews/pr/analyze
   * Direct/Manual trigger to review a GitHub PR without webhook delivery
   */
  async triggerReview(req, res) {
    try {
      const { owner, repo, prNumber, force = false } = req.body;

      if (!owner || !repo || !prNumber) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Both "owner", "repo", and "prNumber" are required.',
        });
      }

      const accessToken = req.githubAccessToken || config.github?.token || process.env.GITHUB_TOKEN || null;
      const repoKey = `${owner}/${repo}`.toLowerCase();

      // 1. Fetch remote PR metadata from GitHub
      const prUrl = `${config.github.apiBaseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;
      const headers = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Reviewer',
      };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const prRes = await fetch(prUrl, { headers });
      if (!prRes.ok) {
        const errText = await prRes.text();
        return res.status(prRes.status).json({
          error: 'GitHub API Error',
          message: `Failed to fetch PR #${prNumber}: ${errText.slice(0, 200)}`,
        });
      }

      const pullRequest = await prRes.json();
      const commitSha = pullRequest.head?.sha || 'HEAD';

      // 2. Check if already reviewed
      if (!force) {
        const existing = await prReviewService.getExistingReview(repoKey, prNumber, commitSha);
        if (existing) {
          return res.status(200).json({
            success: true,
            cached: true,
            review: existing,
          });
        }
      }

      // 3. Fetch changed files
      const changedFiles = await prReviewService.fetchPRFiles({
        owner,
        repo,
        pullNumber: prNumber,
        accessToken,
      });

      // 4. Run Gemini Review
      const reviewResult = await prReviewService.reviewPullRequest({
        repository: { owner, name: repo },
        pullRequest: {
          number: prNumber,
          title: pullRequest.title,
          author: pullRequest.user?.login || 'unknown',
          baseBranch: pullRequest.base?.ref || 'main',
          headBranch: pullRequest.head?.ref || 'feature',
          headSha: commitSha,
        },
        files: changedFiles,
      });

      // 5. Post comment if token available
      const commentMarkdown = prReviewService.formatPRReviewComment(
        reviewResult,
        pullRequest,
        commitSha
      );

      let commentInfo = null;
      if (accessToken) {
        commentInfo = await prReviewService.postPRComment({
          owner,
          repo,
          pullNumber: prNumber,
          markdownBody: commentMarkdown,
          accessToken,
        });
      }

      // 6. Save in database
      const saved = await prReviewService.savePRReview({
        repositoryId: repoKey,
        owner,
        repo,
        prNumber: Number(prNumber),
        prTitle: pullRequest.title,
        prAuthor: pullRequest.user?.login || 'unknown',
        commitSha,
        action: 'manual',
        riskLevel: reviewResult.riskLevel,
        score: reviewResult.score,
        summary: reviewResult.summary,
        issues: reviewResult.issues,
        commentId: commentInfo?.commentId || null,
        commentUrl: commentInfo?.commentUrl || null,
      });

      return res.status(200).json({
        success: true,
        cached: false,
        review: saved,
      });
    } catch (err) {
      console.error('[prReviewController.triggerReview Error]:', err.message);
      return res.status(500).json({
        error: 'Analysis Failed',
        message: err.message,
      });
    }
  },
};

export default prReviewController;
