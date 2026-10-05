import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import routes from './routes/index.js';

const app = express();

// CORS configuration for cookies & credentials
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(cookieParser());
app.use(express.json());

// API Routes
app.use('/api', routes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'AI Code Reviewer API server is running.',
    oauthConfigured: Boolean(config.github.clientId && config.github.clientSecret),
    timestamp: new Date().toISOString(),
  });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err.stack || err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`[AI Code Reviewer API] Server listening on http://localhost:${config.port}`);
    console.log(`[AI Code Reviewer API] GitHub OAuth Callback URL: ${config.github.callbackUrl}`);
    if (!config.github.clientId || !config.github.clientSecret) {
      console.warn('⚠️  [Warning] GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not configured in server/.env.');
    }
  });
}

export default app;
