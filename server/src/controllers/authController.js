import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { githubService } from '../services/githubService.js';

export const authController = {
  /**
   * Redirects user to GitHub OAuth login page
   */
  githubLogin(req, res) {
    try {
      if (!config.github.clientId || !config.github.clientSecret) {
        return res.redirect(
          `${config.clientUrl}/login?error=oauth_not_configured&message=Please+set+GITHUB_CLIENT_ID+and+GITHUB_CLIENT_SECRET+in+server/.env`
        );
      }

      const state = Math.random().toString(36).substring(7);
      const url = githubService.getOAuthUrl(state);
      res.redirect(url);
    } catch (err) {
      console.error('[authController.githubLogin] Error:', err.message);
      res.redirect(`${config.clientUrl}/login?error=oauth_init_failed&message=${encodeURIComponent(err.message)}`);
    }
  },

  /**
   * Handles GitHub OAuth callback, exchanges code, and issues secure HTTP-only cookie
   */
  async githubCallback(req, res) {
    const { code, error, error_description } = req.query;

    if (error) {
      console.error('[authController.githubCallback] OAuth error from GitHub:', error, error_description);
      return res.redirect(
        `${config.clientUrl}/login?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || '')}`
      );
    }

    if (!code) {
      return res.redirect(`${config.clientUrl}/login?error=missing_code&message=No+authorization+code+received`);
    }

    try {
      // 1. Exchange code for access token
      const accessToken = await githubService.exchangeCodeForToken(code);

      // 2. Fetch authenticated GitHub profile
      const user = await githubService.getUserProfile(accessToken);

      // 3. Create secure JWT session (containing user profile & access token)
      const token = jwt.sign(
        {
          user,
          accessToken,
        },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      // 4. Set secure HTTP-only cookie (Never accessible via client JavaScript)
      res.cookie(config.cookieName, token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // 5. Redirect to frontend dashboard
      res.redirect(`${config.clientUrl}/dashboard`);
    } catch (err) {
      console.error('[authController.githubCallback] Error:', err.message);
      res.redirect(`${config.clientUrl}/login?error=callback_failed&message=${encodeURIComponent(err.message)}`);
    }
  },

  /**
   * Returns current authenticated user profile without exposing token
   */
  getMe(req, res) {
    res.json({
      authenticated: true,
      user: req.user,
    });
  },

  /**
   * Logs out user by clearing the HTTP-only session cookie
   */
  logout(req, res) {
    res.clearCookie(config.cookieName, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  },
};

export default authController;
