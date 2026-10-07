import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import db from '../db/index.js';
import { repoFileFetcher } from './repoFileFetcher.js';
import { githubService } from './githubService.js';
import { modelRateLimiter } from './modelRateLimiter.js';

export class ArchitectureService {
  /**
   * Analyzes the repository files and inspects actual architecture
   */
  detectArchitectureComponents(files = []) {
    const components = [];
    const techStack = new Set();
    const externalApis = new Set();
    const dataFlow = [];
    const dependencies = [];

    let hasFrontend = false;
    let hasBackend = false;
    let hasDatabase = false;
    let hasAuth = false;
    let hasGemini = false;
    let hasGitHubApi = false;
    let hasPgvector = false;

    // 1. Analyze package.json or dependency files
    for (const file of files) {
      if (file.path.endsWith('package.json')) {
        try {
          const pkg = JSON.parse(file.content);
          const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

          Object.keys(allDeps).forEach((dep) => dependencies.push({ name: dep, version: allDeps[dep] }));

          // Frontend detection
          if (allDeps['react'] || allDeps['vue'] || allDeps['svelte'] || allDeps['next']) {
            hasFrontend = true;
            if (allDeps['react']) techStack.add('React');
            if (allDeps['vite']) techStack.add('Vite');
            if (allDeps['next']) techStack.add('Next.js');
            if (allDeps['tailwindcss']) techStack.add('Tailwind CSS');
            if (allDeps['lucide-react']) techStack.add('Lucide Icons');
            if (allDeps['react-router-dom']) techStack.add('React Router');
          }

          // Backend detection
          if (allDeps['express'] || allDeps['fastify'] || allDeps['koa'] || allDeps['@nestjs/core']) {
            hasBackend = true;
            if (allDeps['express']) techStack.add('Express.js');
            if (allDeps['fastify']) techStack.add('Fastify');
            if (allDeps['cors']) techStack.add('CORS Middleware');
          }

          // Database & Vector detection
          if (allDeps['pg'] || allDeps['pgvector'] || allDeps['postgres'] || allDeps['prisma'] || allDeps['typeorm']) {
            hasDatabase = true;
            techStack.add('PostgreSQL');
            if (allDeps['pgvector'] || file.content.includes('vector') || file.content.includes('embedding')) {
              hasPgvector = true;
              techStack.add('pgvector (Vector Embeddings)');
            }
          }

          // Auth
          if (allDeps['jsonwebtoken'] || allDeps['passport'] || allDeps['passport-github2'] || allDeps['octokit'] || file.content.includes('oauth')) {
            hasAuth = true;
            techStack.add('GitHub OAuth / JWT');
          }

          // AI / Gemini
          if (allDeps['@google/genai'] || allDeps['@google/generative-ai'] || allDeps['openai']) {
            hasGemini = true;
            techStack.add('Google Gemini 2.0 / 1.5 Flash');
            externalApis.add('Google Gemini AI API');
          }

          // External APIs
          if (allDeps['@octokit/rest'] || allDeps['axios'] || file.content.includes('github.com')) {
            hasGitHubApi = true;
            externalApis.add('GitHub REST API v3');
          }
        } catch {
          // ignore json parse error
        }
      }
    }

    // 2. File and directory structural detection
    for (const file of files) {
      const p = file.path.toLowerCase();

      // Frontend UI
      if (p.includes('client/') || p.includes('src/components/') || p.includes('src/pages/') || p.endsWith('.tsx') || p.endsWith('.jsx')) {
        hasFrontend = true;
        if (!components.some((c) => c.name === 'Frontend Client UI')) {
          components.push({
            name: 'Frontend Client UI',
            type: 'Frontend',
            path: file.path.split('/')[0] || 'client',
            description: 'Single-page web interface presenting dashboards, code reviews, and analytics.',
            dependencies: ['Backend API', 'React', 'React Router'],
          });
        }
      }

      // Backend API & Routes
      if (p.includes('routes/') || p.includes('server/') || p.includes('controllers/')) {
        hasBackend = true;
        if (p.includes('routes/') && !components.some((c) => c.name === 'API Router Layer')) {
          components.push({
            name: 'API Router Layer',
            type: 'API Layer',
            path: 'server/src/routes',
            description: 'HTTP REST endpoints handling routing, validation, and request dispatching.',
            dependencies: ['Authentication Middleware', 'Business Services'],
          });
        }
      }

      // Authentication
      if (p.includes('auth') || p.includes('oauth')) {
        hasAuth = true;
        if (!components.some((c) => c.name === 'Authentication Service')) {
          components.push({
            name: 'Authentication Service',
            type: 'Authentication',
            path: file.path,
            description: 'GitHub OAuth token exchange, JWT generation, and protected route authorization.',
            dependencies: ['GitHub API'],
          });
        }
      }

      // Database
      if (p.includes('db/') || p.includes('database') || p.includes('schema') || p.includes('models/')) {
        hasDatabase = true;
        if (!components.some((c) => c.name === 'Database Layer (PostgreSQL)')) {
          components.push({
            name: 'Database Layer (PostgreSQL)',
            type: 'Database',
            path: file.path,
            description: 'Relational data persistence with PostgreSQL connection pooling.',
            dependencies: ['pg'],
          });
        }
      }

      // Important Services
      if (p.includes('gemini') || p.includes('ai') || p.includes('reviewservice')) {
        hasGemini = true;
        if (!components.some((c) => c.name === 'AI Review & Intelligence Service')) {
          components.push({
            name: 'AI Review & Intelligence Service',
            type: 'Service',
            path: file.path,
            description: 'Coordinates Gemini generative AI models for code reviews and analysis.',
            dependencies: ['Google Gemini API'],
          });
        }
      }

      if (p.includes('rag') || p.includes('indexer') || p.includes('chunker') || p.includes('embedding')) {
        hasPgvector = true;
        if (!components.some((c) => c.name === 'RAG & Vector Retrieval Engine')) {
          components.push({
            name: 'RAG & Vector Retrieval Engine',
            type: 'Service',
            path: file.path,
            description: 'Embeds code chunks and runs semantic similarity queries using pgvector.',
            dependencies: ['pgvector', 'Google GenAI Embeddings'],
          });
        }
      }

      if (p.includes('webhook')) {
        if (!components.some((c) => c.name === 'GitHub Webhook Ingestion')) {
          components.push({
            name: 'GitHub Webhook Ingestion',
            type: 'API Layer',
            path: file.path,
            description: 'Receives and validates HMAC signatures for GitHub Pull Request webhook events.',
            dependencies: ['GitHub Service', 'PR Review Service'],
          });
        }
      }

      if (p.includes('security') || p.includes('secret')) {
        if (!components.some((c) => c.name === 'Security Scanner & Secret Detector')) {
          components.push({
            name: 'Security Scanner & Secret Detector',
            type: 'Service',
            path: file.path,
            description: 'Audits source files for OWASP Top 10 vulnerabilities, leaked secrets, and generates AI fix suggestions.',
            dependencies: ['Database', 'Gemini Service'],
          });
        }
      }
    }

    // Default tech stack entries if verified by code
    if (hasBackend && !techStack.has('Express.js') && !techStack.has('Node.js')) {
      techStack.add('Node.js / Express');
    }
    if (hasDatabase && !techStack.has('PostgreSQL')) {
      techStack.add('PostgreSQL');
    }
    if (hasGitHubApi || hasAuth) {
      externalApis.add('GitHub REST API');
    }

    // 3. Construct Data Flow
    dataFlow.push({
      step: 1,
      from: 'Client UI',
      to: 'API Gateway',
      protocol: 'HTTPS / JSON REST',
      description: 'Web client sends user actions and analysis requests to the backend server.',
    });

    if (hasAuth) {
      dataFlow.push({
        step: 2,
        from: 'API Gateway',
        to: 'Auth Middleware',
        protocol: 'Internal Middleware',
        description: 'Verifies GitHub OAuth session cookies and JWT bearer headers before routing requests.',
      });
    }

    dataFlow.push({
      step: 3,
      from: 'API Routes',
      to: 'Business Services',
      protocol: 'Service Invocation',
      description: 'Controllers delegate analysis, reviews, and RAG retrieval to domain service modules.',
    });

    if (hasGemini || externalApis.has('Google Gemini AI API')) {
      dataFlow.push({
        step: 4,
        from: 'AI Services',
        to: 'Google Gemini API',
        protocol: 'HTTPS / REST (gRPC)',
        description: 'Transmits code prompts and code chunks to Gemini models for review and reasoning.',
      });
    }

    if (hasDatabase) {
      dataFlow.push({
        step: 5,
        from: 'Business Services',
        to: 'PostgreSQL Database',
        protocol: 'TCP / Connection Pool (pg)',
        description: 'Persists repositories, scan findings, health scores, and retrieves vector embeddings.',
      });
    }

    return {
      techStack: Array.from(techStack),
      components,
      externalApis: Array.from(externalApis),
      dataFlow,
      dependencies: dependencies.slice(0, 30),
      detectedFlags: {
        hasFrontend,
        hasBackend,
        hasDatabase,
        hasAuth,
        hasGemini,
        hasGitHubApi,
        hasPgvector,
      },
    };
  }

  /**
   * Generates a valid Mermaid diagram string from detected components
   */
  generateMermaidDiagram(detectedFlags, components) {
    const { hasFrontend, hasBackend, hasDatabase, hasAuth, hasGemini, hasGitHubApi, hasPgvector } = detectedFlags;

    const lines = ['flowchart TD'];

    // Subgraphs for architectural tiers
    lines.push('  subgraph ClientTier ["🖥️ Client Tier"]');
    if (hasFrontend) {
      lines.push('    UI["Client Frontend (React / Vite)"]');
    } else {
      lines.push('    Client["HTTP Client / Browser"]');
    }
    lines.push('  end');

    lines.push('  subgraph APITier ["⚙️ API & Gateway Tier"]');
    if (hasBackend) {
      lines.push('    API["Backend Express API (/api)"]');
    } else {
      lines.push('    API["API Gateway"]');
    }
    if (hasAuth) {
      lines.push('    Auth["GitHub OAuth & JWT Guard"]');
    }
    lines.push('  end');

    lines.push('  subgraph ServicesTier ["🧠 Business Services Tier"]');
    if (components.some((c) => c.name.includes('AI Review'))) {
      lines.push('    AISvc["Gemini AI Intelligence Service"]');
    }
    if (components.some((c) => c.name.includes('RAG'))) {
      lines.push('    RAGSvc["RAG & Semantic Retrieval Engine"]');
    }
    if (components.some((c) => c.name.includes('Security'))) {
      lines.push('    SecSvc["Security Scanner & Secret Detector"]');
    }
    if (components.some((c) => c.name.includes('Webhook'))) {
      lines.push('    WebhookSvc["GitHub Webhook Ingestion Handler"]');
    }
    lines.push('  end');

    if (hasDatabase) {
      lines.push('  subgraph DataTier ["💾 Persistence & Storage Tier"]');
      lines.push('    DB[("PostgreSQL 16 Database")]');
      if (hasPgvector) {
        lines.push('    VectorDB[("pgvector Embeddings")]');
      }
      lines.push('  end');
    }

    if (hasGitHubApi || hasGemini) {
      lines.push('  subgraph ExternalTier ["🌐 External Cloud Providers"]');
      if (hasGitHubApi) {
        lines.push('    GHAPI["GitHub REST API v3"]');
      }
      if (hasGemini) {
        lines.push('    GeminiAPI["Google Gemini 2.0 / 1.5"]');
      }
      lines.push('  end');
    }

    // Connections
    if (hasFrontend) {
      lines.push('  UI -->|"HTTPS REST Requests"| API');
    } else {
      lines.push('  Client -->|"HTTP Requests"| API');
    }

    if (hasAuth) {
      lines.push('  API --> Auth');
      lines.push('  Auth --> ServicesTier');
    } else {
      lines.push('  API --> ServicesTier');
    }

    if (hasDatabase) {
      lines.push('  ServicesTier -->|"Connection Pool"| DB');
      if (hasPgvector) {
        lines.push('  DB -->|"Cosine Distance Index"| VectorDB');
      }
    }

    if (hasGitHubApi) {
      lines.push('  ServicesTier -->|"Octokit / OAuth"| GHAPI');
    }

    if (hasGemini) {
      lines.push('  ServicesTier -->|"Generative SDK"| GeminiAPI');
    }

    return lines.join('\n');
  }

  /**
   * Evaluates real architectural risks from the actual repository code
   */
  async detectArchitecturalRisks(files = [], components = []) {
    const risks = [];

    // Static analysis for architectural smells
    for (const file of files) {
      const p = file.path;
      const content = file.content;
      const lines = content.split('\n');

      // 1. Business logic directly in route files
      if (p.includes('routes/')) {
        let sqlQueryCount = 0;
        let complexLogicLines = 0;

        lines.forEach((line) => {
          if (/(?:SELECT|INSERT|UPDATE|DELETE)\s+/i.test(line) || /db\.query|pool\.query/.test(line)) {
            sqlQueryCount++;
          }
          if (/for\s*\(|while\s*\(|\.forEach|\.reduce/.test(line)) {
            complexLogicLines++;
          }
        });

        if (sqlQueryCount > 0) {
          risks.push({
            severity: 'HIGH',
            title: 'Route-Level Database Coupling',
            component: 'API Layer',
            file: p,
            line: 1,
            description: `Route file "${p}" executes direct database queries (${sqlQueryCount} queries detected).`,
            impact: 'Bypasses the service abstraction, hinders unit test isolation, and tightly couples HTTP routes to PostgreSQL storage schemas.',
            recommendation: 'Extract database interactions into dedicated repository or service layer modules.',
            evidence: `Direct database queries detected in route definition: "${p}"`,
          });
        }
      }

      // 2. Oversized controllers / God objects (> 300 lines)
      if (p.includes('controller') && lines.length > 300) {
        risks.push({
          severity: 'MEDIUM',
          title: 'Oversized Controller (Single Responsibility Violation)',
          component: 'API Layer',
          file: p,
          line: 1,
          description: `Controller "${p}" spans ${lines.length} lines, handling too many distinct domain operations.`,
          impact: 'Large controllers often bundle validation, business transformation, and error recovery, resulting in fragile code and high merge conflicts.',
          recommendation: 'Split into smaller, focused domain controllers or delegate workflows to dedicated service orchestrators.',
          evidence: `File length is ${lines.length} lines.`,
        });
      }

      // 3. Unsafe shared global state
      let globalStateDetected = false;
      lines.forEach((line, idx) => {
        if (/^(?:let|var)\s+[a-zA-Z0-9_$]+\s*=\s*(?:\{|\[)/.test(line.trim()) && !p.includes('test') && !p.includes('config')) {
          globalStateDetected = true;
          risks.push({
            severity: 'MEDIUM',
            title: 'Mutable Module-Level Shared State',
            component: 'Backend Services',
            file: p,
            line: idx + 1,
            description: `Module-scoped mutable variable declared: "${line.trim()}".`,
            impact: 'Module-level state shared across concurrent asynchronous requests can cause memory leaks, race conditions, or cross-tenant data contamination.',
            recommendation: 'Encapsulate state inside request-scoped contexts, database stores, or stateless service classes.',
            evidence: line.trim(),
          });
        }
      });
    }

    // Try Gemini AI enhancement for deeper architectural insights
    if (config.geminiApiKey && files.length > 0) {
      try {
        const aiRisks = await this.queryGeminiArchitecturalRisks(files, components);
        if (aiRisks && aiRisks.length > 0) {
          risks.push(...aiRisks);
        }
      } catch (err) {
        console.warn('[ArchitectureService] AI risk enhancement skipped:', err.message);
      }
    }

    // Deduplicate by title + file
    const uniqueRisks = [];
    const seen = new Set();
    for (const r of risks) {
      const key = `${r.title}:${r.file || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRisks.push(r);
      }
    }

    return uniqueRisks;
  }

  /**
   * Calls Gemini to synthesize architectural risks with strict code grounding
   */
  async queryGeminiArchitecturalRisks(files, components) {
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    // Provide file paths and brief summaries of first 10 files
    const context = files
      .slice(0, 10)
      .map((f) => `File: ${f.path}\nFirst 40 lines:\n${f.content.split('\n').slice(0, 40).join('\n')}`)
      .join('\n\n---\n\n');

    const prompt = `You are a Principal Software Architect.
Analyze the following actual source code files from the repository:
Components detected: ${components.map((c) => c.name).join(', ')}.

Identify up to 3 real ARCHITECTURAL RISKS (e.g. tightly coupled modules, missing service layer, circular dependencies, poor separation of concerns, unsafe shared state).

GROUNDING RULES:
1. ONLY report risks supported by the actual provided code.
2. Every risk MUST include exact file path and citation evidence.
3. Return STRICT JSON without markdown wrapping:
[
  {
    "severity": "HIGH" | "MEDIUM" | "LOW",
    "title": "<Concise Risk Title>",
    "component": "<Component Name>",
    "file": "<Exact file path>",
    "line": 1,
    "description": "<What is the architectural risk>",
    "impact": "<Why it matters>",
    "recommendation": "<How to remediate>",
    "evidence": "<Code snippet citation>"
  }
]

FILES:
${context}`;

    const modelName = config.geminiModel || 'gemini-3.1-flash-lite';
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response?.text || '';
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  }

  /**
   * Analyzes repository and saves scan to PostgreSQL
   */
  async analyzeRepository({ accessToken, owner, repo, branch, force = false, scannedBy = 'system' }) {
    const repoKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;

    // 1. Fetch head commit SHA
    let commitSha = '';
    try {
      const branches = await githubService.getBranches(accessToken, owner, repo);
      const targetBranch = branch || branches[0]?.name || 'main';
      const branchInfo = branches.find((b) => b.name === targetBranch);
      commitSha = branchInfo?.commit?.sha || '';
    } catch {
      // Continue without commit sha if network error
    }

    // 2. Check cached scan
    if (!force && commitSha) {
      const cached = await db.query(
        `SELECT * FROM architecture_scans 
         WHERE owner = $1 AND repo = $2 AND commit_sha = $3 
         ORDER BY id DESC LIMIT 1;`,
        [owner.toLowerCase(), repo.toLowerCase(), commitSha]
      );

      if (cached.rows.length > 0) {
        const scan = cached.rows[0];
        const componentsRes = await db.query(
          `SELECT * FROM architecture_components WHERE scan_id = $1 ORDER BY id ASC;`,
          [scan.id]
        );

        return {
          isCached: true,
          scanId: scan.id,
          repositoryId: repoKey,
          owner,
          repo,
          commitSha,
          summary: scan.summary,
          techStack: scan.tech_stack,
          dataFlow: scan.data_flow,
          externalDependencies: scan.external_dependencies,
          architecturalRisks: scan.architectural_risks,
          diagramMermaid: scan.diagram_mermaid,
          components: componentsRes.rows.map(this.mapDbComponent),
          createdAt: scan.created_at,
        };
      }
    }

    // 3. Fetch source files
    const { files, targetBranch } = await repoFileFetcher.fetchRepoSourceFiles({
      accessToken,
      owner,
      repo,
      branch,
    });

    // 4. Detect architecture components and data flow
    const { techStack, components, externalApis, dataFlow, dependencies, detectedFlags } =
      this.detectArchitectureComponents(files);

    // 5. Generate Mermaid Diagram
    const diagramMermaid = this.generateMermaidDiagram(detectedFlags, components);

    // 6. Detect Architectural Risks
    const architecturalRisks = await this.detectArchitecturalRisks(files, components);

    // 7. Executive architecture summary
    const summary = `The codebase "${owner}/${repo}" is organized as a ${
      detectedFlags.hasFrontend ? 'full-stack' : 'backend-focused'
    } architecture featuring ${techStack.slice(0, 4).join(', ')}. ` +
      `It encompasses ${components.length} detected architectural components communicating across ${dataFlow.length} primary data flow pathways. ` +
      `${architecturalRisks.length} architectural risk(s) were flagged for review.`;

    // 8. Persist to PostgreSQL in a transaction
    const client = await db.pool.connect();
    let scanId;

    try {
      await client.query('BEGIN');

      const insertScanRes = await client.query(
        `INSERT INTO architecture_scans (
           repository_id, owner, repo, commit_sha, scanned_by,
           summary, tech_stack, data_flow, external_dependencies,
           architectural_risks, diagram_mermaid, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
         RETURNING id;`,
        [
          repoKey,
          owner.toLowerCase(),
          repo.toLowerCase(),
          commitSha || '',
          scannedBy,
          summary,
          JSON.stringify(techStack),
          JSON.stringify(dataFlow),
          JSON.stringify({ externalApis, dependencies }),
          JSON.stringify(architecturalRisks),
          diagramMermaid,
        ]
      );

      scanId = insertScanRes.rows[0].id;

      // Insert components
      const insertCompQuery = `
        INSERT INTO architecture_components (
          scan_id, repository_id, name, type, path, description, dependencies, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP);
      `;

      for (const comp of components) {
        await client.query(insertCompQuery, [
          scanId,
          repoKey,
          comp.name,
          comp.type,
          comp.path || '',
          comp.description || '',
          JSON.stringify(comp.dependencies || []),
        ]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[ArchitectureService] DB transaction failed:', err.message);
      throw err;
    } finally {
      client.release();
    }

    return {
      isCached: false,
      scanId,
      repositoryId: repoKey,
      owner,
      repo,
      branch: targetBranch,
      commitSha,
      summary,
      techStack,
      components,
      dataFlow,
      externalDependencies: { externalApis, dependencies },
      architecturalRisks,
      diagramMermaid,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves latest architecture scan for repository
   */
  async getLatestScan(owner, repo) {
    const res = await db.query(
      `SELECT * FROM architecture_scans 
       WHERE owner = $1 AND repo = $2 
       ORDER BY id DESC LIMIT 1;`,
      [owner.toLowerCase(), repo.toLowerCase()]
    );

    if (res.rows.length === 0) return null;

    const scan = res.rows[0];
    const compRes = await db.query(
      `SELECT * FROM architecture_components WHERE scan_id = $1 ORDER BY id ASC;`,
      [scan.id]
    );

    return {
      id: scan.id,
      repositoryId: scan.repository_id,
      owner: scan.owner,
      repo: scan.repo,
      commitSha: scan.commit_sha,
      summary: scan.summary,
      techStack: scan.tech_stack,
      dataFlow: scan.data_flow,
      externalDependencies: scan.external_dependencies,
      architecturalRisks: scan.architectural_risks,
      diagramMermaid: scan.diagram_mermaid,
      components: compRes.rows.map(this.mapDbComponent),
      createdAt: scan.created_at,
    };
  }

  /**
   * Retrieves components for a repository
   */
  async getComponents(owner, repo) {
    const res = await db.query(
      `SELECT ac.* FROM architecture_components ac
       JOIN architecture_scans as_scan ON ac.scan_id = as_scan.id
       WHERE as_scan.owner = $1 AND as_scan.repo = $2
       ORDER BY ac.id ASC;`,
      [owner.toLowerCase(), repo.toLowerCase()]
    );

    return res.rows.map(this.mapDbComponent);
  }

  mapDbComponent(row) {
    return {
      id: row.id,
      scanId: row.scan_id,
      name: row.name,
      type: row.type,
      path: row.path,
      description: row.description,
      dependencies: row.dependencies,
      createdAt: row.created_at,
    };
  }
}

export const architectureService = new ArchitectureService();
export default architectureService;
