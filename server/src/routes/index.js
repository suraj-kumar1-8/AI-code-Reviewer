import { Router } from 'express';
import authRoutes from './authRoutes.js';
import repoRoutes from './repoRoutes.js';
import reviewRoutes from './reviewRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/repos', repoRoutes);
router.use('/reviews', reviewRoutes);

export default router;
