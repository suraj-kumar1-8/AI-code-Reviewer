import type { FeatureItem, MetricItem, StepItem, SecurityItem, Repository, CodeIssue } from '../types';

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Security', href: '#security' },
  { label: 'Pricing', href: '#pricing' },
];

export const HERO_METRICS: MetricItem[] = [
  { value: '10K+', label: 'Repositories Analyzed' },
  { value: '95%', label: 'Issue Detection Rate' },
  { value: '4.8/5', label: 'Developer Satisfaction' },
  { value: '100%', label: 'Secure & Private' },
];

export const FEATURES: FeatureItem[] = [
  {
    id: 'deep-analysis',
    title: 'Deep Code Analysis',
    description: 'AI understands your code and finds real issues across complexity, style, and architectural patterns.',
    icon: 'Shield',
  },
  {
    id: 'security-detection',
    title: 'Security Detection',
    description: 'Identify vulnerabilities, exposed secrets, and security risks before they reach production.',
    icon: 'Lock',
  },
  {
    id: 'performance-insights',
    title: 'Performance Insights',
    description: 'Find bottlenecks, memory leaks, and optimization opportunities to supercharge execution speed.',
    icon: 'LineChart',
  },
  {
    id: 'ask-codebase',
    title: 'Ask Your Codebase',
    description: 'Chat with your repository using AI-powered code understanding and semantic indexing.',
    icon: 'MessageSquare',
  },
];

export const HOW_IT_WORKS_STEPS: StepItem[] = [
  {
    step: '01',
    title: 'Connect GitHub',
    description: 'Link your GitHub account securely with fine-grained read-only permissions.',
    icon: 'Github',
  },
  {
    step: '02',
    title: 'Select Repository',
    description: 'Choose the repository or specific pull request you want to inspect.',
    icon: 'FolderGit2',
  },
  {
    step: '03',
    title: 'AI Analyzes Code',
    description: 'Multi-model inspection detects syntax, logic, security, and performance flaws.',
    icon: 'Sparkles',
  },
  {
    step: '04',
    title: 'Fix & Improve',
    description: 'Apply one-click refactoring suggestions and push verified improvements.',
    icon: 'CheckCircle2',
  },
];

export const SECURITY_FEATURES: SecurityItem[] = [
  {
    title: 'Secure GitHub OAuth',
    description: 'Read-only repository access with granular, revocable permissions.',
    icon: 'ShieldCheck',
  },
  {
    title: 'Private Analysis',
    description: 'Your source code is never used to train public models or exposed.',
    icon: 'Lock',
  },
  {
    title: 'Developer Control',
    description: 'You decide which repositories to analyze, branch by branch.',
    icon: 'Sliders',
  },
];

export const SAMPLE_REPOSITORIES: Repository[] = [
  {
    id: 'cloudshare',
    name: 'CloudShare',
    owner: 'surajdev',
    language: 'JavaScript',
    stars: 24,
    healthScore: 82,
    lastAnalyzed: '2 days ago',
    issueCounts: {
      security: 3,
      bugs: 2,
      performance: 2,
      quality: 3,
    }
  },
  {
    id: 'travelista',
    name: 'Travelista',
    owner: 'surajdev',
    language: 'PHP',
    stars: 18,
    healthScore: 76,
    lastAnalyzed: '5 days ago',
    issueCounts: {
      security: 4,
      bugs: 3,
      performance: 1,
      quality: 5,
    }
  },
  {
    id: 'dandiya',
    name: 'Dandiya',
    owner: 'surajdev',
    language: 'React',
    stars: 32,
    healthScore: 88,
    lastAnalyzed: '1 week ago',
    issueCounts: {
      security: 1,
      bugs: 1,
      performance: 1,
      quality: 2,
    }
  }
];

export const SAMPLE_ISSUES: CodeIssue[] = [
  {
    id: 'issue-1',
    title: 'Hardcoded API Key',
    category: 'security',
    severity: 'critical',
    filePath: 'src/config.js',
    lineNumber: 14,
    description: 'API key is directly exposed in source code instead of environment variables.',
    recommendation: 'Move credentials into a .env file and access via process.env.API_KEY.',
    codeSnippet: 'const STRIPE_SECRET = "sk_live_51M0...92bX";',
    fixedCodeSnippet: 'const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;'
  },
  {
    id: 'issue-2',
    title: 'Missing Error Handling in Async Controller',
    category: 'bugs',
    severity: 'medium',
    filePath: 'src/controllers/user.js',
    lineNumber: 42,
    description: 'Unhandled promise rejection can crash the Node runtime on DB disconnect.',
    recommendation: 'Wrap the await call in a try/catch block or use an async error middleware wrapper.',
    codeSnippet: 'const user = await User.findById(req.params.id);\nres.json(user);',
    fixedCodeSnippet: 'try {\n  const user = await User.findById(req.params.id);\n  res.json(user);\n} catch (err) {\n  next(err);\n}'
  },
  {
    id: 'issue-3',
    title: 'SQL Injection Risk',
    category: 'security',
    severity: 'medium',
    filePath: 'src/routes/auth.js',
    lineNumber: 28,
    description: 'User input is directly concatenated into SQL query.',
    recommendation: 'Use parameterized queries ($1, $2) or ORM sanitization.',
    codeSnippet: 'const query = "SELECT * FROM users WHERE id=" + userId;',
    fixedCodeSnippet: 'const query = "SELECT * FROM users WHERE id = $1";\nconst result = await db.query(query, [userId]);'
  },
  {
    id: 'issue-4',
    title: 'Memory Leak via Unbounded Event Listeners',
    category: 'performance',
    severity: 'medium',
    filePath: 'src/services/websocket.js',
    lineNumber: 67,
    description: 'Client listener is registered on every socket connect without removeListener cleanup.',
    recommendation: 'Clean up listener on socket "disconnect" event.',
    codeSnippet: 'socket.on("message", handleMessage);',
    fixedCodeSnippet: 'socket.on("message", handleMessage);\nsocket.once("disconnect", () => socket.off("message", handleMessage));'
  },
  {
    id: 'issue-5',
    title: 'Redundant DOM Re-renders',
    category: 'performance',
    severity: 'low',
    filePath: 'src/components/DataTable.tsx',
    lineNumber: 89,
    description: 'Complex array mapping executed inline on every state toggle without useMemo.',
    recommendation: 'Wrap calculated sorted data in useMemo([data, sortKey]).'
  },
  {
    id: 'issue-6',
    title: 'Implicit Any Return Type',
    category: 'quality',
    severity: 'low',
    filePath: 'src/utils/parser.ts',
    lineNumber: 12,
    description: 'Function parsePayload lacks explicit return type annotation.',
    recommendation: 'Add type annotation: parsePayload(data: unknown): ParsedPayload'
  },
  {
    id: 'issue-7',
    title: 'Unescaped Output in Template',
    category: 'security',
    severity: 'high',
    filePath: 'src/views/profile.ejs',
    lineNumber: 53,
    description: 'User bio is rendered with <%- bio %> instead of <%= bio %>, creating XSS exposure.',
    recommendation: 'Use <%= bio %> for HTML escaping or sanitize via DOMPurify.'
  }
];
