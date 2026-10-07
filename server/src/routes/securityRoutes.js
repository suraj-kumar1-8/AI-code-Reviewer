import express from 'express';
import { securityController } from '../controllers/securityController.js';
import { optionalAuthMiddleware } from '../middleware/optionalAuthMiddleware.js';

const router = express.Router();

router.use(optionalAuthMiddleware);

// Trigger or retrieve cached security scan
router.post('/scan', securityController.scanRepository);

// Get latest scan summary for a repository
router.get('/:owner/:repo', securityController.getLatestScan);

// Get filtered findings for a repository
router.get('/:owner/:repo/findings', securityController.getFindings);

// Generate or retrieve AI remediation fix for a finding
router.post('/findings/:findingId/fix', securityController.generateFix);

export default router;
