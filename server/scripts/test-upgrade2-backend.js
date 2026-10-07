import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5001/api';

async function testUpgrade2Backend() {
  console.log('====================================================');
  console.log('🚀 TESTING UPGRADE 2 BACKEND ENDPOINTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // Use test repo developit/mitt
  const testOwner = 'developit';
  const testRepo = 'mitt';

  // 1. POST /api/architecture/analyze
  try {
    console.log('1. Testing POST /api/architecture/analyze...');
    const res = await fetch(`${BASE_URL}/architecture/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: testOwner, repo: testRepo, force: true }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.techStack && data.diagramMermaid) {
      console.log(`   ✅ PASS: Architecture analyzed successfully.`);
      console.log(`      Tech Stack: ${data.techStack.join(', ')}`);
      console.log(`      Components detected: ${data.components.length}`);
      console.log(`      Mermaid diagram lines: ${data.diagramMermaid.split('\n').length}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: Status ${res.status}:`, data);
      failed++;
    }
  } catch (err) {
    console.error('   ❌ FAIL: Error:', err.message);
    failed++;
  }

  // 2. GET /api/architecture/:owner/:repo
  try {
    console.log('\n2. Testing GET /api/architecture/:owner/:repo...');
    const res = await fetch(`${BASE_URL}/architecture/${testOwner}/${testRepo}`);
    const data = await res.json();
    if (res.ok && data.success && data.summary) {
      console.log(`   ✅ PASS: Architecture scan retrieved.`);
      console.log(`      Summary: ${data.summary.slice(0, 100)}...`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: Status ${res.status}:`, data);
      failed++;
    }
  } catch (err) {
    console.error('   ❌ FAIL: Error:', err.message);
    failed++;
  }

  // 3. GET /api/architecture/:owner/:repo/components
  try {
    console.log('\n3. Testing GET /api/architecture/:owner/:repo/components...');
    const res = await fetch(`${BASE_URL}/architecture/${testOwner}/${testRepo}/components`);
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.components)) {
      console.log(`   ✅ PASS: Retrieved ${data.count} architecture components.`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: Status ${res.status}:`, data);
      failed++;
    }
  } catch (err) {
    console.error('   ❌ FAIL: Error:', err.message);
    failed++;
  }

  // 4. POST /api/technical-debt/scan
  try {
    console.log('\n4. Testing POST /api/technical-debt/scan...');
    const res = await fetch(`${BASE_URL}/technical-debt/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: testOwner, repo: testRepo, force: true }),
    });
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.findings)) {
      console.log(`   ✅ PASS: Technical debt scan completed with ${data.totalFindings} findings.`);
      if (data.findings[0]) {
        console.log(`      Sample finding: [${data.findings[0].severity}] ${data.findings[0].title} (Effort: ${data.findings[0].estimatedEffort})`);
      }
      passed++;
    } else {
      console.error(`   ❌ FAIL: Status ${res.status}:`, data);
      failed++;
    }
  } catch (err) {
    console.error('   ❌ FAIL: Error:', err.message);
    failed++;
  }

  // 5. GET /api/technical-debt/:owner/:repo (with filters)
  try {
    console.log('\n5. Testing GET /api/technical-debt/:owner/:repo...');
    const res = await fetch(`${BASE_URL}/technical-debt/${testOwner}/${testRepo}?severity=ALL`);
    const data = await res.json();
    if (res.ok && data.success && data.stats) {
      console.log(`   ✅ PASS: Retrieved debt findings and stats.`);
      console.log(`      Stats: Total=${data.stats.total}, Critical=${data.stats.critical}, High=${data.stats.high}, Medium=${data.stats.medium}, Low=${data.stats.low}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: Status ${res.status}:`, data);
      failed++;
    }
  } catch (err) {
    console.error('   ❌ FAIL: Error:', err.message);
    failed++;
  }

  // 6. GET /api/technical-debt/:owner/:repo/complexity
  try {
    console.log('\n6. Testing GET /api/technical-debt/:owner/:repo/complexity...');
    const res = await fetch(`${BASE_URL}/technical-debt/${testOwner}/${testRepo}/complexity`);
    const data = await res.json();
    if (res.ok && data.success && data.complexity) {
      console.log(`   ✅ PASS: Complexity metrics computed.`);
      console.log(`      Complexity Score: ${data.complexity.complexityScore}/100`);
      console.log(`      Analyzed files: ${data.complexity.totalFilesAnalyzed}, functions: ${data.complexity.totalFunctionsAnalyzed}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: Status ${res.status}:`, data);
      failed++;
    }
  } catch (err) {
    console.error('   ❌ FAIL: Error:', err.message);
    failed++;
  }

  // 7. GET /api/codebase/health/:owner/:repo
  try {
    console.log('\n7. Testing GET /api/codebase/health/:owner/:repo...');
    const res = await fetch(`${BASE_URL}/codebase/health/${testOwner}/${testRepo}?force=true`);
    const data = await res.json();
    if (res.ok && data.success && data.scores && data.scoreExplanations) {
      console.log(`   ✅ PASS: Health scores computed.`);
      console.log(`      Overall: ${data.scores.overallHealth}/100`);
      console.log(`      Security: ${data.scores.security}/100`);
      console.log(`      Maintainability: ${data.scores.maintainability}/100`);
      console.log(`      Complexity: ${data.scores.complexity}/100`);
      console.log(`      Reliability: ${data.scores.reliability}/100`);
      console.log(`      Performance: ${data.scores.performance}/100`);
      console.log(`      Code Quality: ${data.scores.codeQuality}/100`);
      console.log(`      Trends status: hasTrends=${data.trends?.hasTrends} (${data.trends?.message || data.trends?.formattedTrends?.overallHealth})`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: Status ${res.status}:`, data);
      failed++;
    }
  } catch (err) {
    console.error('   ❌ FAIL: Error:', err.message);
    failed++;
  }

  // 8. POST /api/codebase/explain
  try {
    console.log('\n8. Testing POST /api/codebase/explain...');
    const res = await fetch(`${BASE_URL}/codebase/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: testOwner,
        repo: testRepo,
        filePath: 'src/index.ts',
        codeSnippet: `export default function mitt(all) {
  all = all || new Map();
  return {
    all,
    on(type, handler) {
      const handlers = all.get(type);
      if (handlers) { handlers.push(handler); }
      else { all.set(type, [handler]); }
    },
    off(type, handler) {
      const handlers = all.get(type);
      if (handlers) {
        if (handler) { handlers.splice(handlers.indexOf(handler) >>> 0, 1); }
        else { all.set(type, []); }
      }
    },
    emit(type, evt) {
      let handlers = all.get(type);
      if (handlers) { handlers.slice().map((handler) => { handler(evt); }); }
    }
  };
}`,
      }),
    });
    const data = await res.json();
    if (res.ok && data.purpose && Array.isArray(data.inputs) && Array.isArray(data.outputs)) {
      console.log(`   ✅ PASS: Code explained successfully.`);
      console.log(`      Purpose: ${data.purpose.slice(0, 100)}...`);
      console.log(`      Inputs: ${data.inputs.join(', ')}`);
      console.log(`      Outputs: ${data.outputs.join(', ')}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: Status ${res.status}:`, data);
      failed++;
    }
  } catch (err) {
    console.error('   ❌ FAIL: Error:', err.message);
    failed++;
  }

  // 9. Codebase search GET /api/codebase/search
  try {
    console.log('\n9. Testing GET /api/codebase/search...');
    const res = await fetch(`${BASE_URL}/codebase/search?repositoryId=${testOwner}/${testRepo}&q=emit&type=all`);
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.results)) {
      console.log(`   ✅ PASS: Search returned ${data.total} results for query "emit".`);
      if (data.results[0]) {
        console.log(`      Top match: ${data.results[0].file} (${data.results[0].location}) -> ${data.results[0].whyMatches}`);
      }
      passed++;
    } else {
      console.error(`   ❌ FAIL: Status ${res.status}:`, data);
      failed++;
    }
  } catch (err) {
    console.error('   ❌ FAIL: Error:', err.message);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

testUpgrade2Backend();
