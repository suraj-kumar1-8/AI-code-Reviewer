import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Optional authentication middleware:
 * Attaches user session if present, but does not block requests if not signed in
 */
export const optionalAuthMiddleware = (req, res, next) => {
  let token = req.cookies?.[config.cookieName];

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = decoded.user;
      req.githubAccessToken = decoded.accessToken;
    } catch (err) {
      // Invalid/expired token - continue as unauthenticated guest
      req.user = null;
      req.githubAccessToken = null;
    }
  }

  // Fallback to configured GITHUB_TOKEN if no user token present
  if (!req.githubAccessToken && (config.github?.token || process.env.GITHUB_TOKEN)) {
    req.githubAccessToken = config.github?.token || process.env.GITHUB_TOKEN;
  }

  next();
};

export default optionalAuthMiddleware;
