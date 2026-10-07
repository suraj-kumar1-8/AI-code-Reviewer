import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import db from '../db/index.js';
import { repoFileFetcher } from './repoFileFetcher.js';

export class DatabaseRiskService {
  /**
   * Analyzes migration files or SQL scripts to detect destructive schema operations and impacted code
   */
  async analyzeMigrationRisk({
    accessToken,
    owner,
    repo,
    migrationSql = '',
    migrationFile = '',
    commitSha = '',
    prNumber = null,
    files = null,
    createdBy = 'system',
  }) {
    if (!owner || !repo) {
      throw new Error('"owner" and "repo" are required for database risk analysis.');
    }

    const cleanOwner = owner.toLowerCase();
    const cleanRepo = repo.toLowerCase();
    const repoKey = `${cleanOwner}/${cleanRepo}`;

    // 1. Fetch repository source files to trace code references
    let repoFiles = files;
    if (!repoFiles || !Array.isArray(repoFiles) || repoFiles.length === 0) {
      const fetched = await repoFileFetcher.fetchRepoSourceFiles({
        accessToken,
        owner,
        repo,
      });
      repoFiles = fetched.files;
    }

    // 2. Parse Migration SQL for dangerous schema operations
    const sqlToScan = migrationSql || this.findMigrationContentInFiles(repoFiles, migrationFile);
    const dangerousOps = this.parseMigrationOperations(sqlToScan);

    // 3. Trace detected references in Backend, Frontend, and API routes
    const findings = [];
    for (const op of dangerousOps) {
      const references = this.traceCodeReferences(repoFiles, op.table, op.column);

      // Determine Risk Level
      let riskLevel = 'LOW';
      if (op.operationType === 'DROP_TABLE') {
        riskLevel = 'CRITICAL';
      } else if (op.operationType === 'DROP_COLUMN') {
        riskLevel = references.total > 0 ? 'CRITICAL' : 'HIGH';
      } else if (op.operationType === 'RENAME_COLUMN' || op.operationType === 'ADD_NOT_NULL') {
        riskLevel = references.total > 0 ? 'HIGH' : 'MEDIUM';
      } else if (op.operationType === 'ALTER_TYPE' || op.operationType === 'DROP_INDEX') {
        riskLevel = 'MEDIUM';
      }

      const potentialImpact = references.total > 0
        ? `Existing code in ${references.backend.length} backend file(s) and ${references.frontend.length} frontend component(s) still references "${op.table}${op.column ? `.${op.column}` : ''}". Merging this migration will trigger immediate runtime SQL errors or broken UI bindings.`
        : `Schema alteration on "${op.table}" has no active source code references detected. Verify background workers or external ETL jobs.`;

      const recommendedAction = references.total > 0
        ? `Execute a multi-phase migration (Expand and Contract pattern): Update all ${references.total} consumer file(s) to stop querying "${op.column || op.table}" before executing the destructive ALTER/DROP statement.`
        : `Safe to apply if external replicas and background ETL workers do not rely on this table/column.`;

      findings.push({
        migrationFile: migrationFile || op.file || 'schema.sql',
        operationType: op.operationType,
        targetTable: op.table,
        table: op.table,
        targetColumn: op.column || null,
        column: op.column || null,
        riskLevel,
        detectedReferences: references,
        potentialImpact,
        recommendedAction,
        rawSql: op.rawSql,
      });
    }

    // 4. Synthesize with Gemini for higher-level architectural guidance
    const enrichedFindings = await this.enrichFindingsWithAI({
      repoKey,
      findings,
    });

    // 5. Persist to PostgreSQL database_risk_findings
    if (enrichedFindings.length > 0) {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');

        for (const item of enrichedFindings) {
          await client.query(
            `INSERT INTO database_risk_findings (
               repository_id, owner, repo, commit_sha, pr_number,
               migration_file, operation_type, target_table, target_column,
               risk_level, detected_references, potential_impact,
               recommended_action, created_by, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP);`,
            [
              repoKey,
              cleanOwner,
              cleanRepo,
              commitSha || '',
              prNumber ? parseInt(prNumber, 10) : null,
              item.migrationFile,
              item.operationType,
              item.targetTable,
              item.targetColumn,
              item.riskLevel,
              JSON.stringify(item.detectedReferences || {}),
              item.potentialImpact,
              item.recommendedAction,
              createdBy,
            ]
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DatabaseRiskService] DB insert error:', err.message);
      } finally {
        client.release();
      }
    }

    let overallRisk = 'LOW';
    if (enrichedFindings.some((f) => f.riskLevel === 'CRITICAL')) {
      overallRisk = 'CRITICAL';
    } else if (enrichedFindings.some((f) => f.riskLevel === 'HIGH')) {
      overallRisk = 'HIGH';
    } else if (enrichedFindings.some((f) => f.riskLevel === 'MEDIUM')) {
      overallRisk = 'MEDIUM';
    }

    return {
      repositoryId: repoKey,
      owner,
      repo,
      migrationFile,
      overallRisk,
      destructiveOperationsCount: dangerousOps.length,
      totalOperationsAnalyzed: dangerousOps.length,
      highRiskCount: enrichedFindings.filter((f) => f.riskLevel === 'HIGH' || f.riskLevel === 'CRITICAL').length,
      findings: enrichedFindings,
    };
  }

  /**
   * Scans repository for migration files or extracts SQL
   */
  findMigrationContentInFiles(files, targetMigrationFile) {
    if (targetMigrationFile) {
      const match = files.find((f) => f.path.includes(targetMigrationFile));
      if (match) return match.content;
    }

    // Search for migration directories
    for (const f of files) {
      if (f.path.includes('migration') || f.path.includes('schema.sql') || f.path.includes('db/init')) {
        return f.content;
      }
    }

    return '';
  }

  /**
   * Deterministically parses SQL for dangerous/destructive statements
   */
  parseMigrationOperations(sqlContent) {
    const operations = [];
    if (!sqlContent || typeof sqlContent !== 'string') return operations;

    const lines = sqlContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('--') || line.startsWith('/*')) continue;

      // 1. DROP COLUMN: ALTER TABLE <table> DROP COLUMN <column>
      const dropColMatch = /ALTER\s+TABLE\s+(?:ONLY\s+)?([a-zA-Z0-9_"]+)\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_"]+)/i.exec(line);
      if (dropColMatch) {
        operations.push({
          operationType: 'DROP_COLUMN',
          table: dropColMatch[1].replace(/"/g, ''),
          column: dropColMatch[2].replace(/"/g, ''),
          rawSql: line,
        });
      }

      // 2. RENAME COLUMN: ALTER TABLE <table> RENAME COLUMN <col> TO <new_col>
      const renameColMatch = /ALTER\s+TABLE\s+(?:ONLY\s+)?([a-zA-Z0-9_"]+)\s+RENAME\s+COLUMN\s+([a-zA-Z0-9_"]+)\s+TO\s+([a-zA-Z0-9_"]+)/i.exec(line);
      if (renameColMatch) {
        operations.push({
          operationType: 'RENAME_COLUMN',
          table: renameColMatch[1].replace(/"/g, ''),
          column: renameColMatch[2].replace(/"/g, ''),
          newColumn: renameColMatch[3].replace(/"/g, ''),
          rawSql: line,
        });
      }

      // 3. DROP TABLE: DROP TABLE <name>
      const dropTableMatch = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_"]+)/i.exec(line);
      if (dropTableMatch) {
        operations.push({
          operationType: 'DROP_TABLE',
          table: dropTableMatch[1].replace(/"/g, ''),
          column: null,
          rawSql: line,
        });
      }

      // 4. ADD NOT NULL without DEFAULT: ALTER TABLE ... ALTER COLUMN ... SET NOT NULL
      const notNullMatch = /ALTER\s+TABLE\s+([a-zA-Z0-9_"]+)\s+ALTER\s+COLUMN\s+([a-zA-Z0-9_"]+)\s+SET\s+NOT\s+NULL/i.exec(line);
      if (notNullMatch) {
        operations.push({
          operationType: 'ADD_NOT_NULL',
          table: notNullMatch[1].replace(/"/g, ''),
          column: notNullMatch[2].replace(/"/g, ''),
          rawSql: line,
        });
      }

      // 5. ALTER TYPE: ALTER TABLE ... ALTER COLUMN ... TYPE <type>
      const alterTypeMatch = /ALTER\s+TABLE\s+([a-zA-Z0-9_"]+)\s+ALTER\s+COLUMN\s+([a-zA-Z0-9_"]+)\s+TYPE\s+([a-zA-Z0-9_()]+)/i.exec(line);
      if (alterTypeMatch) {
        operations.push({
          operationType: 'ALTER_TYPE',
          table: alterTypeMatch[1].replace(/"/g, ''),
          column: alterTypeMatch[2].replace(/"/g, ''),
          rawSql: line,
        });
      }

      // 6. DROP INDEX: DROP INDEX <name>
      const dropIndexMatch = /DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_"]+)/i.exec(line);
      if (dropIndexMatch) {
        operations.push({
          operationType: 'DROP_INDEX',
          table: 'index',
          column: dropIndexMatch[1].replace(/"/g, ''),
          rawSql: line,
        });
      }
    }

    return operations;
  }

  /**
   * Traces references to table and column across backend and frontend code
   */
  traceCodeReferences(files, table, column) {
    const backendRefs = new Set();
    const frontendRefs = new Set();
    const apiRefs = new Set();

    const colRegex = column ? new RegExp(`\\b${column}\\b`, 'i') : null;
    const tableRegex = table ? new RegExp(`\\b${table}\\b`, 'i') : null;

    for (const f of files) {
      const content = f.content || '';
      const p = f.path.toLowerCase();

      const mentionsTable = tableRegex ? tableRegex.test(content) : false;
      const mentionsCol = colRegex ? colRegex.test(content) : true;

      if (mentionsTable && mentionsCol) {
        if (p.includes('client/') || p.includes('components/') || p.endsWith('.tsx') || p.endsWith('.jsx')) {
          frontendRefs.add(f.path);
        } else if (p.includes('routes/') || p.includes('controllers/')) {
          apiRefs.add(f.path);
        } else {
          backendRefs.add(f.path);
        }
      }
    }

    const backend = Array.from(backendRefs);
    const frontend = Array.from(frontendRefs);
    const apis = Array.from(apiRefs);

    return {
      backend,
      frontend,
      apis,
      total: backend.length + frontend.length + apis.length,
    };
  }

  /**
   * Enriches findings with Gemini to confirm safety and remediation actions
   */
  async enrichFindingsWithAI({ repoKey, findings }) {
    if (!config.geminiApiKey || findings.length === 0) {
      return findings;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const prompt = `You are a Principal Database Reliability Engineer for repository: "${repoKey}".
Review the following database migration findings:
${JSON.stringify(findings, null, 2)}

Provide safe zero-downtime remediation actions and verify the blast radius.
Output STRICT JSON:
[
  {
    "migrationFile": "<file>",
    "operationType": "<operationType>",
    "targetTable": "<table>",
    "targetColumn": "<column>",
    "riskLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    "potentialImpact": "<Clear description of failure mode>",
    "recommendedAction": "<Step-by-step backward compatible migration procedure>"
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
        return parsed.map((item, idx) => ({
          ...findings[idx],
          potentialImpact: item.potentialImpact || findings[idx]?.potentialImpact,
          recommendedAction: item.recommendedAction || findings[idx]?.recommendedAction,
          riskLevel: item.riskLevel || findings[idx]?.riskLevel,
        }));
      }
    } catch (err) {
      console.warn('[DatabaseRiskService] AI enrichment note:', err.message);
    }

    return findings;
  }
}

export const databaseRiskService = new DatabaseRiskService();
export default databaseRiskService;
