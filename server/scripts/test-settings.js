import crypto from 'node:crypto';
import '../src/config/loadEnv.js';
import { config } from '../src/config/index.js';

const BASE_URL = `http://localhost:${config.port || 5001}/api`;
const WEBHOOK_SECRET = config.github.webhookSecret || 'acr_webhook_secret_development_2026';

function computeSignature(payloadStr) {
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(payloadStr);
  return `sha256=${hmac.digest('hex')}`;
}

async function runSettingsVerification() {
  console.log('====================================================');
  console.log('🧪 SETTINGS WORKSPACE LIVE VERIFICATION');
  console.log(`Target: ${BASE_URL}`);
  console.log('====================================================\n');

  const checklist = {};

  // 1. Settings UI & GET API Verification
  try {
    const res = await fetch(`${BASE_URL}/settings`);
    const data = await res.json();
    console.log('[Test 1] GET /api/settings:', data.success ? 'SUCCESS' : 'FAILED');
    checklist.getSettings = data.success === true && Boolean(data.settings) && Boolean(data.systemInfo);
  } catch (err) {
    console.error('[Test 1 Failed]:', err.message);
    checklist.getSettings = false;
  }

  // 2. Settings Persistence & Modification (PUT)
  try {
    const updatedPayload = {
      aiAnalysis: {
        severityThreshold: 'HIGH',
        securityAnalysis: true,
        bugDetection: false,
        performanceAnalysis: true,
        maintainabilityAnalysis: false,
      },
      prReview: {
        autoReview: false, // Turn off automatic PR review
        reviewOpened: false,
        reviewSynchronize: true,
        reviewReopened: true,
      },
      notifications: {
        reviewCompleted: false,
        criticalSecurityDetected: true,
        highRiskPRDetected: true,
      },
    };

    const putRes = await fetch(`${BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPayload),
    });
    const putData = await putRes.json();

    // Verify persisted via new GET
    const verifyRes = await fetch(`${BASE_URL}/settings`);
    const verifyData = await verifyRes.json();

    const isThresholdMatch = verifyData.settings.aiAnalysis.severityThreshold === 'HIGH';
    const isBugMatch = verifyData.settings.aiAnalysis.bugDetection === false;
    const isAutoReviewDisabled = verifyData.settings.prReview.autoReview === false;

    console.log(`[Test 2] Persistence Verification: Threshold=${verifyData.settings.aiAnalysis.severityThreshold}, BugDetection=${verifyData.settings.aiAnalysis.bugDetection}, AutoReview=${verifyData.settings.prReview.autoReview}`);
    checklist.persistence = isThresholdMatch && isBugMatch && isAutoReviewDisabled;
  } catch (err) {
    console.error('[Test 2 Failed]:', err.message);
    checklist.persistence = false;
  }

  // 3. Verify PR Review Settings Actively Control Webhook Processing
  try {
    // When autoReview is false, incoming webhook must be skipped!
    const webhookPayload = JSON.stringify({
      action: 'opened',
      number: 215,
      pull_request: {
        number: 215,
        title: 'Settings Webhook Suppression Test',
        user: { login: 'test-user' },
        head: { sha: 'fa9a2079b259560980a18e074a3a3341ecdab9b6', ref: 'test' },
        base: { ref: 'main' },
      },
      repository: { name: 'mitt', owner: { login: 'developit' } },
      sender: { login: 'test-user' },
    });

    const signature = computeSignature(webhookPayload);
    const hookRes = await fetch(`${BASE_URL}/webhooks/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'pull_request',
        'x-github-delivery': `settings-test-${Date.now()}`,
        'x-hub-signature-256': signature,
      },
      body: webhookPayload,
    });
    const hookData = await hookRes.json();

    console.log(`[Test 3] Webhook Suppression with autoReview=false: Ignored=${hookData.ignored}, Reason="${hookData.reason}"`);
    checklist.prSettingsActive = hookData.ignored === true && hookData.reason?.includes('Automatic PR review is disabled');
  } catch (err) {
    console.error('[Test 3 Failed]:', err.message);
    checklist.prSettingsActive = false;
  }

  // 4. Reset Preferences to Defaults
  try {
    const resetRes = await fetch(`${BASE_URL}/settings/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const resetData = await resetRes.json();

    const checkRes = await fetch(`${BASE_URL}/settings`);
    const checkData = await checkRes.json();

    const isBackToLow = checkData.settings.aiAnalysis.severityThreshold === 'LOW';
    const isAutoReviewBackOn = checkData.settings.prReview.autoReview === true;

    console.log(`[Test 4] Reset to Defaults: Threshold=${checkData.settings.aiAnalysis.severityThreshold}, AutoReview=${checkData.settings.prReview.autoReview}`);
    checklist.resetSettings = isBackToLow && isAutoReviewBackOn;
  } catch (err) {
    console.error('[Test 4 Failed]:', err.message);
    checklist.resetSettings = false;
  }

  // 5. System Security & Metadata Status
  try {
    const res = await fetch(`${BASE_URL}/settings`);
    const data = await res.json();
    const sec = data.systemInfo?.security;
    const ai = data.systemInfo?.ai;
    const rag = data.systemInfo?.rag;

    console.log(`[Test 5] Security & Model Metadata: WebhookHMAC=${sec?.webhookVerification}, CodeExecution=${sec?.codeExecution}, Provider="${ai?.provider}", VectorDB="${rag?.vectorDatabase}"`);
    checklist.systemStatus = sec?.webhookVerification === true && sec?.codeExecution === false && Boolean(ai?.provider) && Boolean(rag?.vectorDatabase);
  } catch (err) {
    console.error('[Test 5 Failed]:', err.message);
    checklist.systemStatus = false;
  }

  console.log('\n====================================================');
  console.log('📊 SETTINGS TEST RESULTS:');
  console.log(JSON.stringify(checklist, null, 2));
  console.log('====================================================\n');

  const allPassed = Object.values(checklist).every(Boolean);
  if (allPassed) {
    console.log('✅ ALL SETTINGS TESTS PASSED SUCCESSFULLY!');
  } else {
    console.warn('⚠️ Some settings tests failed.');
  }

  process.exit(allPassed ? 0 : 1);
}

runSettingsVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
