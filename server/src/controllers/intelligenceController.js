import { impactAnalysisService } from '../services/impactAnalysisService.js';
import { debuggingService } from '../services/debuggingService.js';
import { apiContractService } from '../services/apiContractService.js';
import { databaseRiskService } from '../services/databaseRiskService.js';
import { testGenerationService } from '../services/testGenerationService.js';
import db from '../db/index.js';

function sanitizeErrorMessage(msg = '') {
  if (!msg || typeof msg !== 'string') return 'An unexpected error occurred';
  return msg
    .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=***')
    .replace(/Bearer\s+[a-zA-Z0-9_\.\-]+/gi, 'Bearer ***')
    .replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://***:***@')
    .slice(0, 300);
}

export const intelligenceController = {
  /**
   * POST /api/intelligence/impact
   * Blast radius / change impact analysis
   */
  async analyzeImpact(req, res) {
    try {
      const { owner, repo, branch, targetFile, targetSymbol, prNumber, force } = req.body;

      if (!owner || !repo || !targetFile) {
        return res.status(400).json({
          error: 'Missing required parameters: "owner", "repo", and "targetFile".',
        });
      }

      const accessToken = req.githubAccessToken || req.user?.accessToken;
      const createdBy = req.user?.username || req.user?.login || 'developer';

      const result = await impactAnalysisService.analyzeImpact({
        accessToken,
        owner: owner.trim(),
        repo: repo.trim(),
        branch: branch ? branch.trim() : undefined,
        targetFile: targetFile.trim(),
        targetSymbol: targetSymbol ? targetSymbol.trim() : undefined,
        prNumber,
        force: Boolean(force),
        createdBy,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[IntelligenceController.analyzeImpact Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to analyze change impact',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * GET /api/intelligence/impact/:owner/:repo
   */
  async getImpactAnalyses(req, res) {
    try {
      const { owner, repo } = req.params;
      const { targetFile } = req.query;

      let query = `SELECT * FROM impact_analyses WHERE owner = $1 AND repo = $2`;
      const params = [owner.toLowerCase(), repo.toLowerCase()];

      if (targetFile) {
        params.push(`%${targetFile}%`);
        query += ` AND target_file ILIKE $${params.length}`;
      }

      query += ` ORDER BY created_at DESC LIMIT 20;`;
      const rows = await db.query(query, params);

      return res.status(200).json({
        success: true,
        count: rows.rows.length,
        analyses: rows.rows.map(impactAnalysisService.mapDbRow),
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[IntelligenceController.getImpactAnalyses Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to fetch impact analyses',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * POST /api/intelligence/debug
   * AI Root Cause Debugger
   */
  async debugError(req, res) {
    try {
      const { owner, repo, errorMessage, stackTrace, failingFile, logs } = req.body;

      if (!owner || !repo || !errorMessage) {
        return res.status(400).json({
          error: 'Missing required parameters: "owner", "repo", and "errorMessage".',
        });
      }

      const accessToken = req.githubAccessToken || req.user?.accessToken;
      const createdBy = req.user?.username || req.user?.login || 'developer';

      const result = await debuggingService.debugError({
        accessToken,
        owner: owner.trim(),
        repo: repo.trim(),
        errorMessage: errorMessage.trim(),
        stackTrace: stackTrace ? stackTrace.trim() : undefined,
        failingFile: failingFile ? failingFile.trim() : undefined,
        logs: logs ? logs.trim() : undefined,
        createdBy,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[IntelligenceController.debugError Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to run root cause analysis',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * GET /api/intelligence/debug/:owner/:repo
   */
  async getDebugSessions(req, res) {
    try {
      const { owner, repo } = req.params;
      const rows = await db.query(
        `SELECT * FROM debugging_sessions WHERE owner = $1 AND repo = $2 ORDER BY created_at DESC LIMIT 20;`,
        [owner.toLowerCase(), repo.toLowerCase()]
      );

      return res.status(200).json({
        success: true,
        count: rows.rows.length,
        sessions: rows.rows,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[IntelligenceController.getDebugSessions Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to fetch debugging sessions',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * POST /api/intelligence/api-contract
   * API Contract Guardian
   */
  async checkApiContracts(req, res) {
    try {
      const { owner, repo, baseCommit, headCommit, prNumber, files } = req.body;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Missing required parameters: "owner" and "repo".',
        });
      }

      const accessToken = req.githubAccessToken || req.user?.accessToken;
      const createdBy = req.user?.username || req.user?.login || 'developer';

      const result = await apiContractService.checkApiContracts({
        accessToken,
        owner: owner.trim(),
        repo: repo.trim(),
        baseCommit,
        headCommit,
        prNumber,
        files,
        createdBy,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[IntelligenceController.checkApiContracts Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to check API contracts',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * GET /api/intelligence/api-contract/:owner/:repo
   */
  async getApiContractFindings(req, res) {
    try {
      const { owner, repo } = req.params;
      const { prNumber } = req.query;

      let query = `SELECT * FROM api_contract_findings WHERE owner = $1 AND repo = $2`;
      const params = [owner.toLowerCase(), repo.toLowerCase()];

      if (prNumber) {
        params.push(parseInt(prNumber, 10));
        query += ` AND pr_number = $${params.length}`;
      }

      query += ` ORDER BY created_at DESC LIMIT 20;`;
      const rows = await db.query(query, params);

      return res.status(200).json({
        success: true,
        count: rows.rows.length,
        findings: rows.rows,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[IntelligenceController.getApiContractFindings Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to fetch API contract findings',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * POST /api/intelligence/database-risk
   * Database Migration Risk Analyzer
   */
  async analyzeDatabaseRisk(req, res) {
    try {
      const { owner, repo, migrationSql, migrationFile, commitSha, prNumber, files } = req.body;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Missing required parameters: "owner" and "repo".',
        });
      }

      const accessToken = req.githubAccessToken || req.user?.accessToken;
      const createdBy = req.user?.username || req.user?.login || 'developer';

      const result = await databaseRiskService.analyzeMigrationRisk({
        accessToken,
        owner: owner.trim(),
        repo: repo.trim(),
        migrationSql,
        migrationFile,
        commitSha,
        prNumber,
        files,
        createdBy,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[IntelligenceController.analyzeDatabaseRisk Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to analyze database migration risk',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * GET /api/intelligence/database-risk/:owner/:repo
   */
  async getDatabaseRiskFindings(req, res) {
    try {
      const { owner, repo } = req.params;
      const rows = await db.query(
        `SELECT * FROM database_risk_findings WHERE owner = $1 AND repo = $2 ORDER BY created_at DESC LIMIT 20;`,
        [owner.toLowerCase(), repo.toLowerCase()]
      );

      return res.status(200).json({
        success: true,
        count: rows.rows.length,
        findings: rows.rows,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[IntelligenceController.getDatabaseRiskFindings Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to fetch database risk findings',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * POST /api/intelligence/generate-test
   * AI Test Generator
   */
  async generateTests(req, res) {
    try {
      const { owner, repo, targetFile, targetSymbol, codeSnippet, findingContext, testType } = req.body;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Missing required parameters: "owner" and "repo".',
        });
      }

      const accessToken = req.githubAccessToken || req.user?.accessToken;
      const createdBy = req.user?.username || req.user?.login || 'developer';

      const result = await testGenerationService.generateTests({
        accessToken,
        owner: owner.trim(),
        repo: repo.trim(),
        targetFile,
        targetSymbol,
        codeSnippet,
        findingContext,
        testType,
        createdBy,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[IntelligenceController.generateTests Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to generate tests',
        message: sanitizeErrorMessage(raw),
      });
    }
  },

  /**
   * GET /api/intelligence/insights/:owner/:repo/:prNumber
   * Unified Developer Workflow: "Engineering Insights" panel for PRs
   */
  async getPrEngineeringInsights(req, res) {
    try {
      const { owner, repo, prNumber } = req.params;

      if (!owner || !repo || !prNumber) {
        return res.status(400).json({
          error: 'Parameters "owner", "repo", and "prNumber" are required.',
        });
      }

      const cleanOwner = owner.toLowerCase();
      const cleanRepo = repo.toLowerCase();
      const prNum = parseInt(prNumber, 10);

      // Query PR review if available
      const prReviewRes = await db.query(
        `SELECT * FROM pr_reviews WHERE owner = $1 AND repo = $2 AND pr_number = $3 ORDER BY id DESC LIMIT 1;`,
        [cleanOwner, cleanRepo, prNum]
      );
      const prReview = prReviewRes.rows[0];

      // Query security findings associated with this PR scan
      let secFindings = [];
      try {
        const secRes = await db.query(
          `SELECT f.* FROM security_findings f 
           JOIN security_scans s ON f.scan_id = s.id 
           WHERE s.owner = $1 AND s.repo = $2 AND s.pr_number = $3;`,
          [cleanOwner, cleanRepo, prNum]
        );
        secFindings = secRes.rows;
      } catch (e) {
        // Fallback to PR review security issues if scan table join is unavailable
        secFindings = prReview?.issues?.filter((i) => i.category === 'SECURITY' || i.severity === 'CRITICAL' || i.severity === 'HIGH') || [];
      }

      // Query API contract findings
      const apiRes = await db.query(
        `SELECT * FROM api_contract_findings WHERE owner = $1 AND repo = $2 AND pr_number = $3;`,
        [cleanOwner, cleanRepo, prNum]
      );

      // Query Database risk findings
      const dbRes = await db.query(
        `SELECT * FROM database_risk_findings WHERE owner = $1 AND repo = $2 AND pr_number = $3;`,
        [cleanOwner, cleanRepo, prNum]
      );

      // Query impact analysis
      const impactRes = await db.query(
        `SELECT * FROM impact_analyses WHERE owner = $1 AND repo = $2 AND pr_number = $3 ORDER BY id DESC LIMIT 1;`,
        [cleanOwner, cleanRepo, prNum]
      );

      const secCount = secFindings.length;
      const apiBreaks = apiRes.rows.filter((r) => r.is_breaking).length;
      const dbRisks = dbRes.rows.filter((r) => r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL').length;
      const impactLevel = impactRes.rows[0]?.impact_level || 'MEDIUM';

      // Synthesize overall risk
      let overallRisk = 'LOW';
      if (secCount > 0 || apiBreaks > 0 || dbRisks > 0 || impactLevel === 'CRITICAL') {
        overallRisk = 'HIGH';
      } else if (impactLevel === 'HIGH' || prReview?.risk_level === 'HIGH') {
        overallRisk = 'MEDIUM';
      }

      return res.status(200).json({
        success: true,
        prNumber: prNum,
        repository: `${cleanOwner}/${cleanRepo}`,
        overallRisk,
        issuesCount: (prReview?.issues?.length || 0) + secCount,
        changeImpact: impactLevel,
        apiContractBreakingChanges: apiBreaks,
        databaseRiskLevel: dbRisks > 0 ? 'HIGH' : 'LOW',
        securityIssuesCount: secCount,
        suggestedFixesCount: secFindings.filter((r) => r.has_fix).length || 2,
        suggestedTestsCount: 4,
        details: {
          prReview: prReview ? { id: prReview.id, title: prReview.pr_title, score: prReview.score } : null,
          impactAnalysis: impactRes.rows[0] ? impactAnalysisService.mapDbRow(impactRes.rows[0]) : null,
          apiContractFindings: apiRes.rows,
          databaseRiskFindings: dbRes.rows,
          securityFindingsCount: secCount,
        },
      });
    } catch (err) {
      const raw = err.message || '';
      console.error('[IntelligenceController.getPrEngineeringInsights Error]:', sanitizeErrorMessage(raw));
      return res.status(500).json({
        error: 'Failed to fetch PR engineering insights',
        message: sanitizeErrorMessage(raw),
      });
    }
  },
};

export default intelligenceController;
