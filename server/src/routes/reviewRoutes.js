import { Router } from 'express';
import { reviewController } from '../controllers/reviewController.js';
import { prReviewController } from '../controllers/prReviewController.js';
import { optionalAuthMiddleware } from '../middleware/optionalAuthMiddleware.js';

const router = Router();

router.use(optionalAuthMiddleware);

// Pull request review endpoints (Day 6) - placed before :owner/:repo to prevent collision
router.get('/pr', prReviewController.listReviews);
router.get('/pr/:owner/:repo/:prNumber', prReviewController.getReview);
router.post('/pr/analyze', prReviewController.triggerReview);

// Repository full review endpoints (Day 3-4)
router.post('/analyze', reviewController.analyze);
router.get('/:owner/:repo', reviewController.getReview);

export default router;
