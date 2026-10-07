import crypto from 'node:crypto';
import '../src/config/loadEnv.js';
import { config } from '../src/config/index.js';

async function run() {
  const secret = config.github.webhookSecret || 'acr_webhook_secret_development_2026';
  const url = `http://localhost:${config.port || 5001}/api/webhooks/github`;

  console.log(`[Test Webhook] Target URL: ${url}`);
  console.log(`[Test Webhook] Secret loaded: ${secret ? 'yes' : 'no'}`);

  const payload = {
    action: 'opened',
    number: 215,
    pull_request: {
      number: 215,
      title: '`on` now returns a deregistration function',
      user: {
        login: 'matthias-ccri',
        avatar_url: 'https://github.com/matthias-ccri.png',
      },
      head: {
        sha: 'fa9a2079b259560980a18e074a3a3341ecdab9b6',
        ref: 'return-deregistration',
      },
      base: {
        ref: 'main',
      },
    },
    repository: {
      name: 'mitt',
      owner: {
        login: 'developit',
      },
    },
    sender: {
      login: 'matthias-ccri',
    },
  };

  const bodyStr = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(bodyStr);
  const signature = `sha256=${hmac.digest('hex')}`;

  console.log(`[Test Webhook] Generated signature: sha256=...${signature.slice(-8)}`);
  console.log('[Test Webhook] Sending POST request...');

  const startTime = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-github-event': 'pull_request',
      'x-github-delivery': `test-delivery-${Date.now()}`,
      'x-hub-signature-256': signature,
    },
    body: bodyStr,
  });

  const duration = Date.now() - startTime;
  console.log(`[Test Webhook] Status: ${res.status} ${res.statusText} (${duration}ms)`);
  const data = await res.json();
  console.log('[Test Webhook] Response Body:');
  console.log(JSON.stringify(data, null, 2));
}

run().catch((err) => {
  console.error('[Test Webhook] Error:', err);
  process.exit(1);
});
