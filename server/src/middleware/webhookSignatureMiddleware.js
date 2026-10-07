import crypto from 'node:crypto';
import { config } from '../config/index.js';

/**
 * Middleware to verify GitHub webhook HMAC SHA-256 signature (x-hub-signature-256)
 * Prevents unauthorized or spoofed webhook calls.
 */
export function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  const secret = config.github.webhookSecret;

  if (!secret) {
    console.error('[Webhook Signature Error] GITHUB_WEBHOOK_SECRET is not configured on the server.');
    return res.status(500).json({
      error: 'Server misconfiguration',
      message: 'GitHub webhook secret is not configured on the server.',
    });
  }

  if (!signature) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing "x-hub-signature-256" header. Webhook signature is required.',
    });
  }

  // Get raw body buffer
  let payloadBuffer;
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
    payloadBuffer = req.rawBody;
  } else if (typeof req.body === 'string') {
    payloadBuffer = Buffer.from(req.body, 'utf8');
  } else if (req.body) {
    payloadBuffer = Buffer.from(JSON.stringify(req.body), 'utf8');
  } else {
    payloadBuffer = Buffer.from('', 'utf8');
  }

  // Compute expected HMAC SHA-256
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadBuffer);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  // Constant-time buffer comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    console.warn('[Webhook Warning] Invalid webhook signature rejected.');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid webhook signature.',
    });
  }

  next();
}

export default verifyWebhookSignature;
