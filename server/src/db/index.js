import pg from 'pg';
import { Signer } from '@aws-sdk/rds-signer';
import { config } from '../config/index.js';

const { Pool } = pg;

const isProduction = config.nodeEnv === 'production';
const useRdsIam = process.env.RDS_IAM_AUTH === 'true';

const RDS_HOST =
  process.env.RDS_HOST ||
  'database-1.cluster-cha6ao8i4zsy.ap-southeast-2.rds.amazonaws.com';

const RDS_PORT = Number(process.env.RDS_PORT || 5432);
const RDS_REGION = process.env.AWS_REGION || 'ap-southeast-2';
const RDS_USER = process.env.RDS_USER || 'ai_reviewer';
const RDS_DATABASE = process.env.RDS_DATABASE || 'postgres';

const sslConfig =
  process.env.DATABASE_SSL === 'false'
    ? false
    : (
        isProduction || process.env.DATABASE_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false
      );

let pool;

if (useRdsIam) {
  const signer = new Signer({
    hostname: RDS_HOST,
    port: RDS_PORT,
    region: RDS_REGION,
    username: RDS_USER,
  });

  pool = new Pool({
    host: RDS_HOST,
    port: RDS_PORT,
    database: RDS_DATABASE,
    user: RDS_USER,
    password: async () => signer.getAuthToken(),
    ssl: sslConfig,
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  console.log('[Database] Aurora RDS IAM authentication enabled');
} else {
  const connectionString =
    config.database?.url ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5433/code_reviewer';

  pool = new Pool({
    connectionString,
    ssl: sslConfig,
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  console.log('[Database] DATABASE_URL authentication enabled');
}

export { pool };

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]:', err.message);
});

/**
 * Initializes database schema:
 * 1. Enables pgvector extension
 * 2. Creates repositories and code_chunks tables
 * 3. Creates HNSW vector index and relational indexes
 */
export async function initDb() {
  let client;
  try {
    client = await pool.connect();
    console.log('[Database] Connecting to PostgreSQL at', connectionString.replace(/:[^:@]+@/, ':***@'));

    // 1. Enable pgvector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

    // 2. Repositories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS repositories (
        id VARCHAR(255) PRIMARY KEY,
        owner VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL UNIQUE,
        default_branch VARCHAR(100) DEFAULT 'main',
        head_commit_sha VARCHAR(100),
        total_files INTEGER DEFAULT 0,
        total_chunks INTEGER DEFAULT 0,
        last_indexed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_repositories_owner_name ON repositories(owner, name);
      CREATE INDEX IF NOT EXISTS idx_repositories_full_name ON repositories(full_name);
    `);

    // 3. Code chunks table with 768-dimensional vector embedding
    await client.query(`
      CREATE TABLE IF NOT EXISTS code_chunks (
        id BIGSERIAL PRIMARY KEY,
        repository_id VARCHAR(255) NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        language VARCHAR(50) DEFAULT 'plaintext',
        chunk_index INTEGER NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        chunk_content TEXT NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        token_estimate INTEGER DEFAULT 0,
        embedding vector(768),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_code_chunks_repo ON code_chunks(repository_id);
      CREATE INDEX IF NOT EXISTS idx_code_chunks_file ON code_chunks(repository_id, file_path);
      CREATE INDEX IF NOT EXISTS idx_code_chunks_hash ON code_chunks(repository_id, content_hash);
    `);

    // 4. Create HNSW vector index for cosine distance if not exists
    // Note: HNSW works even with empty tables
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE tablename = 'code_chunks' AND indexname = 'idx_code_chunks_embedding_hnsw'
        ) THEN
          CREATE INDEX idx_code_chunks_embedding_hnsw 
          ON code_chunks USING hnsw (embedding vector_cosine_ops)
          WITH (m = 16, ef_construction = 64);
        END IF;
      END $$;
    `);

    // 5. Pull Request Reviews table (Day 6)
    await client.query(`
      CREATE TABLE IF NOT EXISTS pr_reviews (
        id BIGSERIAL PRIMARY KEY,
        repository_id VARCHAR(255) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        repo VARCHAR(255) NOT NULL,
        pr_number INTEGER NOT NULL,
        pr_title TEXT NOT NULL,
        pr_author VARCHAR(255) NOT NULL,
        commit_sha VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'completed',
        risk_level VARCHAR(20) NOT NULL,
        score INTEGER DEFAULT 80,
        summary TEXT,
        issues JSONB DEFAULT '[]'::jsonb,
        comment_id BIGINT,
        comment_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(repository_id, pr_number, commit_sha)
      );

      CREATE INDEX IF NOT EXISTS idx_pr_reviews_repo_pr ON pr_reviews(owner, repo, pr_number);
      CREATE INDEX IF NOT EXISTS idx_pr_reviews_repo ON pr_reviews(repository_id);
      CREATE INDEX IF NOT EXISTS idx_pr_reviews_created ON pr_reviews(created_at DESC);
    `);

    // 6. User Settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id VARCHAR(255) PRIMARY KEY,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Security Scans table (Pro Security Scanner)
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_scans (
        id BIGSERIAL PRIMARY KEY,
        repository_id VARCHAR(255) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        repo VARCHAR(255) NOT NULL,
        commit_sha VARCHAR(100),
        pr_number INTEGER,
        scanned_by VARCHAR(255) DEFAULT 'system',
        status VARCHAR(50) DEFAULT 'completed',
        score INTEGER NOT NULL DEFAULT 100,
        stats JSONB NOT NULL DEFAULT '{"critical":0,"high":0,"medium":0,"low":0,"info":0,"secrets":0}'::jsonb,
        files_scanned INTEGER DEFAULT 0,
        summary TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_security_scans_repo_recent ON security_scans(owner, repo, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_security_scans_commit ON security_scans(owner, repo, commit_sha);
      CREATE INDEX IF NOT EXISTS idx_security_scans_repo_id ON security_scans(repository_id);
    `);

    // 8. Security Findings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_findings (
        id BIGSERIAL PRIMARY KEY,
        scan_id BIGINT NOT NULL REFERENCES security_scans(id) ON DELETE CASCADE,
        repository_id VARCHAR(255) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        file TEXT NOT NULL,
        line INTEGER NOT NULL DEFAULT 1,
        description TEXT NOT NULL,
        impact TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        confidence VARCHAR(20) DEFAULT 'HIGH',
        code_snippet TEXT NOT NULL,
        is_secret BOOLEAN DEFAULT false,
        masked_secret TEXT,
        fingerprint VARCHAR(64) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_security_findings_scan ON security_findings(scan_id);
      CREATE INDEX IF NOT EXISTS idx_security_findings_repo_sev ON security_findings(repository_id, severity);
      CREATE INDEX IF NOT EXISTS idx_security_findings_fingerprint ON security_findings(scan_id, fingerprint);
    `);

    // 9. Fix Suggestions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fix_suggestions (
        id BIGSERIAL PRIMARY KEY,
        finding_id BIGINT NOT NULL REFERENCES security_findings(id) ON DELETE CASCADE UNIQUE,
        explanation TEXT NOT NULL,
        recommended_fix TEXT NOT NULL,
        before_code TEXT NOT NULL,
        after_code TEXT NOT NULL,
        diff TEXT NOT NULL,
        confidence VARCHAR(20) DEFAULT 'HIGH',
        model VARCHAR(100) DEFAULT 'gemini-3.1-flash-lite',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_fix_suggestions_finding ON fix_suggestions(finding_id);
    `);

    // 10. Architecture Scans table (Upgrade 2)
    await client.query(`
      CREATE TABLE IF NOT EXISTS architecture_scans (
        id BIGSERIAL PRIMARY KEY,
        repository_id VARCHAR(255) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        repo VARCHAR(255) NOT NULL,
        commit_sha VARCHAR(100),
        scanned_by VARCHAR(255) DEFAULT 'system',
        summary TEXT NOT NULL,
        tech_stack JSONB NOT NULL DEFAULT '[]'::jsonb,
        data_flow JSONB NOT NULL DEFAULT '[]'::jsonb,
        external_dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
        architectural_risks JSONB NOT NULL DEFAULT '[]'::jsonb,
        diagram_mermaid TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_arch_scans_repo ON architecture_scans(owner, repo, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_arch_scans_commit ON architecture_scans(owner, repo, commit_sha);
    `);

    // 11. Architecture Components table
    await client.query(`
      CREATE TABLE IF NOT EXISTS architecture_components (
        id BIGSERIAL PRIMARY KEY,
        scan_id BIGINT NOT NULL REFERENCES architecture_scans(id) ON DELETE CASCADE,
        repository_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        path TEXT,
        description TEXT,
        dependencies JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_arch_components_scan ON architecture_components(scan_id);
      CREATE INDEX IF NOT EXISTS idx_arch_components_repo ON architecture_components(repository_id);
    `);

    // 12. Technical Debt Findings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS technical_debt_findings (
        id BIGSERIAL PRIMARY KEY,
        repository_id VARCHAR(255) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        repo VARCHAR(255) NOT NULL,
        commit_sha VARCHAR(100),
        severity VARCHAR(20) NOT NULL,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        file TEXT NOT NULL,
        line INTEGER NOT NULL DEFAULT 1,
        description TEXT NOT NULL,
        impact TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        estimated_effort VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
        code_snippet TEXT,
        fingerprint VARCHAR(64) NOT NULL,
        scanned_by VARCHAR(255) DEFAULT 'system',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tech_debt_repo ON technical_debt_findings(owner, repo, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tech_debt_commit ON technical_debt_findings(owner, repo, commit_sha);
      CREATE INDEX IF NOT EXISTS idx_tech_debt_sev ON technical_debt_findings(repository_id, severity);
    `);

    // 13. Codebase Health Scores table
    await client.query(`
      CREATE TABLE IF NOT EXISTS codebase_health_scores (
        id BIGSERIAL PRIMARY KEY,
        repository_id VARCHAR(255) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        repo VARCHAR(255) NOT NULL,
        commit_sha VARCHAR(100),
        overall_health INTEGER NOT NULL DEFAULT 100,
        security INTEGER NOT NULL DEFAULT 100,
        maintainability INTEGER NOT NULL DEFAULT 100,
        performance INTEGER NOT NULL DEFAULT 100,
        reliability INTEGER NOT NULL DEFAULT 100,
        code_quality INTEGER NOT NULL DEFAULT 100,
        complexity INTEGER NOT NULL DEFAULT 100,
        score_explanations JSONB NOT NULL DEFAULT '{}'::jsonb,
        scanned_by VARCHAR(255) DEFAULT 'system',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_health_scores_repo ON codebase_health_scores(owner, repo, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_health_scores_commit ON codebase_health_scores(owner, repo, commit_sha);
    `);

    // 14. Impact Analyses table (Master Upgrade)
    await client.query(`
      CREATE TABLE IF NOT EXISTS impact_analyses (
        id BIGSERIAL PRIMARY KEY,
        repository_id VARCHAR(255) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        repo VARCHAR(255) NOT NULL,
        commit_sha VARCHAR(100),
        pr_number INTEGER,
        target_file TEXT NOT NULL,
        target_symbol VARCHAR(255),
        impact_level VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
        affected_files JSONB NOT NULL DEFAULT '[]'::jsonb,
        affected_functions JSONB NOT NULL DEFAULT '[]'::jsonb,
        affected_endpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
        affected_components JSONB NOT NULL DEFAULT '[]'::jsonb,
        affected_tests JSONB NOT NULL DEFAULT '[]'::jsonb,
        reasoning TEXT NOT NULL,
        recommended_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by VARCHAR(255) DEFAULT 'system',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_impact_analyses_repo ON impact_analyses(owner, repo, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_impact_analyses_target ON impact_analyses(owner, repo, target_file);
    `);

    // 15. Debugging Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS debugging_sessions (
        id BIGSERIAL PRIMARY KEY,
        repository_id VARCHAR(255) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        repo VARCHAR(255) NOT NULL,
        error_message TEXT NOT NULL,
        stack_trace TEXT,
        failing_file TEXT,
        root_cause TEXT NOT NULL,
        evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
        affected_files JSONB NOT NULL DEFAULT '[]'::jsonb,
        recommended_fix TEXT NOT NULL,
        confidence VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
        regression_tests TEXT,
        created_by VARCHAR(255) DEFAULT 'system',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_debugging_sessions_repo ON debugging_sessions(owner, repo, created_at DESC);
    `);

    // 16. API Contract Findings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_contract_findings (
        id BIGSERIAL PRIMARY KEY,
        repository_id VARCHAR(255) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        repo VARCHAR(255) NOT NULL,
        base_commit VARCHAR(100),
        head_commit VARCHAR(100),
        pr_number INTEGER,
        endpoint TEXT NOT NULL,
        method VARCHAR(10) NOT NULL,
        change_type VARCHAR(50) NOT NULL,
        is_breaking BOOLEAN DEFAULT true,
        risk_level VARCHAR(20) NOT NULL DEFAULT 'HIGH',
        previous_contract JSONB,
        current_contract JSONB,
        potential_consumers JSONB NOT NULL DEFAULT '[]'::jsonb,
        recommendation TEXT NOT NULL,
        created_by VARCHAR(255) DEFAULT 'system',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_api_contract_repo ON api_contract_findings(owner, repo, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_api_contract_pr ON api_contract_findings(owner, repo, pr_number);
    `);

    // 17. Database Risk Findings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS database_risk_findings (
        id BIGSERIAL PRIMARY KEY,
        repository_id VARCHAR(255) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        repo VARCHAR(255) NOT NULL,
        commit_sha VARCHAR(100),
        pr_number INTEGER,
        migration_file TEXT,
        operation_type VARCHAR(50) NOT NULL,
        target_table VARCHAR(255),
        target_column VARCHAR(255),
        risk_level VARCHAR(20) NOT NULL DEFAULT 'HIGH',
        detected_references JSONB NOT NULL DEFAULT '{}'::jsonb,
        potential_impact TEXT NOT NULL,
        recommended_action TEXT NOT NULL,
        created_by VARCHAR(255) DEFAULT 'system',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_db_risk_repo ON database_risk_findings(owner, repo, created_at DESC);
    `);

    // 18. Generated Tests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS generated_tests (
        id BIGSERIAL PRIMARY KEY,
        repository_id VARCHAR(255) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        repo VARCHAR(255) NOT NULL,
        target_file TEXT NOT NULL,
        target_symbol VARCHAR(255),
        framework VARCHAR(50) NOT NULL DEFAULT 'Vitest',
        test_type VARCHAR(50) NOT NULL DEFAULT 'unit',
        test_code TEXT NOT NULL,
        explanation TEXT,
        source_finding_id BIGINT,
        created_by VARCHAR(255) DEFAULT 'system',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_generated_tests_repo ON generated_tests(owner, repo, created_at DESC);
    `);

    console.log('✅ [Database Ready] PostgreSQL + pgvector schema initialized successfully.');
    return true;
  } catch (err) {
    const errMsg = err.message || (err.errors && err.errors[0]?.message) || err.code || String(err);
    console.error('❌ [Database Init Error]:', errMsg);
    throw err;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default {
  pool,
  query: (text, params) => pool.query(text, params),
  initDb,
};
