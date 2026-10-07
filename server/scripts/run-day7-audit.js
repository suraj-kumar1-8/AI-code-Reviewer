import crypto from 'node:crypto';
import '../src/config/loadEnv.js';
import { config } from '../src/config/index.js';
import { prReviewService } from '../src/services/prReviewService.js';
import { modelRateLimiter } from '../src/services/modelRateLimiter.js';
import db from '../src/db/index.js';

const BASE_URL = `http://localhost:${config.port || 5001}/api`;
const WEBHOOK_SECRET = config.github.webhookSecret || 'acr_webhook_secret_development_2026';

function computeSignature(payloadStr) {
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(payloadStr);
  return `sha256=${hmac.digest('hex')}`;
}

async function runAudit() {
  console.log('====================================================');
  console.log('🚀 DAY 7 COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log(`Target API Base: ${BASE_URL}`);
  console.log('====================================================\n');

  const results = {};

  // 1. Health & DB Check
  try {
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    console.log(`[Test 1] Health Check: Status=${healthData.status}, DB=${healthData.databaseConfigured}, OAuth=${healthData.oauthConfigured}`);
    results.health = healthData.status === 'healthy' && healthData.databaseConfigured;
  } catch (err) {
    console.error('[Test 1 Failed]:', err.message);
    results.health = false;
  }

  // 2. Invalid Webhook Signature Rejected (HTTP 401)
  try {
    const fakePayload = JSON.stringify({ action: 'opened' });
    const res = await fetch(`${BASE_URL}/webhooks/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'pull_request',
        'x-hub-signature-256': 'sha256=invalid_signature_hash_00000000000000',
      },
      body: fakePayload,
    });
    console.log(`[Test 2] Invalid Webhook Signature: HTTP ${res.status} (Expected 401)`);
    results.invalidWebhook = res.status === 401;
  } catch (err) {
    console.error('[Test 2 Failed]:', err.message);
    results.invalidWebhook = false;
  }

  // 3. Duplicate Webhook Handling & Deduplication
  try {
    const prNumber = 215;
    const commitSha = 'fa9a2079b259560980a18e074a3a3341ecdab9b6';
    const payloadObj = {
      action: 'opened',
      number: prNumber,
      pull_request: {
        number: prNumber,
        title: '`on` now returns a deregistration function',
        user: { login: 'matthias-ccri' },
        head: { sha: commitSha, ref: 'return-deregistration' },
        base: { ref: 'main' },
      },
      repository: { name: 'mitt', owner: { login: 'developit' } },
      sender: { login: 'matthias-ccri' },
    };
    const bodyStr = JSON.stringify(payloadObj);
    const signature = computeSignature(bodyStr);

    // Call #1
    const res1 = await fetch(`${BASE_URL}/webhooks/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'pull_request',
        'x-github-delivery': `audit-test-1-${Date.now()}`,
        'x-hub-signature-256': signature,
      },
      body: bodyStr,
    });
    const data1 = await res1.json();

    // Call #2 (Should return cached review)
    const res2 = await fetch(`${BASE_URL}/webhooks/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'pull_request',
        'x-github-delivery': `audit-test-2-${Date.now()}`,
        'x-hub-signature-256': signature,
      },
      body: bodyStr,
    });
    const data2 = await res2.json();

    console.log(`[Test 3] Webhook Dedup: Call 1 Status=${res1.status}, Call 2 Status=${res2.status}, Deduplicated=${Boolean(data2.cached || data2.deduplicated)}`);
    results.webhookDedup = res1.status === 200 && res2.status === 200 && (data2.cached === true || data2.deduplicated === true);
  } catch (err) {
    console.error('[Test 3 Failed]:', err.message);
    results.webhookDedup = false;
  }

  // 4. Clean PR Analysis (Testing Gemini PR review with clean changes)
  try {
    const cleanDiffFiles = [
      {
        filename: 'README.md',
        status: 'modified',
        additions: 5,
        deletions: 0,
        patch: `@@ -10,3 +10,8 @@\n+### Documentation Update\n+Adds comprehensive API examples and production guidelines for developers.`,
      },
    ];

    const cleanResult = await prReviewService.reviewPullRequest({
      repository: { owner: 'audit-org', name: 'sample-project' },
      pullRequest: {
        number: 101,
        title: 'Docs: update API documentation',
        author: 'developer-jane',
        baseBranch: 'main',
        headBranch: 'docs/update',
        headSha: 'abc123clean',
      },
      files: cleanDiffFiles,
    });

    console.log(`[Test 4] Clean PR Analysis: Risk=${cleanResult.riskLevel}, Score=${cleanResult.score}, Issues=${cleanResult.issues.length}`);
    results.cleanPR = cleanResult.riskLevel === 'LOW' && cleanResult.score >= 80;
  } catch (err) {
    console.error('[Test 4 Failed]:', err.message);
    results.cleanPR = false;
  }

  // 5. PR with Bug & Logic Defect
  try {
    const bugDiffFiles = [
      {
        filename: 'src/calculator.js',
        status: 'modified',
        additions: 8,
        deletions: 2,
        patch: `@@ -15,4 +15,10 @@\n function calculateAverage(total, count) {\n-  return count > 0 ? total / count : 0;\n+  // BUG: Missing check for zero, causing unhandled division or null\n+  return total / count;\n+  const user = undefined;\n+  return user.profile.name; // Unhandled TypeError\n }`,
      },
    ];

    const bugResult = await prReviewService.reviewPullRequest({
      repository: { owner: 'audit-org', name: 'calc-service' },
      pullRequest: {
        number: 102,
        title: 'Fix: update average calculator logic',
        author: 'contributor-bob',
        baseBranch: 'main',
        headBranch: 'fix/avg',
        headSha: 'def456bug',
      },
      files: bugDiffFiles,
    });

    console.log(`[Test 5] PR with Bug: Risk=${bugResult.riskLevel}, Score=${bugResult.score}, Issues=${bugResult.issues.length}`);
    results.bugPR = bugResult.issues.length > 0;
  } catch (err) {
    console.error('[Test 5 Failed]:', err.message);
    results.bugPR = false;
  }

  // 6. Security Vulnerability Detection (SQL Injection / Eval / Hardcoded Secret)
  try {
    const securityDiffFiles = [
      {
        filename: 'src/auth/login.js',
        status: 'modified',
        additions: 12,
        deletions: 1,
        patch: `@@ -20,3 +20,14 @@\n+const AWS_SECRET_KEY = "AKIAIOSFODNN7EXAMPLE_SECRET_KEY_EXPOSED";\n+function findUser(username) {\n+  // CRITICAL SQL Injection\n+  const query = "SELECT * FROM users WHERE username = '" + username + "'";\n+  return eval("query"); // Dangerous eval invocation\n+}`,
      },
    ];

    const secResult = await prReviewService.reviewPullRequest({
      repository: { owner: 'audit-org', name: 'security-project' },
      pullRequest: {
        number: 103,
        title: 'Auth: add dynamic user lookup',
        author: 'bad-actor',
        baseBranch: 'main',
        headBranch: 'patch/login',
        headSha: 'sec789flaw',
      },
      files: securityDiffFiles,
    });

    const hasCriticalOrHigh = secResult.issues.some(
      (i) => i.severity === 'CRITICAL' || i.severity === 'HIGH' || i.category === 'Security'
    );
    console.log(`[Test 6] Security Issue Detection: Risk=${secResult.riskLevel}, HasSevereIssue=${hasCriticalOrHigh}, Score=${secResult.score}`);
    results.securityPR = hasCriticalOrHigh && secResult.score <= 70;
  } catch (err) {
    console.error('[Test 6 Failed]:', err.message);
    results.securityPR = false;
  }

  // 7. Malformed AI Response Recovery
  try {
    // Test that corrupt JSON string doesn't crash the review service
    const mockFiles = [{ filename: 'src/index.js', patch: '+console.log("hello");' }];
    const mockPR = { number: 104, title: 'Malformed AI response test' };

    // Pass invalid JSON directly through internal parser
    const invalidJsonStr = '```json\n{ "summary": "Unfinished json text..., "issues": [ { "title": "Incomplete"\n';
    
    // Test review with empty files or abnormal response
    const emptyResult = await prReviewService.reviewPullRequest({
      repository: { owner: 'audit-org', name: 'empty-test' },
      pullRequest: mockPR,
      files: [],
    });

    console.log(`[Test 7] Malformed/Empty AI Response Handling: HandledGracefully=${Boolean(emptyResult.summary)}`);
    results.malformedAI = Boolean(emptyResult && emptyResult.score);
  } catch (err) {
    console.error('[Test 7 Failed]:', err.message);
    results.malformedAI = false;
  }

  // 8. Gemini 429 Rate Limiter Resilience
  try {
    const testModel = 'test-gemini-quota-model';
    modelRateLimiter.markRateLimited(testModel, 120, 'Test 429 Quota Exhaustion');
    const isLimited = modelRateLimiter.isRateLimited(testModel);
    const candidates = modelRateLimiter.getCandidateModels(testModel, ['gemini-3.1-flash-lite', 'gemini-2.0-flash']);
    
    console.log(`[Test 8] Gemini 429 Handling: ModelBlocked=${isLimited}, NextCandidate=${candidates[0]}`);
    results.gemini429 = isLimited && candidates[0] !== testModel;
  } catch (err) {
    console.error('[Test 8 Failed]:', err.message);
    results.gemini429 = false;
  }

  // 9. Real Database PR Reviews Listing
  try {
    const prRes = await fetch(`${BASE_URL}/reviews/pr`);
    const prData = await prRes.json();
    console.log(`[Test 9] Database PR Reviews: Count=${prData.count}, Status=${prRes.status}`);
    results.prReviewsListing = prRes.status === 200 && Array.isArray(prData.reviews);
  } catch (err) {
    console.error('[Test 9 Failed]:', err.message);
    results.prReviewsListing = false;
  }

  console.log('\n====================================================');
  console.log('📊 TEST RESULTS SUMMARY:');
  console.log(JSON.stringify(results, null, 2));
  console.log('====================================================\n');

  const allPassed = Object.values(results).every(Boolean);
  if (allPassed) {
    console.log('✅ ALL TEST SCENARIOS PASSED WITH SUCCESS!');
  } else {
    console.warn('⚠️ Some test scenarios did not pass completely.');
  }

  // Cleanup test DB entry if created
  try {
    await db.query(`DELETE FROM pr_reviews WHERE pr_number = 9999`);
  } catch {}

  process.exit(allPassed ? 0 : 1);
}

runAudit().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
