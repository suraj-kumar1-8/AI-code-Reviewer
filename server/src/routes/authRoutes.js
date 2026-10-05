import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Public OAuth initiation & callback
router.get('/github', authController.githubLogin);
router.get('/github/callback', authController.githubCallback);

// Protected session endpoints
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authController.logout);

export default router;
