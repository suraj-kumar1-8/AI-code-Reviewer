import { settingsService } from '../services/settingsService.js';

export const settingsController = {
  /**
   * GET /api/settings
   * Retrieve current user settings and server metadata
   */
  async getSettings(req, res) {
    try {
      const userId = req.user?.login || 'default_user';
      const result = await settingsService.getSettings(userId);
      return res.status(200).json({
        success: true,
        user: req.user || null,
        ...result,
      });
    } catch (err) {
      console.error('[settingsController.getSettings Error]:', err.message);
      return res.status(500).json({
        error: 'Failed to retrieve settings',
        message: err.message,
      });
    }
  },

  /**
   * PUT /api/settings
   * Update user settings in database
   */
  async updateSettings(req, res) {
    try {
      const userId = req.user?.login || 'default_user';
      const { aiAnalysis, prReview, notifications } = req.body || {};

      const updated = await settingsService.updateSettings(userId, {
        aiAnalysis,
        prReview,
        notifications,
      });

      return res.status(200).json({
        success: true,
        message: 'Settings saved successfully',
        ...updated,
      });
    } catch (err) {
      console.error('[settingsController.updateSettings Error]:', err.message);
      return res.status(500).json({
        error: 'Failed to save settings',
        message: err.message,
      });
    }
  },

  /**
   * POST /api/settings/reset
   * Reset settings to default values
   */
  async resetSettings(req, res) {
    try {
      const userId = req.user?.login || 'default_user';
      const reset = await settingsService.resetSettings(userId);

      return res.status(200).json({
        success: true,
        message: 'Settings reset to default values',
        ...reset,
      });
    } catch (err) {
      console.error('[settingsController.resetSettings Error]:', err.message);
      return res.status(500).json({
        error: 'Failed to reset settings',
        message: err.message,
      });
    }
  },

  /**
   * POST /api/settings/clear-index
   * Danger Zone: Clears indexed repository chunks and records
   */
  async clearIndex(req, res) {
    try {
      const outcome = await settingsService.clearIndexedData();
      return res.status(200).json({
        success: true,
        message: 'Successfully cleared indexed codebase data',
        ...outcome,
      });
    } catch (err) {
      console.error('[settingsController.clearIndex Error]:', err.message);
      return res.status(500).json({
        error: 'Failed to clear index data',
        message: err.message,
      });
    }
  },
};

export default settingsController;
