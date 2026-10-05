import { Router } from 'express';
import authRoutes from './authRoutes.js';
import repoRoutes from './repoRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/repos', repoRoutes);

export default router;
