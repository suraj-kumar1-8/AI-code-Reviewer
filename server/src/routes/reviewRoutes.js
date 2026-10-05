import { Router } from 'express';
import { reviewController } from '../controllers/reviewController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// All review routes require authenticated GitHub session
router.use(authMiddleware);

// POST /api/reviews/analyze
router.post('/analyze', reviewController.analyze);

// GET /api/reviews/:owner/:repo
router.get('/:owner/:repo', reviewController.getReview);

export default router;
