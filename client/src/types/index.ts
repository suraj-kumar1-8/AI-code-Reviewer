import type { ReactNode } from 'react';

export type IssueSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'critical' | 'high' | 'medium' | 'low';
export type IssueCategory =
  | 'Security'
  | 'Bugs'
  | 'Performance'
  | 'Quality'
  | 'Error Handling'
  | 'Architecture'
  | 'Bad Practices'
  | 'Maintainability'
  | string;

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  bio?: string;
  location?: string;
  public_repos: number;
  total_private_repos?: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  owner_avatar?: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  visibility: 'public' | 'private';
  is_private: boolean;
  updated_at: string;
  html_url: string;
  default_branch: string;
  open_issues_count: number;
}

export interface CodeIssue {
  id: string;
  title: string;
  category: IssueCategory;
  severity: IssueSeverity;
  file?: string;
  filePath: string;
  line?: number;
  lineNumber: number;
  description: string;
  impact?: string;
  recommendation: string;
  suggestedFix?: string;
  codeSnippet?: string;
  fixedCodeSnippet?: string;
}

export interface ReviewStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ReviewMetrics {
  codeQuality: number;
  security: number;
  performance: number;
  maintainability: number;
}

export interface SourceFile {
  path: string;
  language: string;
  content: string;
  lineCount: number;
}

export interface ReviewResult {
  summary: string;
  score: number;
  stats?: ReviewStats;
  metrics: ReviewMetrics;
  issues: CodeIssue[];
  analyzedFilesCount: number;
  sourceFiles?: SourceFile[];
  repository?: {
    id?: number;
    owner: string;
    name: string;
    full_name?: string;
    default_branch?: string;
    targetBranch?: string;
    html_url?: string;
    stars?: number;
    forks?: number;
    language?: string;
  };
  timestamp?: string;
  cached?: boolean;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  language: string;
  stars: number;
  healthScore: number;
  lastAnalyzed: string;
  issueCounts: {
    security: number;
    bugs: number;
    performance: number;
    quality: number;
  };
}

export interface MetricItem {
  value: string;
  label: string;
  description?: string;
}

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface StepItem {
  step: string;
  title: string;
  description: string;
  icon: string;
}

export interface SecurityItem {
  title: string;
  description: string;
  icon: string;
}

export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

// Day 5 RAG "Ask Your Codebase" Types
export interface SourceReference {
  file: string;
  startLine: number;
  endLine: number;
  language: string;
  similarity: number;
  snippet?: string;
}

export interface AskMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceReference[];
  timestamp: string;
  isError?: boolean;
}

export interface CodebaseIndexResponse {
  success: boolean;
  isCached?: boolean;
  repositoryId: string;
  owner: string;
  repo: string;
  branch?: string;
  headCommitSha?: string;
  totalFiles: number;
  totalChunks: number;
  lastIndexedAt: string;
  message?: string;
  error?: string;
}

export interface CodebaseAskResponse {
  success: boolean;
  answer: string;
  sources: SourceReference[];
  repositoryId: string;
  repository?: {
    owner: string;
    repo: string;
    fullName?: string;
  };
  question: string;
  error?: string;
  needsIndexing?: boolean;
}

export interface CodebaseStatusResponse {
  isIndexed: boolean;
  repositoryId?: string;
  owner?: string;
  repo?: string;
  fullName?: string;
  branch?: string;
  headCommitSha?: string;
  totalFiles?: number;
  totalChunks?: number;
  lastIndexedAt?: string;
  error?: string;
}

export interface IndexedRepository {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  total_files: number;
  total_chunks: number;
  last_indexed_at: string;
}

export interface PRIssue {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  file: string;
  line?: number;
  title: string;
  description: string;
  recommendation: string;
  suggestedFix?: string;
  suggested_fix?: string;
}

export interface PRReview {
  id: string | number;
  repository_id: string;
  owner: string;
  repo: string;
  pr_number: number;
  pr_title: string;
  pr_author: string;
  commit_sha: string;
  action: string;
  status: string;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  summary: string;
  issues: PRIssue[];
  comment_id?: number | null;
  comment_url?: string | null;
  created_at: string;
  updated_at: string;
}

// Pro Security Scanner Types
export type SecuritySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface FixSuggestion {
  id?: number | string;
  findingId?: number | string;
  explanation: string;
  recommendedFix: string;
  beforeCode: string;
  afterCode: string;
  diff: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  model?: string;
  createdAt?: string;
  cached?: boolean;
}

export interface SecurityFinding {
  id: number | string;
  scanId?: number | string;
  repositoryId?: string;
  severity: SecuritySeverity;
  category: string;
  title: string;
  file: string;
  line: number;
  description: string;
  impact: string;
  recommendation: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  codeSnippet: string;
  isSecret: boolean;
  maskedSecret?: string | null;
  fingerprint?: string;
  hasFix?: boolean;
  fix?: FixSuggestion | null;
}

export interface SecurityScanStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  secrets: number;
}

export interface SecurityScan {
  id: number | string;
  repositoryId: string;
  owner: string;
  repo: string;
  commitSha: string;
  prNumber?: number | null;
  scannedBy?: string;
  status: string;
  score: number;
  stats: SecurityScanStats;
  filesScanned: number;
  summary: string;
  cached?: boolean;
  createdAt: string;
  findings?: SecurityFinding[];
}

// ====================================================
// UPGRADE 2 TYPES (Architecture, Debt, Health, Search)
// ====================================================

export interface ArchitectureComponent {
  id?: number | string;
  name: string;
  type: string;
  path?: string;
  description?: string;
  dependencies?: string[];
  createdAt?: string;
}

export interface DataFlowStep {
  step: number;
  from: string;
  to: string;
  protocol: string;
  description: string;
}

export interface ArchitecturalRisk {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  component: string;
  file?: string;
  line?: number;
  description: string;
  impact: string;
  recommendation: string;
  evidence?: string;
}

export interface ArchitectureScan {
  id?: number | string;
  scanId?: number | string;
  repositoryId: string;
  owner: string;
  repo: string;
  commitSha?: string;
  summary: string;
  techStack: string[];
  components: ArchitectureComponent[];
  dataFlow: DataFlowStep[];
  externalDependencies?: {
    externalApis?: string[];
    dependencies?: Array<{ name: string; version: string }>;
  };
  architecturalRisks: ArchitecturalRisk[];
  diagramMermaid: string;
  isCached?: boolean;
  createdAt: string;
}

export type DebtSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type DebtCategory =
  | 'Complexity'
  | 'Duplication'
  | 'Maintainability'
  | 'Architecture'
  | 'Error Handling'
  | 'Code Quality';
export type EstimatedEffort = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TechnicalDebtFinding {
  id: number | string;
  repositoryId: string;
  owner: string;
  repo: string;
  commitSha?: string;
  severity: DebtSeverity;
  category: DebtCategory;
  title: string;
  file: string;
  line: number;
  description: string;
  impact: string;
  recommendation: string;
  estimatedEffort: EstimatedEffort;
  codeSnippet?: string;
  fingerprint?: string;
  scannedBy?: string;
  createdAt?: string;
}

export interface TechnicalDebtStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byCategory: {
    Complexity: number;
    Duplication: number;
    Maintainability: number;
    Architecture: number;
    'Error Handling': number;
    'Code Quality': number;
  };
}

export interface MostComplexFile {
  path: string;
  complexityScore: number;
  lines: number;
  functionsCount: number;
  maxNestingDepth: number;
  highestFunctionComplexity: number;
}

export interface MostComplexFunction {
  name: string;
  file: string;
  line: number;
  cyclomaticComplexity: number;
  linesCount: number;
  parameterCount: number;
  nestingDepth: number;
}

export interface CodeComplexityMetrics {
  complexityScore: number;
  rawAverageComplexity: number;
  totalFilesAnalyzed: number;
  totalFunctionsAnalyzed: number;
  mostComplexFiles: MostComplexFile[];
  mostComplexFunctions: MostComplexFunction[];
}

export interface CodebaseHealthScores {
  overallHealth: number;
  security: number;
  maintainability: number;
  performance: number;
  reliability: number;
  codeQuality: number;
  complexity: number;
}

export interface ScoreExplanations {
  overallHealth: string;
  security: string;
  complexity: string;
  maintainability: string;
  reliability: string;
  performance: string;
  codeQuality: string;
}

export interface HealthTrends {
  hasTrends: boolean;
  totalHistoricalScans?: number;
  message?: string;
  history?: Array<{
    id: number | string;
    createdAt: string;
    overallHealth: number;
    security: number;
    maintainability: number;
    performance: number;
    reliability: number;
    codeQuality: number;
    complexity: number;
  }>;
  formattedTrends?: {
    overallHealth: string;
    security: string;
    maintainability: string;
    performance: string;
    reliability: string;
    codeQuality: string;
    complexity: string;
  };
  delta?: {
    overall: number;
    security: number;
    maintainability: number;
  };
}

export interface CodeExplanationResult {
  success: boolean;
  purpose?: string;
  inputs?: string[];
  outputs?: string[];
  importantLogic?: string[];
  dependencies?: string[];
  potentialRisks?: string[];
  improvementSuggestions?: string[];
  sourceReferences?: Array<{ file: string; lines: string }>;
  explanation?: string;
}

export interface CodebaseSearchResult {
  file: string;
  location: string;
  relevantCode: string;
  whyMatches: string;
  matchType: 'filename' | 'function' | 'class' | 'api' | 'symbol' | 'keyword' | string;
  score: number;
}

// ========================================================
// MASTER UPGRADE — 5 PRO DEVELOPER FEATURES TYPES
// ========================================================

export type ImpactRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ImpactCaller {
  file: string;
  line: number;
  callerFunction: string;
  snippet: string;
}

export interface ImpactAnalysisResult {
  id?: number | string;
  owner: string;
  repo: string;
  targetFile: string;
  targetSymbol?: string;
  impactLevel: ImpactRiskLevel;
  affectedFiles: string[];
  directCallers: ImpactCaller[];
  affectedEndpoints: string[];
  affectedComponents: string[];
  affectedTests: string[];
  directDependencies: string[];
  indirectDependencies: string[];
  databaseInteractions: string[];
  reasoning: string;
  recommendedChecks: string[];
  createdAt: string;
}

export interface DebugEvidence {
  file: string;
  lines: string;
  snippet: string;
}

export interface DebugSession {
  id?: number | string;
  owner: string;
  repo: string;
  errorMessage: string;
  errorType?: string;
  stackTrace?: string;
  failingFile?: string;
  rootCause: string;
  evidence: DebugEvidence[];
  affectedFiles: string[];
  recommendedFix: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  regressionTests: string;
  createdAt: string;
}

export interface ApiContractFinding {
  id?: number | string;
  owner: string;
  repo: string;
  endpoint: string;
  method: string;
  changeType: string;
  isBreaking: boolean;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  previousContract?: Record<string, unknown>;
  currentContract?: Record<string, unknown>;
  potentialConsumers: string[];
  recommendation: string;
  createdAt: string;
}

export interface ApiContractCheckResult {
  repositoryId: string;
  owner: string;
  repo: string;
  overallRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  totalEndpointsAnalyzed: number;
  breakingChangesCount: number;
  findings: ApiContractFinding[];
}

export interface DatabaseRiskReferences {
  backend: string[];
  frontend: string[];
  apis: string[];
  total: number;
}

export interface DatabaseRiskFinding {
  id?: number | string;
  repositoryId: string;
  owner: string;
  repo: string;
  migrationFile: string;
  operationType: string;
  targetTable: string;
  targetColumn?: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  detectedReferences: DatabaseRiskReferences;
  potentialImpact: string;
  recommendedAction: string;
  rawSql?: string;
  createdAt: string;
}

export interface DatabaseRiskCheckResult {
  repositoryId: string;
  owner: string;
  repo: string;
  migrationFile: string;
  overallRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  destructiveOperationsCount: number;
  totalOperationsAnalyzed: number;
  highRiskCount: number;
  findings: DatabaseRiskFinding[];
}

export interface GeneratedTestCase {
  name: string;
  type: string;
  description: string;
}

export interface GeneratedTestResult {
  id?: number | string;
  repositoryId: string;
  targetFile: string;
  targetSymbol?: string;
  framework: string;
  testType: string;
  testCode: string;
  explanation: string;
  testCases: GeneratedTestCase[];
  createdAt: string;
}

export interface PrEngineeringInsights {
  prNumber: number;
  repository: string;
  overallRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  issuesCount: number;
  changeImpact: string;
  apiContractBreakingChanges: number;
  databaseRiskLevel: string;
  securityIssuesCount: number;
  suggestedFixesCount: number;
  suggestedTestsCount: number;
  details?: {
    prReview?: { id: number; title: string; score: number } | null;
    impactAnalysis?: ImpactAnalysisResult | null;
    apiContractFindings?: ApiContractFinding[];
    databaseRiskFindings?: DatabaseRiskFinding[];
    securityFindingsCount?: number;
  };
}

