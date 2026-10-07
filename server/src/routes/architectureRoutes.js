import { Router } from 'express';
import { architectureController } from '../controllers/architectureController.js';
import { optionalAuthMiddleware } from '../middleware/optionalAuthMiddleware.js';

const router = Router();

router.use(optionalAuthMiddleware);

// POST /api/architecture/analyze
router.post('/analyze', architectureController.analyze);

// GET /api/architecture/:owner/:repo
router.get('/:owner/:repo', architectureController.getScan);

// GET /api/architecture/:owner/:repo/components
router.get('/:owner/:repo/components', architectureController.getComponents);

export default router;
