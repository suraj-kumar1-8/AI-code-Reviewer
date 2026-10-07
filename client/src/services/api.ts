import type {
  GitHubUser,
  GitHubRepo,
  ReviewResult,
  PRReview,
  SecurityScan,
  SecurityFinding,
  FixSuggestion,
  ArchitectureScan,
  ArchitectureComponent,
  TechnicalDebtFinding,
  TechnicalDebtStats,
  CodeComplexityMetrics,
  CodebaseHealthScores,
  ScoreExplanations,
  HealthTrends,
  CodeExplanationResult,
  CodebaseSearchResult,
  ImpactAnalysisResult,
  DebugSession,
  ApiContractCheckResult,
  ApiContractFinding,
  DatabaseRiskCheckResult,
  DatabaseRiskFinding,
  GeneratedTestResult,
  PrEngineeringInsights,
} from '../types';

const rawBase = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');
const API_BASE_URL = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;

export const api = {
  /**
   * Health check
   */
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      return await res.json();
    } catch (err: any) {
      return { status: 'offline', message: err.message };
    }
  },

  /**
   * Get GitHub OAuth login URL
   */
  getGitHubLoginUrl() {
    return `${API_BASE_URL}/auth/github`;
  },

  /**
   * Fetch currently authenticated user via session cookie
   */
  async getMe(): Promise<{ authenticated: boolean; user?: GitHubUser; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (res.status === 401) {
        return { authenticated: false };
      }

      if (!res.ok) {
        throw new Error(`Failed to verify session: ${res.statusText}`);
      }

      return await res.json();
    } catch (err: any) {
      console.warn('[api.getMe] Session check failed:', err.message);
      return { authenticated: false, error: err.message };
    }
  },

  /**
   * Log out of current session
   */
  async logout(): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });
      return await res.json();
    } catch (err: any) {
      console.error('[api.logout] Logout failed:', err.message);
      return { success: false, message: err.message };
    }
  },

  /**
   * Fetch authenticated user's real GitHub repositories
   */
  async getRepos(params?: { sort?: string; type?: string }): Promise<{
    success: boolean;
    count: number;
    repositories: GitHubRepo[];
    error?: string;
  }> {
    const query = new URLSearchParams();
    if (params?.sort) query.set('sort', params.sort);
    if (params?.type) query.set('type', params.type);

    const res = await fetch(`${API_BASE_URL}/repos?${query.toString()}`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.details || `Failed to fetch repos: ${res.statusText}`);
    }

    return await res.json();
  },

  /**
   * Fetch single repository details
   */
  async getRepo(owner: string, repo: string): Promise<{
    success: boolean;
    repository: GitHubRepo;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/repos/${owner}/${repo}`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch repository ${owner}/${repo}`);
    }

    return await res.json();
  },

  /**
   * POST /api/reviews/analyze
   * Analyzes repository files using AI code inspection
   */
  async analyzeRepo(params: {
    owner: string;
    repo: string;
    branch?: string;
    force?: boolean;
  }): Promise<ReviewResult & { success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE_URL}/reviews/analyze`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Analysis failed: ${res.statusText}`);
    }

    return await res.json();
  },

  /**
   * GET /api/reviews/:owner/:repo
   * Retrieves existing or cached review
   */
  async getReview(
    owner: string,
    repo: string,
    branch?: string
  ): Promise<ReviewResult & { success: boolean; error?: string }> {
    const query = branch ? `?branch=${encodeURIComponent(branch)}` : '';
    const res = await fetch(`${API_BASE_URL}/reviews/${owner}/${repo}${query}`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Failed to get review: ${res.statusText}`);
    }

    return await res.json();
  },

  /**
   * POST /api/codebase/index
   * Index or re-index a repository for RAG
   */
  async indexCodebase(params: {
    owner: string;
    repo: string;
    branch?: string;
    force?: boolean;
  }): Promise<{
    success: boolean;
    isCached?: boolean;
    repositoryId: string;
    owner: string;
    repo: string;
    branch?: string;
    totalFiles: number;
    totalChunks: number;
    lastIndexedAt: string;
    message?: string;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/codebase/index`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `Failed to index repository: ${res.statusText}`);
    }

    return data;
  },

  /**
   * POST /api/codebase/ask
   * Ask questions to indexed repository codebase
   */
  async askCodebase(params: {
    repositoryId?: string;
    owner?: string;
    repo?: string;
    question: string;
  }): Promise<{
    success: boolean;
    answer: string;
    sources: Array<{
      file: string;
      startLine: number;
      endLine: number;
      language: string;
      similarity: number;
      snippet?: string;
    }>;
    repositoryId: string;
    question: string;
    error?: string;
    needsIndexing?: boolean;
  }> {
    const res = await fetch(`${API_BASE_URL}/codebase/ask`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.message || data.error || `Failed to answer question: ${res.statusText}`);
      (error as any).needsIndexing = data.needsIndexing;
      throw error;
    }

    return data;
  },

  /**
   * GET /api/codebase/status
   * Check if repository is indexed for RAG
   */
  async getCodebaseStatus(params: {
    repositoryId?: string;
    owner?: string;
    repo?: string;
  }): Promise<{
    isIndexed: boolean;
    repositoryId?: string;
    owner?: string;
    repo?: string;
    fullName?: string;
    branch?: string;
    totalFiles?: number;
    totalChunks?: number;
    lastIndexedAt?: string;
    error?: string;
  }> {
    const query = new URLSearchParams();
    if (params.repositoryId) query.set('repositoryId', params.repositoryId);
    if (params.owner) query.set('owner', params.owner);
    if (params.repo) query.set('repo', params.repo);

    const res = await fetch(`${API_BASE_URL}/codebase/status?${query.toString()}`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `Failed to get codebase status: ${res.statusText}`);
    }

    return data;
  },

  /**
   * GET /api/codebase/repositories
   * List all indexed repositories
   */
  async getIndexedRepositories(): Promise<{
    count: number;
    repositories: Array<{
      id: string;
      owner: string;
      name: string;
      full_name: string;
      default_branch: string;
      total_files: number;
      total_chunks: number;
      last_indexed_at: string;
    }>;
  }> {
    const res = await fetch(`${API_BASE_URL}/codebase/repositories`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `Failed to fetch indexed repositories: ${res.statusText}`);
    }

    return data;
  },

  /**
   * GET /api/reviews/pr
   * List all stored PR reviews
   */
  async getPRReviews(params?: {
    owner?: string;
    repo?: string;
    repositoryId?: string;
  }): Promise<{
    count: number;
    reviews: PRReview[];
  }> {
    const query = new URLSearchParams();
    if (params?.owner) query.append('owner', params.owner);
    if (params?.repo) query.append('repo', params.repo);
    if (params?.repositoryId) query.append('repositoryId', params.repositoryId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/reviews/pr${queryString}`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to fetch PR reviews');
    }

    return data;
  },

  /**
   * GET /api/reviews/pr/:owner/:repo/:prNumber
   * Fetch single PR review
   */
  async getPRReview(owner: string, repo: string, prNumber: number | string): Promise<{
    success: boolean;
    review: PRReview;
  }> {
    const res = await fetch(`${API_BASE_URL}/reviews/pr/${owner}/${repo}/${prNumber}`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to fetch PR review');
    }

    return data;
  },

  /**
   * POST /api/reviews/pr/analyze
   * Trigger or re-run review for a Pull Request
   */
  async triggerPRReview(params: {
    owner: string;
    repo: string;
    prNumber: number;
    force?: boolean;
  }): Promise<{
    success: boolean;
    cached?: boolean;
    review: PRReview;
  }> {
    const res = await fetch(`${API_BASE_URL}/reviews/pr/analyze`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to analyze pull request');
    }

    return data;
  },

  /**
   * GET /api/settings
   * Retrieve user settings & system metadata
   */
  async getSettings(): Promise<{
    success: boolean;
    user?: GitHubUser | null;
    settings: {
      aiAnalysis: {
        severityThreshold: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
        securityAnalysis: boolean;
        bugDetection: boolean;
        performanceAnalysis: boolean;
        maintainabilityAnalysis: boolean;
      };
      prReview: {
        autoReview: boolean;
        reviewOpened: boolean;
        reviewSynchronize: boolean;
        reviewReopened: boolean;
      };
      notifications: {
        reviewCompleted: boolean;
        criticalSecurityDetected: boolean;
        highRiskPRDetected: boolean;
      };
    };
    systemInfo: {
      ai: {
        provider: string;
        model: string;
        status: string;
        apiKeyConfigured: boolean;
      };
      rag: {
        vectorDatabase: string;
        embeddingProvider: string;
        embeddingDimension: number;
        indexType: string;
      };
      security: {
        webhookVerification: boolean;
        codeExecution: boolean;
        secretProtection: boolean;
        apiKeyProtection: boolean;
      };
    };
    updatedAt?: string | null;
  }> {
    const res = await fetch(`${API_BASE_URL}/settings`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to fetch settings');
    }
    return data;
  },

  /**
   * PUT /api/settings
   * Update user settings in database
   */
  async updateSettings(settings: any): Promise<{
    success: boolean;
    message?: string;
    settings: any;
    updatedAt?: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(settings),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to save settings');
    }
    return data;
  },

  /**
   * POST /api/settings/reset
   * Reset user settings to defaults
   */
  async resetSettings(): Promise<{
    success: boolean;
    message?: string;
    settings: any;
  }> {
    const res = await fetch(`${API_BASE_URL}/settings/reset`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to reset settings');
    }
    return data;
  },

  /**
   * POST /api/settings/clear-index
   * Danger Zone: Clear indexed repository chunks and records
   */
  async clearIndexedData(): Promise<{
    success: boolean;
    message?: string;
    chunksDeleted?: number;
    repositoriesDeleted?: number;
  }> {
    const res = await fetch(`${API_BASE_URL}/settings/clear-index`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to clear indexed codebase data');
    }
    return data;
  },

  /**
   * POST /api/security/scan
   * Run or retrieve cached security scan
   */
  async runSecurityScan(params: {
    owner: string;
    repo: string;
    branch?: string;
    commitSha?: string;
    force?: boolean;
    files?: Array<{ path: string; content: string }>;
  }): Promise<{
    success: boolean;
    scan: SecurityScan;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/security/scan`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Security scan failed');
    }
    return data;
  },

  /**
   * GET /api/security/:owner/:repo
   * Retrieve latest security scan for repository
   */
  async getSecurityScan(owner: string, repo: string): Promise<{
    success: boolean;
    scan: SecurityScan | null;
    message?: string;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/security/${owner}/${repo}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch security scan');
    }
    return data;
  },

  /**
   * GET /api/security/:owner/:repo/findings
   * Retrieve security findings with filters
   */
  async getSecurityFindings(
    owner: string,
    repo: string,
    filters?: {
      severity?: string;
      category?: string;
      file?: string;
      search?: string;
      scanId?: number | string;
    }
  ): Promise<{
    success: boolean;
    count: number;
    findings: SecurityFinding[];
    scanId?: number;
    error?: string;
  }> {
    const query = new URLSearchParams();
    if (filters?.severity) query.set('severity', filters.severity);
    if (filters?.category) query.set('category', filters.category);
    if (filters?.file) query.set('file', filters.file);
    if (filters?.search) query.set('search', filters.search);
    if (filters?.scanId) query.set('scanId', String(filters.scanId));

    const res = await fetch(`${API_BASE_URL}/security/${owner}/${repo}/findings?${query.toString()}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch security findings');
    }
    return data;
  },

  /**
   * POST /api/security/findings/:findingId/fix
   * Generate or retrieve AI fix recommendation for finding
   */
  async generateFindingFix(findingId: number | string): Promise<{
    success: boolean;
    fix: FixSuggestion;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/security/findings/${findingId}/fix`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to generate AI fix');
    }
    return data;
  },

  // ====================================================
  // UPGRADE 2 API METHODS (Architecture, Health, Debt, Search)
  // ====================================================

  /**
   * POST /api/architecture/analyze
   */
  async analyzeArchitecture(params: {
    owner: string;
    repo: string;
    branch?: string;
    force?: boolean;
  }): Promise<ArchitectureScan> {
    const res = await fetch(`${API_BASE_URL}/architecture/analyze`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to analyze architecture');
    }
    return data;
  },

  /**
   * GET /api/architecture/:owner/:repo
   */
  async getArchitecture(owner: string, repo: string): Promise<ArchitectureScan & { needsScan?: boolean }> {
    const res = await fetch(`${API_BASE_URL}/architecture/${owner}/${repo}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 404 && data.needsScan) {
        return { needsScan: true } as any;
      }
      throw new Error(data.error || data.message || 'Failed to fetch architecture');
    }
    return data;
  },

  /**
   * GET /api/architecture/:owner/:repo/components
   */
  async getArchitectureComponents(owner: string, repo: string): Promise<ArchitectureComponent[]> {
    const res = await fetch(`${API_BASE_URL}/architecture/${owner}/${repo}/components`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch components');
    }
    return data.components || [];
  },

  /**
   * POST /api/technical-debt/scan
   */
  async scanTechnicalDebt(params: {
    owner: string;
    repo: string;
    branch?: string;
    force?: boolean;
  }): Promise<{
    success: boolean;
    totalFindings: number;
    findings: TechnicalDebtFinding[];
    complexityMetrics?: CodeComplexityMetrics;
    isCached?: boolean;
  }> {
    const res = await fetch(`${API_BASE_URL}/technical-debt/scan`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to scan technical debt');
    }
    return data;
  },

  /**
   * GET /api/technical-debt/:owner/:repo
   */
  async getTechnicalDebt(
    owner: string,
    repo: string,
    filters?: { severity?: string; category?: string; file?: string }
  ): Promise<{
    success: boolean;
    stats: TechnicalDebtStats;
    findings: TechnicalDebtFinding[];
  }> {
    const query = new URLSearchParams();
    if (filters?.severity) query.set('severity', filters.severity);
    if (filters?.category) query.set('category', filters.category);
    if (filters?.file) query.set('file', filters.file);

    const res = await fetch(`${API_BASE_URL}/technical-debt/${owner}/${repo}?${query.toString()}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch technical debt');
    }
    return data;
  },

  /**
   * GET /api/technical-debt/:owner/:repo/complexity
   */
  async getComplexity(owner: string, repo: string, branch?: string): Promise<CodeComplexityMetrics> {
    const query = branch ? `?branch=${encodeURIComponent(branch)}` : '';
    const res = await fetch(`${API_BASE_URL}/technical-debt/${owner}/${repo}/complexity${query}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to compute complexity');
    }
    return data.complexity;
  },

  /**
   * GET /api/codebase/health/:owner/:repo
   */
  async getCodebaseHealth(
    owner: string,
    repo: string,
    force?: boolean
  ): Promise<{
    success: boolean;
    repositoryId: string;
    scores: CodebaseHealthScores;
    scoreExplanations: ScoreExplanations;
    trends: HealthTrends;
    isCached?: boolean;
    createdAt?: string;
  }> {
    const query = force ? '?force=true' : '';
    const res = await fetch(`${API_BASE_URL}/codebase/health/${owner}/${repo}${query}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch codebase health');
    }
    return data;
  },

  /**
   * POST /api/codebase/explain
   */
  async explainCode(params: {
    repositoryId?: string;
    filePath?: string;
    codeSnippet?: string;
    functionName?: string;
    owner?: string;
    repo?: string;
  }): Promise<CodeExplanationResult> {
    const res = await fetch(`${API_BASE_URL}/codebase/explain`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to explain code');
    }
    return data;
  },

  /**
   * GET /api/codebase/search
   */
  async searchCodebase(params: {
    repositoryId: string;
    query: string;
    type?: string;
    limit?: number;
  }): Promise<{
    total: number;
    repositoryId: string;
    query: string;
    type: string;
    results: CodebaseSearchResult[];
  }> {
    const queryParams = new URLSearchParams({
      repositoryId: params.repositoryId,
      q: params.query,
      type: params.type || 'all',
      limit: String(params.limit || 25),
    });

    const res = await fetch(`${API_BASE_URL}/codebase/search?${queryParams.toString()}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to search codebase');
    }
    return data;
  },

  // ========================================================
  // FEATURE 1 — IMPACT ANALYSIS / BLAST RADIUS
  // ========================================================
  async analyzeImpact(params: {
    owner: string;
    repo: string;
    targetFile: string;
    targetSymbol?: string;
    branch?: string;
    prNumber?: number;
    force?: boolean;
  }): Promise<{ success: boolean; analysis: ImpactAnalysisResult; cached?: boolean }> {
    const res = await fetch(`${API_BASE_URL}/intelligence/impact`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to analyze change impact');
    }
    return data;
  },

  async getImpactAnalyses(
    owner: string,
    repo: string,
    targetFile?: string
  ): Promise<{ success: boolean; count: number; analyses: ImpactAnalysisResult[] }> {
    const url = new URL(`${API_BASE_URL}/intelligence/impact/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, window.location.origin);
    if (targetFile) url.searchParams.set('targetFile', targetFile);
    const res = await fetch(url.toString(), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch impact analyses');
    }
    return data;
  },

  // ========================================================
  // FEATURE 2 — AI DEBUGGER / ROOT CAUSE ANALYSIS
  // ========================================================
  async debugError(params: {
    owner: string;
    repo: string;
    errorMessage: string;
    stackTrace?: string;
    failingFile?: string;
    logs?: string;
  }): Promise<{ success: boolean; session?: DebugSession; rootCause?: string; error?: string; evidence?: any[]; affectedFiles?: string[]; recommendedFix?: string; confidence?: 'HIGH' | 'MEDIUM' | 'LOW'; regressionTests?: string }> {
    const res = await fetch(`${API_BASE_URL}/intelligence/debug`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to debug error');
    }
    return data;
  },

  async getDebugSessions(
    owner: string,
    repo: string
  ): Promise<{ success: boolean; count: number; sessions: DebugSession[] }> {
    const res = await fetch(`${API_BASE_URL}/intelligence/debug/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch debug sessions');
    }
    return data;
  },

  // ========================================================
  // FEATURE 3 — API CONTRACT GUARDIAN
  // ========================================================
  async checkApiContracts(params: {
    owner: string;
    repo: string;
    baseCommit?: string;
    headCommit?: string;
    prNumber?: number;
    files?: Array<{ filename: string; content?: string; patch?: string }>;
  }): Promise<{ success: boolean } & ApiContractCheckResult> {
    const res = await fetch(`${API_BASE_URL}/intelligence/api-contract`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to check API contracts');
    }
    return data;
  },

  async getApiContractFindings(
    owner: string,
    repo: string,
    prNumber?: number
  ): Promise<{ success: boolean; count: number; findings: ApiContractFinding[] }> {
    const url = new URL(`${API_BASE_URL}/intelligence/api-contract/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, window.location.origin);
    if (prNumber) url.searchParams.set('prNumber', String(prNumber));
    const res = await fetch(url.toString(), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch API contract findings');
    }
    return data;
  },

  // ========================================================
  // FEATURE 4 — DATABASE MIGRATION RISK ANALYZER
  // ========================================================
  async analyzeDatabaseRisk(params: {
    owner: string;
    repo: string;
    migrationSql?: string;
    migrationFile?: string;
    commitSha?: string;
    prNumber?: number;
  }): Promise<{ success: boolean } & DatabaseRiskCheckResult> {
    const res = await fetch(`${API_BASE_URL}/intelligence/database-risk`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to analyze database migration risk');
    }
    return data;
  },

  async getDatabaseRiskFindings(
    owner: string,
    repo: string
  ): Promise<{ success: boolean; count: number; findings: DatabaseRiskFinding[] }> {
    const res = await fetch(`${API_BASE_URL}/intelligence/database-risk/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch database risk findings');
    }
    return data;
  },

  // ========================================================
  // FEATURE 5 — AI TEST + REGRESSION TEST GENERATOR
  // ========================================================
  async generateTests(params: {
    owner: string;
    repo: string;
    targetFile?: string;
    targetSymbol?: string;
    codeSnippet?: string;
    findingContext?: string;
    testType?: 'unit' | 'edge_cases' | 'security' | 'regression';
  }): Promise<{ success: boolean; test?: GeneratedTestResult } & Partial<GeneratedTestResult>> {
    const res = await fetch(`${API_BASE_URL}/intelligence/generate-test`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to generate tests');
    }
    return data;
  },

  // ========================================================
  // UNIFIED PR ENGINEERING INSIGHTS
  // ========================================================
  async getPrEngineeringInsights(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PrEngineeringInsights> {
    const res = await fetch(
      `${API_BASE_URL}/intelligence/insights/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(prNumber)}`,
      {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to fetch PR engineering insights');
    }
    return data;
  },
};

export default api;

