import './loadEnv.js';

const DEV_DEFAULT_JWT_SECRET = 'ai-code-reviewer-super-secret-jwt-key-2026';
const isProduction = process.env.NODE_ENV === 'production';

if (
  isProduction &&
  (!process.env.JWT_SECRET ||
    process.env.JWT_SECRET.trim() === '' ||
    process.env.JWT_SECRET === DEV_DEFAULT_JWT_SECRET)
) {
  throw new Error(
    'FATAL: In production, JWT_SECRET must be set to a secure, random string and cannot use the development default.'
  );
}

export const config = {
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || DEV_DEFAULT_JWT_SECRET,
  cookieName: 'acr_session',
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:5001/api/auth/github/callback',
    token: process.env.GITHUB_TOKEN || '',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    apiBaseUrl: 'https://api.github.com',
    scopes: ['read:user', 'user:email', 'repo'].join(' '),
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || 'acr_webhook_secret_development_2026',
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/code_reviewer',
  },
  rag: {
    embeddingDimension: 768,
    similarityThreshold: 0.12,
    topK: 6,
    maxContextTokens: 6000,
  },
  get geminiApiKey() { return this.ai.geminiApiKey; },
  get geminiModel() { return this.ai.geminiModel; },
  get githubClientId() { return this.github.clientId; },
  get githubClientSecret() { return this.github.clientSecret; },
  get githubWebhookSecret() { return this.github.webhookSecret; },
  get githubToken() { return this.github.token; },
  get databaseUrl() { return this.database.url; },
};

export default config;
