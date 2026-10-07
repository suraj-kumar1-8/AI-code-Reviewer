import { Router } from 'express';
import { intelligenceController } from '../controllers/intelligenceController.js';
import { optionalAuthMiddleware } from '../middleware/optionalAuthMiddleware.js';

const router = Router();

router.use(optionalAuthMiddleware);

// Feature 1: Impact Analysis
router.post('/impact', intelligenceController.analyzeImpact);
router.get('/impact/:owner/:repo', intelligenceController.getImpactAnalyses);

// Feature 2: AI Debugger / Root Cause Analysis
router.post('/debug', intelligenceController.debugError);
router.get('/debug/:owner/:repo', intelligenceController.getDebugSessions);

// Feature 3: API Contract Guardian
router.post('/api-contract', intelligenceController.checkApiContracts);
router.get('/api-contract/:owner/:repo', intelligenceController.getApiContractFindings);

// Feature 4: Database Migration Risk Analyzer
router.post('/database-risk', intelligenceController.analyzeDatabaseRisk);
router.get('/database-risk/:owner/:repo', intelligenceController.getDatabaseRiskFindings);

// Feature 5: AI Test Generator
router.post('/generate-test', intelligenceController.generateTests);

// Unified PR Engineering Insights
router.get('/insights/:owner/:repo/:prNumber', intelligenceController.getPrEngineeringInsights);

export default router;
