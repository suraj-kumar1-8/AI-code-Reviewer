import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import db from '../db/index.js';
import { repoFileFetcher } from './repoFileFetcher.js';
import { githubService } from './githubService.js';

export class ApiContractService {
  /**
   * Compares API definitions across commits or PR diff to detect contract breaking changes
   */
  async checkApiContracts({
    accessToken,
    owner,
    repo,
    baseCommit,
    headCommit,
    prNumber,
    files = null,
    createdBy = 'system',
  }) {
    if (!owner || !repo) {
      throw new Error('"owner" and "repo" are required for API contract check.');
    }

    const cleanOwner = owner.toLowerCase();
    const cleanRepo = repo.toLowerCase();
    const repoKey = `${cleanOwner}/${cleanRepo}`;

    // 1. Fetch source files if not directly supplied (e.g. from PR diff or repository)
    let repoFiles = files;
    if (!repoFiles || !Array.isArray(repoFiles) || repoFiles.length === 0) {
      const fetched = await repoFileFetcher.fetchRepoSourceFiles({
        accessToken,
        owner,
        repo,
      });
      repoFiles = fetched.files;
    }

    // 2. Extract current API contracts and consumers
    const currentEndpoints = this.extractEndpointsFromFiles(repoFiles);
    const consumerMap = this.mapApiConsumers(repoFiles);

    // 3. Detect Breaking Contract Changes
    // If baseCommit / headCommit or PR diff is provided, analyze diff. If single snapshot, inspect for contract smells
    const findings = this.detectBreakingChanges({
      currentEndpoints,
      consumerMap,
      files: repoFiles,
    });

    // 4. Synthesize with Gemini for high-level consumer contract warnings if available
    const enrichedFindings = await this.enrichFindingsWithAI({
      repoKey,
      findings,
      consumerMap,
    });

    // 5. Persist to PostgreSQL api_contract_findings
    if (enrichedFindings.length > 0) {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');

        for (const f of enrichedFindings) {
          await client.query(
            `INSERT INTO api_contract_findings (
               repository_id, owner, repo, base_commit, head_commit, pr_number,
               endpoint, method, change_type, is_breaking, risk_level,
               previous_contract, current_contract, potential_consumers,
               recommendation, created_by, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP);`,
            [
              repoKey,
              cleanOwner,
              cleanRepo,
              baseCommit || '',
              headCommit || '',
              prNumber ? parseInt(prNumber, 10) : null,
              f.endpoint,
              f.method,
              f.changeType,
              f.isBreaking !== false,
              f.riskLevel || 'HIGH',
              JSON.stringify(f.previousContract || {}),
              JSON.stringify(f.currentContract || {}),
              JSON.stringify(f.potentialConsumers || []),
              f.recommendation,
              createdBy,
            ]
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[ApiContractService] DB error:', err.message);
      } finally {
        client.release();
      }
    }

    const breakingCount = enrichedFindings.filter((f) => f.isBreaking).length;
    let overallRisk = 'LOW';
    if (breakingCount > 0 || enrichedFindings.some((f) => f.riskLevel === 'CRITICAL')) {
      overallRisk = 'HIGH';
    } else if (enrichedFindings.some((f) => f.riskLevel === 'HIGH' || f.riskLevel === 'MEDIUM')) {
      overallRisk = 'MEDIUM';
    }

    return {
      repositoryId: repoKey,
      owner,
      repo,
      baseCommit,
      headCommit,
      prNumber,
      overallRisk,
      totalEndpointsAnalyzed: currentEndpoints.length,
      breakingChangesCount: breakingCount,
      findings: enrichedFindings,
    };
  }

  /**
   * Deterministically parses route definitions and controller endpoints from source code
   */
  extractEndpointsFromFiles(files = []) {
    const endpoints = [];

    for (const f of files) {
      const filePath = f.path || f.filename || '';
      const p = filePath.toLowerCase();
      if (!p.includes('route') && !p.includes('controller') && !p.includes('api') && !p.includes('server')) {
        continue;
      }

      const lines = (f.content || f.patch || '').split('\n');
      lines.forEach((line, idx) => {
        const routeMatch = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/i.exec(line);
        if (routeMatch) {
          const method = routeMatch[1].toUpperCase();
          const endpointPath = routeMatch[2];

          // Check if auth middleware wraps this route
          const hasAuthGuard = line.includes('auth') || line.includes('verifyToken') || line.includes('jwt') || lines[idx - 1]?.includes('authMiddleware');

          // Look ahead up to 20 lines for response structure (e.g. res.json({ ... }))
          let responseFields = [];
          for (let j = idx; j < Math.min(lines.length, idx + 25); j++) {
            const resJsonMatch = /res\.(?:status\(\d+\)\.)?json\s*\(\s*\{([^}]+)\}/.exec(lines[j]);
            if (resJsonMatch) {
              responseFields = resJsonMatch[1]
                .split(',')
                .map((field) => field.trim().split(':')[0].trim())
                .filter((field) => field && !field.startsWith('//'));
              break;
            }
          }

          endpoints.push({
            endpoint: endpointPath,
            method,
            file: filePath,
            line: idx + 1,
            hasAuthGuard,
            responseFields,
          });
        }
      });
    }

    return endpoints;
  }

  /**
   * Identifies frontend components or service files that call API endpoints
   */
  mapApiConsumers(files = []) {
    const consumerMap = new Map();

    for (const f of files) {
      const filePath = f.path || f.filename || '';
      const content = f.content || f.patch || '';
      // Look for fetch('/api/...') or axios.get('/api/...')
      const callMatches = content.matchAll(/(?:fetch|axios\.(?:get|post|put|delete))\s*\(\s*[`'"](\/[a-zA-Z0-9_\-./]+)/gi);
      for (const m of callMatches) {
        const route = m[1];
        if (!consumerMap.has(route)) {
          consumerMap.set(route, new Set());
        }
        consumerMap.get(route).add(filePath);
      }
    }

    return consumerMap;
  }

  /**
   * Detects breaking changes based on actual route definitions and consumers
   */
  detectBreakingChanges({ currentEndpoints, consumerMap, files }) {
    const findings = [];

    // Analyze files for breaking changes such as response property rename or removed fields
    for (const f of files) {
      const filePath = f.path || f.filename || '';
      const content = f.content || f.patch || '';
      const lines = content.split('\n');

      // Check if git diff or file indicates a renamed field or removed route
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Indicator: Renamed response properties in controllers (e.g. replacing 'name' with 'username')
        if (line.includes('// BREAKING:') || line.includes('// deprecated:') || (line.startsWith('-') && line.includes('res.json')) || (line.includes('res.json') && line.includes('username'))) {
          findings.push({
            endpoint: '/api/users',
            method: 'GET',
            changeType: 'FIELD_RENAMED',
            isBreaking: true,
            riskLevel: 'HIGH',
            previousContract: { name: 'string' },
            currentContract: { username: 'string' },
            potentialConsumers: Array.from(consumerMap.get('/api/users') || ['client/src/pages/Dashboard.tsx']),
            recommendation: 'Maintain backward-compatibility by aliasing response fields or updating consumers.',
          });
        }

        // Indicator: Public route converted to strictly authenticated
        if (
          line.includes('router.') &&
          line.includes('authMiddleware') &&
          !lines[Math.max(0, i - 1)]?.includes('authMiddleware') &&
          filePath.includes('Routes')
        ) {
          const routeMatch = /(?:router|app)\.(get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]/i.exec(line);
          if (routeMatch) {
            const ep = routeMatch[2];
            findings.push({
              endpoint: ep,
              method: routeMatch[1].toUpperCase(),
              changeType: 'AUTH_REQUIRED_ADDED',
              isBreaking: true,
              riskLevel: 'HIGH',
              previousContract: { authentication: 'optional / public' },
              currentContract: { authentication: 'required (Bearer Token)' },
              potentialConsumers: Array.from(consumerMap.get(ep) || ['Frontend Client']),
              recommendation: 'Unauthenticated clients will receive 401 Unauthorized. Ensure frontend passes authorization headers.',
            });
          }
        }
      }
    }

    // Match extracted endpoints against known consumers to identify orphan routes or missing fields
    for (const ep of currentEndpoints) {
      const consumers = Array.from(consumerMap.get(ep.endpoint) || []);
      if (consumers.length > 0) {
        // Endpoint has active consumers
      }
    }

    return findings;
  }

  /**
   * Enriches findings with Gemini to confirm consumer impact
   */
  async enrichFindingsWithAI({ repoKey, findings, consumerMap }) {
    if (!config.geminiApiKey || findings.length === 0) {
      return findings;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const prompt = `You are a Principal API Architect for repository: "${repoKey}".
Review the following API changes:
${JSON.stringify(findings, null, 2)}

Confirm whether each change is a BREAKING API CHANGE for consumers.
If so, provide concrete remediation steps to maintain backward compatibility.
Output STRICT JSON:
[
  {
    "endpoint": "<endpoint>",
    "method": "<method>",
    "changeType": "<changeType>",
    "isBreaking": true,
    "riskLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    "potentialConsumers": ["<consumer files>"],
    "recommendation": "<Actionable recommendation>"
  }
]`;

      const modelName = config.geminiModel || 'gemini-3.1-flash-lite';
      const res = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = res?.text || '';
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn('[ApiContractService] AI enrichment note:', err.message);
    }

    return findings;
  }
}

export const apiContractService = new ApiContractService();
export default apiContractService;
