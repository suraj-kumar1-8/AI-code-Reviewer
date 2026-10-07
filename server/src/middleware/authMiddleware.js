import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = req.cookies?.[config.cookieName] || bearerToken;

  if (!token) {
    return res.status(401).json({
      authenticated: false,
      error: 'Authentication required. Please connect with GitHub.',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded.user;
    req.githubAccessToken = decoded.accessToken;
    next();
  } catch (err) {
    return res.status(401).json({
      authenticated: false,
      error: 'Invalid or expired session. Please log in again.',
    });
  }
};

export default authMiddleware;
