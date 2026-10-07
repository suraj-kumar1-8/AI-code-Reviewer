import { Router } from 'express';
import authRoutes from './authRoutes.js';
import repoRoutes from './repoRoutes.js';
import reviewRoutes from './reviewRoutes.js';
import codebaseRoutes from './codebaseRoutes.js';
import webhookRoutes from './webhookRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import securityRoutes from './securityRoutes.js';
import architectureRoutes from './architectureRoutes.js';
import technicalDebtRoutes from './technicalDebtRoutes.js';
import intelligenceRoutes from './intelligenceRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/repos', repoRoutes);
router.use('/reviews', reviewRoutes);
router.use('/codebase', codebaseRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/settings', settingsRoutes);
router.use('/security', securityRoutes);
router.use('/architecture', architectureRoutes);
router.use('/technical-debt', technicalDebtRoutes);
router.use('/intelligence', intelligenceRoutes);

export default router;
