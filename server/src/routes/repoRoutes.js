import { Router } from 'express';
import { repoController } from '../controllers/repoController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all repository endpoints
router.use(authMiddleware);

router.get('/', repoController.getRepos);
router.get('/:owner/:repo', repoController.getRepo);

export default router;
