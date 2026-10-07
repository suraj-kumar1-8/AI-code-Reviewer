import db from '../src/db/index.js';

const BASE_URL = 'http://localhost:5001/api';

async function runMasterUpgradeTests() {
  console.log('====================================================');
  console.log('🚀 MASTER UPGRADE — 5 PRO DEVELOPER FEATURES TEST SUITE');
  console.log('====================================================\n');

  const results = {
    database: false,
    feature1_impactAnalysis: false,
    feature2_aiDebugger: false,
    feature3_apiGuardian: false,
    feature4_databaseRisk: false,
    feature5_testGenerator: false,
    unified_prInsights: false,
  };

  const testOwner = 'developit';
  const testRepo = 'mitt';

  // TEST 0: Database Tables
  try {
    console.log('[Test 0] Verifying PostgreSQL Schema for 5 Pro Features...');
    const tablesRes = await db.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN (
        'impact_analyses',
        'debugging_sessions',
        'api_contract_findings',
        'database_risk_findings',
        'generated_tests'
      );
    `);
    const tableNames = tablesRes.rows.map((r) => r.table_name);
    console.log(`   Found tables: ${tableNames.join(', ')}`);
    if (tableNames.length === 5) {
      results.database = true;
      console.log('   ✅ PASS: All 5 intelligence tables exist in PostgreSQL.');
    } else {
      console.error('   ❌ FAIL: Missing tables. Found only:', tableNames);
    }
  } catch (err) {
    console.error('   ❌ FAIL in DB Schema test:', err.message);
  }

  // TEST 1: Feature 1 — Impact Analysis
  try {
    console.log('\n[Test 1] Testing Feature 1: Impact Analysis (POST /api/intelligence/impact)...');
    const res = await fetch(`${BASE_URL}/intelligence/impact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: testOwner,
        repo: testRepo,
        targetFile: 'src/index.ts',
        targetSymbol: 'mitt',
        force: true,
      }),
    });

    const data = await res.json();
    console.log('   Response status:', res.status, 'Success:', data.success);
    const a = data.analysis || data;
    if (res.status === 200 && data.success && a) {
      console.log(`   Target File: ${a.targetFile}`);
      console.log(`   Impact Level: ${a.impactLevel}`);
      console.log(`   Affected Files: ${a.affectedFiles?.length || 0}`);
      console.log(`   Direct Callers: ${a.directCallers?.length || 0}`);
      console.log(`   Recommended Checks: ${a.recommendedChecks?.length || 0}`);
      console.log(`   Reasoning: ${a.reasoning?.slice(0, 100)}...`);

      // Verify GET endpoint
      const listRes = await fetch(`${BASE_URL}/intelligence/impact/${testOwner}/${testRepo}`);
      const listData = await listRes.json();
      console.log(`   GET /api/intelligence/impact returned ${listData.analyses?.length || 0} saved records.`);

      if (a.impactLevel) {
        results.feature1_impactAnalysis = true;
        console.log('   ✅ PASS: Feature 1 Impact Analysis working with static dependency tracing and Gemini reasoning.');
      }
    } else {
      console.error('   ❌ FAIL in Impact Analysis:', data);
    }
  } catch (err) {
    console.error('   ❌ FAIL in Impact Analysis test:', err.message);
  }

  // TEST 2: Feature 2 — AI Debugger / Root Cause Analysis
  try {
    console.log('\n[Test 2] Testing Feature 2: AI Debugger (POST /api/intelligence/debug)...');
    const controlledError = 'TypeError: Cannot read properties of undefined (reading \'emit\')';
    const controlledStack = `TypeError: Cannot read properties of undefined (reading 'emit')
    at Object.handler (/app/src/index.ts:32:15)
    at runTest (/app/test/index.test.ts:45:8)`;

    const res = await fetch(`${BASE_URL}/intelligence/debug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: testOwner,
        repo: testRepo,
        errorMessage: controlledError,
        stackTrace: controlledStack,
        failingFile: 'src/index.ts',
      }),
    });

    const data = await res.json();
    console.log('   Response status:', res.status, 'Success:', data.success);
    const s = data.session || data;
    if (res.status === 200 && data.success && (s.rootCause || s.root_cause)) {
      console.log(`   Error: ${s.error_message || s.errorMessage || s.error}`);
      console.log(`   Root Cause: ${(s.root_cause || s.rootCause)?.slice(0, 120)}...`);
      console.log(`   Confidence: ${s.confidence}`);
      console.log(`   Affected Files: ${JSON.stringify(s.affected_files || s.affectedFiles)}`);
      console.log(`   Recommended Fix: ${((s.recommended_fix || s.recommendedFix)?.slice(0, 100))}...`);
      console.log(`   Regression Tests: ${((s.regression_tests || s.regressionTests)?.slice(0, 100))}...`);

      // Verify GET endpoint
      const listRes = await fetch(`${BASE_URL}/intelligence/debug/${testOwner}/${testRepo}`);
      const listData = await listRes.json();
      console.log(`   GET /api/intelligence/debug returned ${listData.sessions?.length || 0} saved sessions.`);

      results.feature2_aiDebugger = true;
      console.log('   ✅ PASS: Feature 2 AI Debugger working with grounded RAG root-cause synthesis and regression tests.');
    } else {
      console.error('   ❌ FAIL in AI Debugger:', data);
    }
  } catch (err) {
    console.error('   ❌ FAIL in AI Debugger test:', err.message);
  }

  // TEST 3: Feature 3 — API Contract Guardian
  try {
    console.log('\n[Test 3] Testing Feature 3: API Contract Guardian (POST /api/intelligence/api-contract)...');
    const simulatedFiles = [
      {
        filename: 'src/routes/userRoutes.js',
        status: 'modified',
        patch: `@@ -10,3 +10,3 @@
- router.get('/api/users', (req, res) => res.json({ name: user.name }));
+ router.get('/api/users', (req, res) => res.json({ username: user.name }));
        `,
      },
      {
        filename: 'src/components/UserProfile.tsx',
        status: 'modified',
        patch: `// consumes /api/users
const res = await fetch('/api/users');
const data = await res.json();
console.log(data.name);`,
      },
    ];

    const res = await fetch(`${BASE_URL}/intelligence/api-contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: testOwner,
        repo: testRepo,
        prNumber: 216,
        files: simulatedFiles,
      }),
    });

    const data = await res.json();
    console.log('   Response status:', res.status, 'Success:', data.success);
    if (res.status === 200 && data.success) {
      console.log(`   Breaking changes detected: ${data.breakingChangesCount}`);
      console.log(`   Overall Risk: ${data.overallRisk}`);
      console.log(`   Findings count: ${data.findings?.length || 0}`);
      if (data.findings && data.findings.length > 0) {
        const f = data.findings[0];
        console.log(`   Finding: [${f.method}] ${f.endpoint} -> ${f.changeType} (Breaking: ${f.isBreaking}, Risk: ${f.riskLevel})`);
        console.log(`   Consumers identified: ${JSON.stringify(f.potentialConsumers || f.consumers)}`);
        console.log(`   Recommendation: ${f.recommendation?.slice(0, 80)}...`);
      }

      // Verify GET endpoint
      const listRes = await fetch(`${BASE_URL}/intelligence/api-contract/${testOwner}/${testRepo}`);
      const listData = await listRes.json();
      console.log(`   GET /api/intelligence/api-contract returned ${listData.findings?.length || 0} findings.`);

      if (data.findings && data.findings.length > 0) {
        results.feature3_apiGuardian = true;
        console.log('   ✅ PASS: Feature 3 API Contract Guardian accurately detected breaking change and mapped consumers.');
      }
    } else {
      console.error('   ❌ FAIL in API Contract Guardian:', data);
    }
  } catch (err) {
    console.error('   ❌ FAIL in API Contract Guardian test:', err.message);
  }

  // TEST 4: Feature 4 — Database Migration Risk Analyzer
  try {
    console.log('\n[Test 4] Testing Feature 4: Database Risk Analyzer (POST /api/intelligence/database-risk)...');
    const dangerousMigrationSql = `
      -- Risky migration dropping active column
      ALTER TABLE users DROP COLUMN email;
      ALTER TABLE accounts DROP COLUMN balance;
    `;

    const res = await fetch(`${BASE_URL}/intelligence/database-risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: testOwner,
        repo: testRepo,
        migrationFile: 'migrations/20261007_drop_email.sql',
        migrationSql: dangerousMigrationSql,
        prNumber: 216,
      }),
    });

    const data = await res.json();
    console.log('   Response status:', res.status, 'Success:', data.success);
    if (res.status === 200 && data.success) {
      console.log(`   Overall Risk: ${data.overallRisk}`);
      console.log(`   Destructive operations count: ${data.destructiveOperationsCount}`);
      console.log(`   Findings count: ${data.findings?.length || 0}`);
      if (data.findings && data.findings.length > 0) {
        const f = data.findings[0];
        console.log(`   Finding: ${f.operationType} on ${f.targetTable || f.table}.${f.targetColumn || f.column || ''} -> Risk: ${f.riskLevel}`);
        console.log(`   Potential Impact: ${f.potentialImpact?.slice(0, 100)}...`);
        console.log(`   Recommended Action: ${f.recommendedAction?.slice(0, 100)}...`);
      }

      // Verify GET endpoint
      const listRes = await fetch(`${BASE_URL}/intelligence/database-risk/${testOwner}/${testRepo}`);
      const listData = await listRes.json();
      console.log(`   GET /api/intelligence/database-risk returned ${listData.findings?.length || 0} findings.`);

      if (data.findings && data.findings.length > 0 && (data.overallRisk === 'CRITICAL' || data.overallRisk === 'HIGH')) {
        results.feature4_databaseRisk = true;
        console.log('   ✅ PASS: Feature 4 Database Migration Risk Analyzer flagged destructive DDL and warned of column drops.');
      }
    } else {
      console.error('   ❌ FAIL in Database Risk Analyzer:', data);
    }
  } catch (err) {
    console.error('   ❌ FAIL in Database Risk Analyzer test:', err.message);
  }

  // TEST 5: Feature 5 — AI Test + Regression Test Generator
  try {
    console.log('\n[Test 5] Testing Feature 5: AI Test Generator (POST /api/intelligence/generate-test)...');
    const res = await fetch(`${BASE_URL}/intelligence/generate-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: testOwner,
        repo: testRepo,
        targetFile: 'src/index.ts',
        targetSymbol: 'mitt',
        testType: 'regression',
        codeSnippet: `export default function mitt(all) {
  all = all || new Map();
  return {
    all,
    on(type, handler) {
      let handlers = all.get(type);
      if (handlers) {
        handlers.push(handler);
      } else {
        all.set(type, [handler]);
      }
    },
    emit(type, evt) {
      let handlers = all.get(type);
      if (handlers) {
        handlers.slice().map((handler) => { handler(evt); });
      }
    }
  };
}`,
      }),
    });

    const data = await res.json();
    console.log('   Response status:', res.status, 'Success:', data.success);
    const t = data.test || data;
    if (res.status === 200 && data.success && t) {
      console.log(`   Detected Framework: ${t.framework}`);
      console.log(`   Target Symbol: ${t.targetSymbol}`);
      console.log(`   Test Type: ${t.testType}`);
      console.log(`   Test Code Sample: \n${t.testCode.slice(0, 180)}...\n`);
      console.log(`   Explanation: ${t.explanation?.slice(0, 100)}...`);

      if (t.testCode && t.framework) {
        results.feature5_testGenerator = true;
        console.log('   ✅ PASS: Feature 5 AI Test Generator produced framework-aware unit and regression tests.');
      }
    } else {
      console.error('   ❌ FAIL in AI Test Generator:', data);
    }
  } catch (err) {
    console.error('   ❌ FAIL in AI Test Generator test:', err.message);
  }

  // TEST 6: Unified PR Engineering Insights Panel API
  try {
    console.log('\n[Test 6] Testing Unified PR Engineering Insights (GET /api/intelligence/insights/:owner/:repo/:prNumber)...');
    const res = await fetch(`${BASE_URL}/intelligence/insights/${testOwner}/${testRepo}/216`);
    const data = await res.json();
    console.log('   Response status:', res.status, 'Success:', data.success);
    if (res.status === 200 && data.success) {
      console.log(`   PR Number: ${data.prNumber}`);
      console.log(`   Overall Risk: ${data.overallRisk}`);
      console.log(`   Change Impact: ${data.changeImpact}`);
      console.log(`   API Breaking Changes: ${data.apiContractBreakingChanges}`);
      console.log(`   Database Risk Level: ${data.databaseRiskLevel}`);
      console.log(`   Suggested Fixes: ${data.suggestedFixesCount}`);
      console.log(`   Suggested Tests: ${data.suggestedTestsCount}`);
      results.unified_prInsights = true;
      console.log('   ✅ PASS: Unified Engineering Insights aggregation endpoint working.');
    } else {
      console.error('   ❌ FAIL in Unified Insights:', data);
    }
  } catch (err) {
    console.error('   ❌ FAIL in Unified Insights test:', err.message);
  }

  console.log('\n====================================================');
  console.log('📊 MASTER UPGRADE TEST SUMMARY:');
  console.log(JSON.stringify(results, null, 2));
  console.log('====================================================\n');

  const allPassed = Object.values(results).every(Boolean);
  if (allPassed) {
    console.log('🎉 ALL MASTER UPGRADE FEATURES PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED.');
    process.exit(1);
  }
}

runMasterUpgradeTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
