/**
 * Secret Detector & Safe Masking Service
 * Detects hardcoded secrets, credentials, tokens, and keys without ever logging or exposing raw values.
 */

// Safe masking of secret values: e.g. "sk-****91ab"
export function maskSecret(secret) {
  if (!secret || typeof secret !== 'string') return '****';
  const s = secret.trim().replace(/^['"]|['"]$/g, '');
  if (s.length <= 8) {
    return s.length > 2 ? `${s[0]}****${s[s.length - 1]}` : '****';
  }

  // Preserve recognized provider prefixes
  const prefixMatch = s.match(/^(sk_live_|sk_test_|rk_live_|ghp_|github_pat_|gho_|xoxb-|xoxp-|AIza|AKIA|sk-)/);
  if (prefixMatch) {
    const prefix = prefixMatch[0];
    const suffix = s.slice(-4);
    return `${prefix}****${suffix}`;
  }

  // Default masking: first 3 characters + **** + last 4 characters
  return `${s.slice(0, 3)}****${s.slice(-4)}`;
}

/**
 * Mask raw secret occurrences inside a code snippet line
 */
export function maskSnippet(snippet, rawSecret, maskedSecret) {
  if (!snippet || !rawSecret) return snippet || '';
  return snippet.split(rawSecret).join(maskedSecret);
}

// Ignore common placeholder terms in template configs
const PLACEHOLDER_VALUES = new Set([
  'your_secret_here',
  'your_api_key_here',
  'your_password',
  'password123',
  'changeme',
  'change_me',
  'placeholder',
  'dummy_key',
  'example_key',
  'test_token',
  '12345678',
  'secret_token_here',
]);

/**
 * Checks if a candidate secret is just an environment variable reference or harmless template
 */
function isHarmlessPlaceholder(candidate, rawLine) {
  if (!candidate) return true;
  const lower = candidate.toLowerCase();
  if (PLACEHOLDER_VALUES.has(lower)) return true;
  if (rawLine.includes('process.env.') || rawLine.includes('System.getenv') || rawLine.includes('os.environ')) {
    return true;
  }
  if (lower.startsWith('env[') || lower.startsWith('$') || lower.includes('example.com')) {
    return true;
  }
  return false;
}

/**
 * Scans a file's content line-by-line for high-fidelity secrets
 */
export function scanFileForSecrets(filePath, content) {
  if (!content || typeof content !== 'string') return [];

  const findings = [];
  const lines = content.split('\n');

  // Rule definitions
  const rules = [
    {
      type: 'Private Key',
      category: 'Hardcoded Secrets',
      severity: 'CRITICAL',
      title: 'Hardcoded Private Cryptographic Key',
      regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
      extract: (m) => m[0],
      impact: 'Allows malicious actors to impersonate the service, decrypt sensitive TLS/SSL traffic, or forge digital signatures.',
      recommendation: 'Store private keys securely in KMS or Secret Manager. Never commit private keys to source control.',
    },
    {
      type: 'AWS Access Key',
      category: 'Cloud Credentials',
      severity: 'CRITICAL',
      title: 'Hardcoded AWS Access Key ID Exposed',
      regex: /\b(AKIA[0-9A-Z]{16})\b/,
      extract: (m) => m[1],
      impact: 'Allows unauthorized access to cloud infrastructure, bucket exfiltration, and unexpected resource provisioning.',
      recommendation: 'Revoke this access key in AWS IAM immediately and use AWS IAM Roles or environment secrets.',
    },
    {
      type: 'GitHub Token',
      category: 'API Key Exposure',
      severity: 'CRITICAL',
      title: 'Exposed GitHub Personal Access / OAuth Token',
      regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}|gho_[a-zA-Z0-9]{36})\b/,
      extract: (m) => m[1],
      impact: 'Grants unauthorized access to repository source code, pull requests, releases, and organization settings.',
      recommendation: 'Revoke and rotate the token in GitHub Developer Settings. Store tokens only in environment variables.',
    },
    {
      type: 'Google / Gemini API Key',
      category: 'API Key Exposure',
      severity: 'HIGH',
      title: 'Hardcoded Google / Gemini API Key',
      regex: /\b(AIza[0-9A-Za-z\-_]{35})\b/,
      extract: (m) => m[1],
      impact: 'May allow unauthorized AI generation quota usage, Google Cloud API billing charges, or project data access.',
      recommendation: 'Restrict the key to specific HTTP referrers / IP addresses in Google Cloud Console, and store in .env.',
    },
    {
      type: 'OpenAI / AI Service Key',
      category: 'API Key Exposure',
      severity: 'HIGH',
      title: 'Hardcoded OpenAI / AI Service API Key',
      regex: /\b(sk-[a-zA-Z0-9\-_]{24,})\b/,
      extract: (m) => m[1],
      impact: 'Enables external actors to exhaust API credits, read model logs, or abuse AI endpoints.',
      recommendation: 'Rotate the API key in the provider dashboard and configure GEMINI_API_KEY / OPENAI_API_KEY in server/.env.',
    },
    {
      type: 'Stripe Secret Key',
      category: 'Hardcoded Secrets',
      severity: 'CRITICAL',
      title: 'Exposed Stripe Secret / Restricted Key',
      regex: /\b((?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24,})\b/,
      extract: (m) => m[1],
      impact: 'Direct access to payment processing, customer financial records, and unauthorized charge or refund actions.',
      recommendation: 'Immediately roll key in Stripe Dashboard and migrate to Stripe Webhook signing secrets.',
    },
    {
      type: 'Slack Token',
      category: 'Hardcoded Secrets',
      severity: 'HIGH',
      title: 'Hardcoded Slack Bot / User Token',
      regex: /\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b/,
      extract: (m) => m[1],
      impact: 'Permits reading internal workspace chat history, posting unauthorized messages, or querying Slack workspaces.',
      recommendation: 'Revoke the token in Slack App Management and rotate credentials.',
    },
    {
      type: 'Database Credentials',
      category: 'Database Credentials',
      severity: 'CRITICAL',
      title: 'Database Connection String with Plaintext Password',
      regex: /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[^:\s]+:([^@\s]+)@[^\s'"]+/,
      extract: (m) => m[1],
      impact: 'Direct database exfiltration, unauthorized table modification, or ransomware destruction.',
      recommendation: 'Externalize DATABASE_URL to a secure environment variable and restrict database port access via firewall.',
    },
    {
      type: 'JWT Secret',
      category: 'Insecure Authentication',
      severity: 'HIGH',
      title: 'Hardcoded JWT Secret String',
      regex: /(?:jwt_?secret|jwtSecret|token_?secret)\s*[:=]\s*['"]([a-zA-Z0-9!@#$%^&*_\-.]{8,})['"]/i,
      extract: (m) => m[1],
      impact: 'Enables attackers to forge arbitrary authentication tokens and elevate privileges to administrator status.',
      recommendation: 'Supply JWT_SECRET via environment variable with at least 256 bits of cryptographically random entropy.',
    },
    {
      type: 'Hardcoded Password',
      category: 'Hardcoded Secrets',
      severity: 'HIGH',
      title: 'Hardcoded Password in Source Code',
      regex: /(?:password|passwd|db_password)\s*[:=]\s*['"]([^'"\s]{8,})['"]/i,
      extract: (m) => m[1],
      impact: 'Hardcoded passwords lead to unauthorized system access when repositories are inspected or shared.',
      recommendation: 'Remove plaintext passwords. Use environment configurations, credential stores, or IAM authentication.',
    },
    {
      type: 'Generic API Key',
      category: 'API Key Exposure',
      severity: 'HIGH',
      title: 'Hardcoded Generic API Key / Secret',
      regex: /(?:api[_-]?key|client[_-]?secret|auth[_-]?token)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{16,})['"]/i,
      extract: (m) => m[1],
      impact: 'Third-party API abuse, impersonation, or compromised service integrations.',
      recommendation: 'Move secret key to a protected .env file and add .env to .gitignore.',
    },
  ];

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    const trimmed = lineText.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
      // Allow comment scanning only if it contains real tokens
      if (!/(?:AKIA|ghp_|sk-|AIza|sk_live_)/.test(trimmed)) return;
    }

    for (const rule of rules) {
      const match = trimmed.match(rule.regex);
      if (match) {
        const rawSecret = rule.extract(match);
        if (!isHarmlessPlaceholder(rawSecret, trimmed)) {
          const masked = maskSecret(rawSecret);
          const safeSnippet = maskSnippet(trimmed, rawSecret, masked);

          findings.push({
            severity: rule.severity,
            category: rule.category,
            title: rule.title,
            file: filePath,
            line: lineNum,
            description: `Potential plaintext ${rule.type} detected on line ${lineNum}. Secret value has been masked for safety: ${masked}`,
            impact: rule.impact,
            recommendation: rule.recommendation,
            confidence: 'HIGH',
            codeSnippet: safeSnippet,
            isSecret: true,
            maskedSecret: masked,
            secretType: rule.type,
          });
          break; // Avoid double-flagging same line
        }
      }
    }
  });

  return findings;
}

export const secretDetector = {
  maskSecret,
  maskSnippet,
  scanFileForSecrets,
};

export default secretDetector;
