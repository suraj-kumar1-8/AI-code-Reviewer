import { prReviewService } from '../services/prReviewService.js';
import { settingsService } from '../services/settingsService.js';

// In-flight webhook deduplication map: key -> Promise<result>
const inFlightPRReviews = new Map();

export const webhookController = {
  /**
   * POST /api/webhooks/github
   * Receives and processes GitHub Webhooks (specifically pull_request events)
   */
  async handleGithubWebhook(req, res) {
    const event = req.headers['x-github-event'];
    const deliveryId = req.headers['x-github-delivery'];

    console.log(`[Webhook] Received GitHub event "${event}" (Delivery ID: ${deliveryId || 'unknown'})`);

    // We only process pull_request events
    if (event !== 'pull_request') {
      return res.status(200).json({
        ignored: true,
        reason: `Event type "${event}" ignored. Only "pull_request" events are analyzed.`,
      });
    }

    const { action, pull_request, repository, sender } = req.body || {};

    if (!pull_request || !repository) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Malformed pull_request webhook payload.',
      });
    }

    // Only process actions where code was added or modified
    const eligibleActions = new Set(['opened', 'synchronize', 'reopened']);
    if (!eligibleActions.has(action)) {
      return res.status(200).json({
        ignored: true,
        action,
        reason: `Pull request action "${action}" ignored. Only opened, synchronize, and reopened actions are processed.`,
      });
    }

    // Check user/repository PR review settings
    const repoOwner = (repository.owner?.login || repository.owner?.name || 'default_user').toLowerCase();
    const { settings: currentSettings } = await settingsService.getSettings(repoOwner);
    const prConfig = currentSettings.prReview || {};

    if (prConfig.autoReview === false) {
      console.log(`[Webhook] Automatic PR review is disabled in settings. Skipping PR #${pull_request.number}.`);
      return res.status(200).json({
        ignored: true,
        action,
        reason: 'Automatic PR review is disabled in settings.',
      });
    }

    if (action === 'opened' && prConfig.reviewOpened === false) {
      console.log(`[Webhook] Review for opened PRs is disabled in settings. Skipping PR #${pull_request.number}.`);
      return res.status(200).json({
        ignored: true,
        action,
        reason: 'Review for opened PRs is disabled in settings.',
      });
    }

    if (action === 'synchronize' && prConfig.reviewSynchronize === false) {
      console.log(`[Webhook] Review for updated/synchronized PRs is disabled in settings. Skipping PR #${pull_request.number}.`);
      return res.status(200).json({
        ignored: true,
        action,
        reason: 'Review for updated/synchronized PRs is disabled in settings.',
      });
    }

    if (action === 'reopened' && prConfig.reviewReopened === false) {
      console.log(`[Webhook] Review for reopened PRs is disabled in settings. Skipping PR #${pull_request.number}.`);
      return res.status(200).json({
        ignored: true,
        action,
        reason: 'Review for reopened PRs is disabled in settings.',
      });
    }

    const owner = repository.owner?.login || repository.owner?.name;
    const repo = repository.name;
    const prNumber = pull_request.number;
    const commitSha = pull_request.head?.sha;
    const repoKey = `${owner}/${repo}`.toLowerCase();
    const dedupeKey = `${repoKey}:${prNumber}:${commitSha}`;

    if (!owner || !repo || !prNumber || !commitSha) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing essential PR metadata (owner, repo, number, or head SHA).',
      });
    }

    console.log(`[Webhook] Processing PR #${prNumber} ("${pull_request.title}") on ${owner}/${repo} (action=${action}, commit=${commitSha.slice(0, 7)})`);

    // 1. Check if an analysis for this exact commit is already in flight
    if (inFlightPRReviews.has(dedupeKey)) {
      console.log(`[Webhook] Reusing in-flight analysis for ${dedupeKey}`);
      const existingPromise = inFlightPRReviews.get(dedupeKey);
      const result = await existingPromise;
      return res.status(200).json({
        success: true,
        deduplicated: true,
        ...result,
      });
    }

    // 2. Check if this commit SHA has already been reviewed in database
    try {
      const existingReview = await prReviewService.getExistingReview(repoKey, prNumber, commitSha);
      if (existingReview) {
        console.log(`[Webhook] Commit ${commitSha.slice(0, 7)} for PR #${prNumber} already reviewed. Returning cached result.`);
        return res.status(200).json({
          success: true,
          cached: true,
          message: 'Review already exists for this commit SHA.',
          reviewId: existingReview.id,
          riskLevel: existingReview.risk_level,
          score: existingReview.score,
        });
      }
    } catch (checkErr) {
      console.warn(`[Webhook Warning] Database check error: ${checkErr.message}`);
    }

    // 3. Execute PR review flow with deduplication wrapper
    const processReview = async () => {
      // Access token if provided in webhook or user session
      const accessToken = req.githubAccessToken || process.env.GITHUB_TOKEN || null;

      // A. Fetch changed files and diffs
      console.log(`[Webhook] Fetching changed files for PR #${prNumber}...`);
      const changedFiles = await prReviewService.fetchPRFiles({
        owner,
        repo,
        pullNumber: prNumber,
        accessToken,
      });

      console.log(`[Webhook] Found ${changedFiles.length} code file(s) changed in PR #${prNumber}.`);

      // B. Analyze with Gemini AI
      const reviewResult = await prReviewService.reviewPullRequest({
        repository: { owner, name: repo },
        pullRequest: {
          number: prNumber,
          title: pull_request.title,
          author: pull_request.user?.login || sender?.login || 'unknown',
          baseBranch: pull_request.base?.ref || 'main',
          headBranch: pull_request.head?.ref || 'feature',
          headSha: commitSha,
        },
        files: changedFiles,
      });

      // C. Format and post GitHub comment if access token available
      const commentMarkdown = prReviewService.formatPRReviewComment(
        reviewResult,
        pull_request,
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

      // D. Save review result in PostgreSQL
      const savedReview = await prReviewService.savePRReview({
        repositoryId: repoKey,
        owner,
        repo,
        prNumber,
        prTitle: pull_request.title || `PR #${prNumber}`,
        prAuthor: pull_request.user?.login || sender?.login || 'unknown',
        commitSha,
        action,
        riskLevel: reviewResult.riskLevel,
        score: reviewResult.score,
        summary: reviewResult.summary,
        issues: reviewResult.issues,
        commentId: commentInfo?.commentId || null,
        commentUrl: commentInfo?.commentUrl || null,
      });

      return {
        reviewId: savedReview.id,
        repository: repoKey,
        prNumber,
        commitSha,
        riskLevel: savedReview.risk_level,
        score: savedReview.score,
        issuesCount: reviewResult.issues.length,
        summary: savedReview.summary,
        commentPosted: Boolean(commentInfo),
      };
    };

    const reviewPromise = processReview();
    inFlightPRReviews.set(dedupeKey, reviewPromise);

    try {
      const outcome = await reviewPromise;
      return res.status(200).json({
        success: true,
        ...outcome,
      });
    } catch (err) {
      console.error(`[Webhook Error] Processing PR #${prNumber} failed:`, err.message);
      return res.status(500).json({
        error: 'PR Review Failed',
        message: err.message,
      });
    } finally {
      inFlightPRReviews.delete(dedupeKey);
    }
  },
};

export default webhookController;
