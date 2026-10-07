import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import db from '../db/index.js';
import { repoFileFetcher } from './repoFileFetcher.js';
import { githubService } from './githubService.js';

export class ImpactAnalysisService {
  /**
   * Analyzes the blast radius and impact of modifying a specific file or symbol
   */
  async analyzeImpact({
    accessToken,
    owner,
    repo,
    branch,
    targetFile,
    targetSymbol,
    prNumber,
    force = false,
    createdBy = 'system',
  }) {
    if (!owner || !repo || !targetFile) {
      throw new Error('"owner", "repo", and "targetFile" are required for impact analysis.');
    }

    const cleanOwner = owner.toLowerCase();
    const cleanRepo = repo.toLowerCase();
    const repoKey = `${cleanOwner}/${cleanRepo}`;
    const normalizedTarget = targetFile.replace(/^\/+/, '');

    // 1. Fetch head commit SHA
    let commitSha = '';
    try {
      const branches = await githubService.getBranches(accessToken, owner, repo);
      const targetBranch = branch || branches[0]?.name || 'main';
      const branchInfo = branches.find((b) => b.name === targetBranch);
      commitSha = branchInfo?.commit?.sha || '';
    } catch {
      // Continue if network error
    }

    // 2. Check cached analysis if not forced
    if (!force && commitSha) {
      const cached = await db.query(
        `SELECT * FROM impact_analyses
         WHERE owner = $1 AND repo = $2 AND target_file = $3 
           AND (commit_sha = $4 OR commit_sha = '')
           AND (target_symbol = $5 OR ($5 IS NULL AND target_symbol IS NULL))
         ORDER BY id DESC LIMIT 1;`,
        [cleanOwner, cleanRepo, normalizedTarget, commitSha, targetSymbol || null]
      );

      if (cached.rows.length > 0) {
        return {
          isCached: true,
          ...this.mapDbRow(cached.rows[0]),
        };
      }
    }

    // 3. Fetch source files from repository
    const { files, targetBranch } = await repoFileFetcher.fetchRepoSourceFiles({
      accessToken,
      owner,
      repo,
      branch,
    });

    // 4. Deterministic dependency and reference tracing
    const graph = this.buildDependencyGraph(files, normalizedTarget, targetSymbol);

    // 5. Calculate Impact Level
    let impactLevel = 'LOW';
    const totalAffected = graph.affectedFiles.length;
    const isAuthOrSecurity =
      normalizedTarget.includes('auth') ||
      normalizedTarget.includes('security') ||
      normalizedTarget.includes('token') ||
      (targetSymbol && /auth|token|password|session|secret/i.test(targetSymbol));
    const isDatabase =
      normalizedTarget.includes('db') ||
      normalizedTarget.includes('database') ||
      normalizedTarget.includes('model') ||
      graph.databaseInteractions.length > 0;

    if (isAuthOrSecurity || totalAffected >= 6 || graph.affectedEndpoints.length >= 3) {
      impactLevel = 'CRITICAL';
    } else if (isDatabase || totalAffected >= 3 || graph.affectedEndpoints.length >= 1) {
      impactLevel = 'HIGH';
    } else if (totalAffected >= 2) {
      impactLevel = 'MEDIUM';
    }

    // 6. Generate Reasoning and Recommended Checks
    const { reasoning, recommendedChecks } = await this.synthesizeReasoningWithAI({
      repoKey,
      targetFile: normalizedTarget,
      targetSymbol,
      impactLevel,
      graph,
    });

    // 7. Persist to PostgreSQL
    const client = await db.pool.connect();
    let recordId;
    try {
      await client.query('BEGIN');

      const insertRes = await client.query(
        `INSERT INTO impact_analyses (
           repository_id, owner, repo, commit_sha, pr_number,
           target_file, target_symbol, impact_level,
           affected_files, affected_functions, affected_endpoints,
           affected_components, affected_tests,
           reasoning, recommended_checks, created_by, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
         RETURNING id;`,
        [
          repoKey,
          cleanOwner,
          cleanRepo,
          commitSha || '',
          prNumber ? parseInt(prNumber, 10) : null,
          normalizedTarget,
          targetSymbol || null,
          impactLevel,
          JSON.stringify(graph.affectedFiles),
          JSON.stringify(graph.affectedFunctions),
          JSON.stringify(graph.affectedEndpoints),
          JSON.stringify(graph.affectedComponents),
          JSON.stringify(graph.affectedTests),
          reasoning,
          JSON.stringify(recommendedChecks),
          createdBy,
        ]
      );

      recordId = insertRes.rows[0].id;
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[ImpactAnalysisService] DB Error:', err.message);
      throw err;
    } finally {
      client.release();
    }

    return {
      id: recordId,
      isCached: false,
      repositoryId: repoKey,
      owner,
      repo,
      branch: targetBranch,
      commitSha,
      prNumber,
      targetFile: normalizedTarget,
      targetSymbol,
      impactLevel,
      affectedFiles: graph.affectedFiles,
      affectedFunctions: graph.affectedFunctions,
      affectedEndpoints: graph.affectedEndpoints,
      affectedComponents: graph.affectedComponents,
      affectedTests: graph.affectedTests,
      directDependencies: graph.directDependencies,
      indirectDependencies: graph.indirectDependencies,
      databaseInteractions: graph.databaseInteractions,
      reasoning,
      recommendedChecks,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Deterministically constructs the module dependency graph and caller references
   */
  buildDependencyGraph(files, targetFile, targetSymbol) {
    const directDependencies = new Set();
    const indirectDependencies = new Set();
    const affectedFiles = new Set();
    const affectedFunctions = [];
    const affectedEndpoints = new Set();
    const affectedComponents = new Set();
    const affectedTests = new Set();
    const databaseInteractions = [];

    const targetBase = path.basename(targetFile, path.extname(targetFile));
    const targetSymbolRegex = targetSymbol
      ? new RegExp(`\\b${this.escapeRegExp(targetSymbol)}\\b`)
      : null;

    // 1. Direct callers / dependents
    for (const f of files) {
      if (f.path === targetFile) continue;

      const content = f.content || '';
      const lines = content.split('\n');

      // Check if file imports targetFile
      const importsTarget =
        content.includes(`/${targetBase}`) ||
        content.includes(`'${targetBase}'`) ||
        content.includes(`"${targetBase}"`) ||
        content.includes(targetFile);

      // Check if file references targetSymbol
      const referencesSymbol = targetSymbolRegex ? targetSymbolRegex.test(content) : false;

      if (importsTarget || referencesSymbol) {
        directDependencies.add(f.path);
        affectedFiles.add(f.path);

        // Classify dependent type
        if (f.path.includes('.test.') || f.path.includes('.spec.') || f.path.includes('test/')) {
          affectedTests.add(f.path);
        } else if (f.path.includes('client/') || f.path.includes('components/') || f.path.endsWith('.tsx') || f.path.endsWith('.jsx')) {
          affectedComponents.add(f.path);
        }

        // Trace routes & API endpoints
        if (f.path.includes('routes/') || f.path.includes('controllers/') || content.includes('router.')) {
          lines.forEach((line) => {
            const routeMatch = /(?:router|app)\.(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/i.exec(line);
            if (routeMatch) {
              affectedEndpoints.add(routeMatch[1]);
            }
          });
        }

        // Trace calling functions
        if (targetSymbol) {
          lines.forEach((line, idx) => {
            if (targetSymbolRegex.test(line)) {
              // Find enclosing function declaration
              let fnName = 'anonymous_scope';
              for (let j = idx; j >= Math.max(0, idx - 30); j--) {
                const fnMatch = /(?:async\s+)?(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\()/i.exec(lines[j]);
                if (fnMatch) {
                  fnName = fnMatch[1] || fnMatch[2];
                  break;
                }
              }

              affectedFunctions.push({
                callerFunction: fnName,
                file: f.path,
                line: idx + 1,
                snippet: line.trim(),
              });
            }
          });
        }

        // Check database interactions
        if (/db\.query|pool\.query|SELECT|INSERT|UPDATE|DELETE|prisma|typeorm/i.test(content)) {
          databaseInteractions.push({
            file: f.path,
            hasDirectQueries: true,
          });
        }
      }
    }

    // 2. Transitive / indirect dependencies (callers of direct callers)
    for (const directPath of Array.from(directDependencies)) {
      const directBase = path.basename(directPath, path.extname(directPath));
      for (const f of files) {
        if (f.path === targetFile || directDependencies.has(f.path)) continue;

        if (f.content?.includes(`/${directBase}`) || f.content?.includes(`'${directBase}'`)) {
          indirectDependencies.add(f.path);
          affectedFiles.add(f.path);

          if (f.path.includes('.test.') || f.path.includes('.spec.')) {
            affectedTests.add(f.path);
          } else if (f.path.includes('client/') || f.path.endsWith('.tsx')) {
            affectedComponents.add(f.path);
          }
        }
      }
    }

    return {
      directDependencies: Array.from(directDependencies),
      indirectDependencies: Array.from(indirectDependencies),
      affectedFiles: Array.from(affectedFiles),
      affectedFunctions: affectedFunctions.slice(0, 10),
      affectedEndpoints: Array.from(affectedEndpoints),
      affectedComponents: Array.from(affectedComponents),
      affectedTests: Array.from(affectedTests),
      databaseInteractions,
    };
  }

  /**
   * Synthesizes reasoning and recommended verification checks
   */
  async synthesizeReasoningWithAI({ repoKey, targetFile, targetSymbol, impactLevel, graph }) {
    const defaultReasoning = `Modifying "${targetFile}"${targetSymbol ? ` (symbol: ${targetSymbol})` : ''} has a ${impactLevel} blast radius impacting ${graph.affectedFiles.length} file(s), ${graph.affectedEndpoints.length} API endpoint(s), and ${graph.affectedTests.length} test suite(s). Direct callers rely on exported contracts; changes to parameters, return structures, or exceptions will ripple downstream.`;

    const defaultChecks = [
      `Run test suites covering dependent files: ${graph.affectedTests.slice(0, 3).join(', ') || 'Execute full regression suite'}.`,
      `Verify API response backward-compatibility for affected endpoints: ${graph.affectedEndpoints.slice(0, 3).join(', ') || 'N/A'}.`,
      `Inspect frontend components (${graph.affectedComponents.slice(0, 2).join(', ') || 'None'}) to prevent undefined property dereferencing.`,
      `Validate database transactions and parameter sanitization in dependent services.`,
    ];

    if (!config.geminiApiKey) {
      return { reasoning: defaultReasoning, recommendedChecks: defaultChecks };
    }

    try {
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const prompt = `You are a Principal Software Engineer conducting change impact analysis.
Repository: "${repoKey}"
Target File: "${targetFile}"
Target Symbol: "${targetSymbol || 'Whole File'}"
Computed Blast Radius: ${impactLevel}
Direct Callers: ${graph.directDependencies.join(', ') || 'None'}
Affected Endpoints: ${graph.affectedEndpoints.join(', ') || 'None'}
Affected Frontend: ${graph.affectedComponents.join(', ') || 'None'}
Affected Tests: ${graph.affectedTests.join(', ') || 'None'}

Generate:
1. "reasoning": 2-3 sentences explaining exactly how changes to this module ripple through the system and what could break.
2. "recommendedChecks": 4 concrete, actionable checks or tests the developer must execute before merging.

Return STRICT JSON:
{
  "reasoning": "...",
  "recommendedChecks": ["Check 1", "Check 2", "Check 3", "Check 4"]
}`;

      const modelName = config.geminiModel || 'gemini-3.1-flash-lite';
      const res = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = res?.text || '';
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        reasoning: parsed.reasoning || defaultReasoning,
        recommendedChecks: Array.isArray(parsed.recommendedChecks) ? parsed.recommendedChecks : defaultChecks,
      };
    } catch (err) {
      console.warn('[ImpactAnalysisService] AI synthesis note:', err.message);
      return { reasoning: defaultReasoning, recommendedChecks: defaultChecks };
    }
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  mapDbRow(row) {
    return {
      id: row.id,
      repositoryId: row.repository_id,
      owner: row.owner,
      repo: row.repo,
      commitSha: row.commit_sha,
      prNumber: row.pr_number,
      targetFile: row.target_file,
      targetSymbol: row.target_symbol,
      impactLevel: row.impact_level,
      affectedFiles: row.affected_files,
      affectedFunctions: row.affected_functions,
      affectedEndpoints: row.affected_endpoints,
      affectedComponents: row.affected_components,
      affectedTests: row.affected_tests,
      reasoning: row.reasoning,
      recommendedChecks: row.recommended_checks,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}

export const impactAnalysisService = new ImpactAnalysisService();
export default impactAnalysisService;
