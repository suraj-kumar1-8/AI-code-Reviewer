import { Router } from 'express';
import { technicalDebtController } from '../controllers/technicalDebtController.js';
import { optionalAuthMiddleware } from '../middleware/optionalAuthMiddleware.js';

const router = Router();

router.use(optionalAuthMiddleware);

// POST /api/technical-debt/scan
router.post('/scan', technicalDebtController.scan);

// GET /api/technical-debt/:owner/:repo
router.get('/:owner/:repo', technicalDebtController.getFindings);

// GET /api/technical-debt/:owner/:repo/complexity
router.get('/:owner/:repo/complexity', technicalDebtController.getComplexity);

export default router;
