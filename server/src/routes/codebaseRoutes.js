import { Router } from 'express';
import { codebaseController } from '../controllers/codebaseController.js';
import { optionalAuthMiddleware } from '../middleware/optionalAuthMiddleware.js';

const router = Router();

router.use(optionalAuthMiddleware);

// POST /api/codebase/index
router.post('/index', codebaseController.index);

// POST /api/codebase/ask
router.post('/ask', codebaseController.ask);

// GET /api/codebase/status
router.get('/status', codebaseController.getStatus);

// GET /api/codebase/repositories
router.get('/repositories', codebaseController.getRepositories);

// GET /api/codebase/health/:owner/:repo
router.get('/health/:owner/:repo', codebaseController.getHealth);

// POST /api/codebase/explain
router.post('/explain', codebaseController.explain);

// GET & POST /api/codebase/search
router.get('/search', codebaseController.search);
router.post('/search', codebaseController.search);

export default router;
