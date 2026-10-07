import './config/loadEnv.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { initDb } from './db/index.js';

const app = express();

let dbInitialized = false;

// CORS configuration for cookies & credentials
const allowedOrigins = config.clientUrl
  ? config.clientUrl.split(',').map((u) => u.trim())
  : ['http://localhost:5173'];

if (config.nodeEnv === 'production' && allowedOrigins.includes('*')) {
  throw new Error('FATAL: CORS wildcard origin ("*") cannot be used with credentials in production.');
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-hub-signature-256'],
  })
);

app.use(cookieParser());
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
    limit: '10mb',
  })
);

// API Routes
app.use('/api', routes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  if (!dbInitialized) {
    try {
      await initDb();
      dbInitialized = true;
    } catch {
      // Database still not reachable
    }
  }

  res.json({
    status: 'healthy',
    message: 'AI Code Reviewer API server is running.',
    oauthConfigured: Boolean(config.github.clientId && config.github.clientSecret),
    databaseConfigured: dbInitialized,
    timestamp: new Date().toISOString(),
  });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err.stack || err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'production' ? 'Internal server error occurred.' : err.message,
  });
});

if (process.env.NODE_ENV !== 'test') {
  initDb()
    .then(() => {
      dbInitialized = true;
    })
    .catch((dbErr) => {
      const errMsg = dbErr.message || (dbErr.errors && dbErr.errors[0]?.message) || dbErr.code || String(dbErr);
      console.warn('⚠️  [Warning] PostgreSQL connection failed on startup:', errMsg);
    })
    .finally(() => {
      app.listen(config.port, () => {
        console.log(`[AI Code Reviewer API] Server listening on http://localhost:${config.port}`);
        console.log(`[AI Code Reviewer API] GitHub OAuth Callback URL: ${config.github.callbackUrl}`);
        if (!config.github.clientId || !config.github.clientSecret) {
          console.warn('⚠️  [Warning] GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not configured in server/.env.');
        } else {
          console.log('✅ [OAuth Ready] GitHub OAuth Client ID and Secret successfully loaded.');
        }
      });
    });
}

export default app;
