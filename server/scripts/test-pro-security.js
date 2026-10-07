/**
 * Pro Security Scanner & AI Fix Suggestions Test Suite
 * Tests all 9 required verification scenarios against live backend & PostgreSQL database.
 */

import http from 'http';
import { modelRateLimiter } from '../src/services/modelRateLimiter.js';
import { prReviewService } from '../src/services/prReviewService.js';

const API_BASE = 'http://localhost:5001/api';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { status: res.status, ok: res.ok, body: json };
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('🛡️ PRO SECURITY SCANNER COMPREHENSIVE TEST SUITE');
  console.log('Target API: ' + API_BASE);
  console.log('====================================================\n');

  const results = {
    cleanRepo: false,
    sqlInjection: false,
    xss: false,
    secretDetection: false,
    aiFixGeneration: false,
    gemini429: false,
    duplicateProtection: false,
    emptyRepo: false,
    largeRepo: false,
    prIntegration: false,
  };

  let sqlFindingId = null;

  try {
    // ----------------------------------------------------
    // Scenario 1: Clean Repository
    // ----------------------------------------------------
    console.log('[Test 1] Testing Clean Repository...');
    const cleanFiles = [
      {
        path: 'src/utils/math.js',
        content: `export function add(a, b) {\n  return Number(a) + Number(b);\n}\nexport function multiply(a, b) {\n  return Number(a) * Number(b);\n}`,
      },
      {
        path: 'src/components/Header.jsx',
        content: `import React from 'react';\nexport function Header({ title }) {\n  return <header><h1>{title}</h1></header>;\n}`,
      },
    ];

    const cleanRes = await request('/security/scan', {
      method: 'POST',
      body: JSON.stringify({
        owner: 'testorg',
        repo: 'clean-repo',
        commitSha: 'clean-sha-100',
        force: true,
        files: cleanFiles,
      }),
    });

    if (cleanRes.ok && cleanRes.body.scan?.score === 100 && cleanRes.body.scan?.findings?.length === 0) {
      results.cleanRepo = true;
      console.log(`✅ [Test 1 Passed] Clean repo scored 100/100 with 0 findings.`);
    } else {
      console.error(`❌ [Test 1 Failed]`, cleanRes.body);
    }

    // ----------------------------------------------------
    // Scenario 2: Intentional SQL Injection Example
    // ----------------------------------------------------
    console.log('\n[Test 2] Testing Intentional SQL Injection...');
    const sqlFiles = [
      {
        path: 'server/db/users.js',
        content: `const db = require('./connection');\nasync function getUserById(id) {\n  const query = \`SELECT * FROM users WHERE id=\${id}\`;\n  return await db.query(query);\n}`,
      },
    ];

    const sqlRes = await request('/security/scan', {
      method: 'POST',
      body: JSON.stringify({
        owner: 'testorg',
        repo: 'sqli-repo',
        commitSha: 'sqli-sha-200',
        force: true,
        files: sqlFiles,
      }),
    });

    const sqliFinding = sqlRes.body.scan?.findings?.find(
      (f) => f.category === 'SQL Injection' || f.title.toLowerCase().includes('sql injection')
    );

    if (sqlRes.ok && sqliFinding && (sqliFinding.severity === 'HIGH' || sqliFinding.severity === 'CRITICAL')) {
      results.sqlInjection = true;
      sqlFindingId = sqliFinding.id;
      console.log(`✅ [Test 2 Passed] SQL Injection detected: Severity=${sqliFinding.severity}, Line=${sqliFinding.line}, FindingId=${sqlFindingId}`);
    } else {
      console.error(`❌ [Test 2 Failed] SQL injection not detected:`, sqlRes.body);
    }

    // ----------------------------------------------------
    // Scenario 3: Intentional XSS Example
    // ----------------------------------------------------
    console.log('\n[Test 3] Testing Intentional XSS...');
    const xssFiles = [
      {
        path: 'client/src/views/Profile.js',
        content: `function renderBio(bio) {\n  const container = document.getElementById('bio-container');\n  container.innerHTML = bio;\n}`,
      },
    ];

    const xssRes = await request('/security/scan', {
      method: 'POST',
      body: JSON.stringify({
        owner: 'testorg',
        repo: 'xss-repo',
        commitSha: 'xss-sha-300',
        force: true,
        files: xssFiles,
      }),
    });

    const xssFinding = xssRes.body.scan?.findings?.find(
      (f) => f.category === 'XSS' || f.title.toLowerCase().includes('xss')
    );

    if (xssRes.ok && xssFinding && (xssFinding.severity === 'HIGH' || xssFinding.severity === 'CRITICAL')) {
      results.xss = true;
      console.log(`✅ [Test 3 Passed] XSS detected: Severity=${xssFinding.severity}, File=${xssFinding.file}`);
    } else {
      console.error(`❌ [Test 3 Failed] XSS not detected:`, xssRes.body);
    }

    // ----------------------------------------------------
    // Scenario 4: Fake API Key / Secret Detection & Safe Masking
    // ----------------------------------------------------
    console.log('\n[Test 4] Testing Secret Detection & Safe Masking...');
    const rawSecret = 'sk-proj998877665544332211aabbcc';
    const secretFiles = [
      {
        path: 'server/src/aiConfig.js',
        content: `const OPENAI_KEY = "${rawSecret}";\nconst GITHUB_TOKEN = "ghp_112233445566778899aabbccddeeff001122";\nexport { OPENAI_KEY, GITHUB_TOKEN };`,
      },
    ];

    const secretRes = await request('/security/scan', {
      method: 'POST',
      body: JSON.stringify({
        owner: 'testorg',
        repo: 'secrets-repo',
        commitSha: 'sec-sha-400',
        force: true,
        files: secretFiles,
      }),
    });

    const secretFindings = secretRes.body.scan?.findings?.filter((f) => f.isSecret);
    const leakedRaw = JSON.stringify(secretRes.body).includes(rawSecret);

    if (secretRes.ok && secretFindings && secretFindings.length >= 2 && !leakedRaw) {
      const maskedSample = secretFindings[0].maskedSecret;
      const isProperlyMasked = maskedSample && maskedSample.includes('****') && !maskedSample.includes('99887766');
      if (isProperlyMasked) {
        results.secretDetection = true;
        console.log(`✅ [Test 4 Passed] Secrets detected (${secretFindings.length}), raw secret NEVER exposed, masked preview="${maskedSample}".`);
      } else {
        console.error(`❌ [Test 4 Failed] Masking format invalid: "${maskedSample}"`);
      }
    } else {
      console.error(`❌ [Test 4 Failed] Secrets leaked or not detected:`, { count: secretFindings?.length, leakedRaw });
    }

    // ----------------------------------------------------
    // Scenario 5: AI Fix Generation & Diff Viewer
    // ----------------------------------------------------
    console.log('\n[Test 5] Testing AI Fix Generation...');
    if (sqlFindingId) {
      const fixRes = await request(`/security/findings/${sqlFindingId}/fix`, {
        method: 'POST',
      });

      const fix = fixRes.body.fix;
      if (fixRes.ok && fix && fix.beforeCode && fix.afterCode && fix.diff) {
        const hasDiffHeaders = fix.diff.includes('---') && fix.diff.includes('+++');
        const hasDiffChanges = fix.diff.includes('-') && fix.diff.includes('+');
        if (hasDiffHeaders && hasDiffChanges) {
          results.aiFixGeneration = true;
          console.log(`✅ [Test 5 Passed] AI Fix generated successfully:`);
          console.log(`   Confidence: ${fix.confidence}`);
          console.log(`   Model: ${fix.model}`);
          console.log(`   Diff sample:\n${fix.diff.split('\n').slice(0, 5).join('\n')}`);
        } else {
          console.error(`❌ [Test 5 Failed] Diff format invalid:`, fix.diff);
        }
      } else {
        console.error(`❌ [Test 5 Failed] Fix response invalid:`, fixRes.body);
      }
    } else {
      console.error(`❌ [Test 5 Skipped] No SQL finding ID available.`);
    }

    // ----------------------------------------------------
    // Scenario 6: Gemini 429 Handling
    // ----------------------------------------------------
    console.log('\n[Test 6] Testing Gemini 429 Rate Limit Handling...');
    modelRateLimiter.markRateLimited('gemini-3.1-flash-lite', 60, 'Test 429 Simulation');
    console.log('   Simulated 429 Quota Exhaustion for gemini-3.1-flash-lite (Status=RateLimited).');

    const fallbackFiles = [
      {
        path: 'server/exec.js',
        content: `const { exec } = require('child_process');\nfunction runCommand(userInput) {\n  exec(\`ping \${userInput}\`);\n}`,
      },
    ];

    const fallbackRes = await request('/security/scan', {
      method: 'POST',
      body: JSON.stringify({
        owner: 'testorg',
        repo: 'cmd-inject-repo',
        commitSha: 'fallback-sha-500',
        force: true,
        files: fallbackFiles,
      }),
    });

    const cmdFinding = fallbackRes.body.scan?.findings?.find((f) => f.category === 'Command Injection');
    if (fallbackRes.ok && cmdFinding) {
      results.gemini429 = true;
      console.log(`✅ [Test 6 Passed] Fallback succeeded under 429 quota block: Found ${cmdFinding.category} (Score=${fallbackRes.body.scan.score}).`);
    } else {
      console.error(`❌ [Test 6 Failed] Scanner failed under 429:`, fallbackRes.body);
    }
    // Reset rate limiter
    modelRateLimiter.reset();

    // ----------------------------------------------------
    // Scenario 7: Duplicate Scan Protection
    // ----------------------------------------------------
    console.log('\n[Test 7] Testing Duplicate Scan Protection...');
    const dupRes1 = await request('/security/scan', {
      method: 'POST',
      body: JSON.stringify({
        owner: 'testorg',
        repo: 'dup-repo',
        commitSha: 'dup-commit-sha-777',
        force: false,
        files: cleanFiles,
      }),
    });

    const dupRes2 = await request('/security/scan', {
      method: 'POST',
      body: JSON.stringify({
        owner: 'testorg',
        repo: 'dup-repo',
        commitSha: 'dup-commit-sha-777',
        force: false,
        files: cleanFiles,
      }),
    });

    if (dupRes1.ok && dupRes2.ok && dupRes2.body.scan?.cached === true) {
      results.duplicateProtection = true;
      console.log(`✅ [Test 7 Passed] Duplicate scan returned cached result (ID #${dupRes2.body.scan.id}, Cached=true).`);
    } else {
      console.error(`❌ [Test 7 Failed] Duplicate not detected:`, { res1: dupRes1.body, res2: dupRes2.body });
    }

    // ----------------------------------------------------
    // Scenario 8: Empty Repository
    // ----------------------------------------------------
    console.log('\n[Test 8] Testing Empty Repository...');
    const emptyRes = await request('/security/scan', {
      method: 'POST',
      body: JSON.stringify({
        owner: 'testorg',
        repo: 'empty-repo',
        commitSha: 'empty-sha-888',
        force: true,
        files: [],
      }),
    });

    if (emptyRes.ok && emptyRes.body.scan?.score === 100 && emptyRes.body.scan?.filesScanned === 0) {
      results.emptyRepo = true;
      console.log(`✅ [Test 8 Passed] Empty repository handled cleanly: Score=100/100, Files=0, Findings=0.`);
    } else {
      console.error(`❌ [Test 8 Failed] Empty repo handling failed:`, emptyRes.body);
    }

    // ----------------------------------------------------
    // Scenario 9: Large Repository / Payload Limiter
    // ----------------------------------------------------
    console.log('\n[Test 9] Testing Large Repository Payload Limiter...');
    const largeFiles = [];
    for (let i = 1; i <= 30; i++) {
      largeFiles.push({
        path: `src/modules/module_${i}.js`,
        content: `// Large file module ${i}\nexport const mod${i} = { id: ${i}, value: "data_${i}" };\n`.repeat(50),
      });
    }

    const startMs = Date.now();
    const largeRes = await request('/security/scan', {
      method: 'POST',
      body: JSON.stringify({
        owner: 'testorg',
        repo: 'large-repo',
        commitSha: 'large-sha-999',
        force: true,
        files: largeFiles,
      }),
    });
    const durationMs = Date.now() - startMs;

    if (largeRes.ok && largeRes.body.scan?.filesScanned <= 15 && durationMs < 10000) {
      results.largeRepo = true;
      console.log(`✅ [Test 9 Passed] Large repository limited to ${largeRes.body.scan.filesScanned} files in ${durationMs}ms.`);
    } else {
      console.error(`❌ [Test 9 Failed] Large repo error:`, { ok: largeRes.ok, durationMs, files: largeRes.body.scan?.filesScanned });
    }

    // ----------------------------------------------------
    // PR Integration Test
    // ----------------------------------------------------
    console.log('\n[Test 10] Testing PR Review Security Findings Integration...');
    const prReviewResult = await prReviewService.reviewPullRequest({
      repository: { owner: 'audit-org', name: 'sample-project' },
      pullRequest: {
        number: 216,
        title: 'Feature: new auth and admin endpoints',
        author: 'developer-jane',
        baseBranch: 'main',
        headBranch: 'feature/auth',
        headSha: 'fa9a207Fa9a207',
      },
      files: [
        {
          filename: 'src/api.js',
          status: 'modified',
          additions: 4,
          deletions: 0,
          patch: `@@ -10,3 +10,6 @@\n+ const secret = "sk-live_9876543210abcdef9876543210";\n+ eval(userInput);\n`,
        },
      ],
    });

    const commentMarkdown = prReviewService.formatPRReviewComment(prReviewResult, { number: 216 }, 'fa9a207');
    const hasSecFindings = prReviewResult?.securityFindings && prReviewResult.securityFindings.length > 0;
    const hasCommentSection = commentMarkdown.includes('Security Findings');

    if (hasSecFindings && hasCommentSection) {
      results.prIntegration = true;
      console.log(`✅ [Test 10 Passed] PR review integrated ${prReviewResult.securityFindings.length} security findings into review and comment markdown:`);
      prReviewResult.securityFindings.forEach((sf) => console.log(`   - ${sf.severity} — ${sf.category}`));
    } else {
      console.error(`❌ [Test 10 Failed] PR security integration:`, { hasSecFindings, hasCommentSection });
    }
  } catch (err) {
    console.error('Fatal test error:', err);
  }

  console.log('\n====================================================');
  console.log('📊 PRO SECURITY SCANNER TEST RESULTS:');
  console.log(JSON.stringify(results, null, 2));
  console.log('====================================================');

  const allPassed = Object.values(results).every(Boolean);
  if (allPassed) {
    console.log('\n🎉 ALL 10 SECURITY TEST SCENARIOS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    console.error('\n⚠️ Some security test scenarios failed.');
    process.exit(1);
  }
}

runTestSuite();
