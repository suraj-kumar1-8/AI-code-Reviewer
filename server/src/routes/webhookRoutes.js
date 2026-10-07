import { Router } from 'express';
import { webhookController } from '../controllers/webhookController.js';
import { verifyWebhookSignature } from '../middleware/webhookSignatureMiddleware.js';

const router = Router();

// POST /api/webhooks/github - Protected by HMAC SHA-256 signature verification
router.post('/github', verifyWebhookSignature, webhookController.handleGithubWebhook);

export default router;
