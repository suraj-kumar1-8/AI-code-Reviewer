import express from 'express';
import { settingsController } from '../controllers/settingsController.js';
import { optionalAuthMiddleware } from '../middleware/optionalAuthMiddleware.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(optionalAuthMiddleware);

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);
router.post('/reset', settingsController.resetSettings);
router.post('/clear-index', authMiddleware, settingsController.clearIndex);

export default router;
