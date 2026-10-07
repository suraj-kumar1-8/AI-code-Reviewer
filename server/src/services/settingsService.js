import db from '../db/index.js';
import { config } from '../config/index.js';

export const DEFAULT_SETTINGS = {
  aiAnalysis: {
    severityThreshold: 'LOW', // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
    securityAnalysis: true,
    bugDetection: true,
    performanceAnalysis: true,
    maintainabilityAnalysis: true,
  },
  prReview: {
    autoReview: true,
    reviewOpened: true,
    reviewSynchronize: true,
    reviewReopened: true,
  },
  notifications: {
    reviewCompleted: true,
    criticalSecurityDetected: true,
    highRiskPRDetected: true,
  },
};

export class SettingsService {
  /**
   * Retrieves settings for a user (or default global user) along with server status info
   */
  async getSettings(userId = 'default_user') {
    const key = (userId || 'default_user').toLowerCase();

    let userSettings = { ...DEFAULT_SETTINGS };
    let updatedAt = null;

    try {
      let res = await db.query('SELECT settings, updated_at FROM user_settings WHERE user_id = $1', [key]);
      
      // Fallback to default_user if specific owner has no custom overrides
      if (res.rows.length === 0 && key !== 'default_user') {
        res = await db.query('SELECT settings, updated_at FROM user_settings WHERE user_id = $1', ['default_user']);
      }

      if (res.rows.length > 0) {
        const saved = res.rows[0].settings || {};
        updatedAt = res.rows[0].updated_at;

        userSettings = {
          aiAnalysis: {
            ...DEFAULT_SETTINGS.aiAnalysis,
            ...(saved.aiAnalysis || {}),
          },
          prReview: {
            ...DEFAULT_SETTINGS.prReview,
            ...(saved.prReview || {}),
          },
          notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...(saved.notifications || {}),
          },
        };
      }
    } catch (err) {
      console.warn('[SettingsService] Error reading settings from DB, using defaults:', err.message);
    }

    // Server-managed metadata and status indicators (read-only, never sensitive)
    const systemInfo = {
      ai: {
        provider: 'Google Gemini',
        model: config.ai.geminiModel || 'gemini-3.1-flash-lite',
        status: 'Server managed',
        apiKeyConfigured: Boolean(config.ai.geminiApiKey),
      },
      rag: {
        vectorDatabase: 'PostgreSQL 16 + pgvector',
        embeddingProvider: 'gemini-embedding-001',
        embeddingDimension: config.rag?.embeddingDimension || 768,
        indexType: 'HNSW Cosine Distance (vector_cosine_ops)',
      },
      security: {
        webhookVerification: Boolean(config.github.webhookSecret),
        codeExecution: false, // Always Disabled: Static analysis only
        secretProtection: true, // Enabled: Sealed on server
        apiKeyProtection: true, // Enabled: Never exposed to client
      },
    };

    return {
      settings: userSettings,
      systemInfo,
      updatedAt,
    };
  }

  /**
   * Updates user settings in PostgreSQL
   */
  async updateSettings(userId = 'default_user', newSettings = {}) {
    const key = (userId || 'default_user').toLowerCase();

    // Fetch existing settings first
    const current = await this.getSettings(key);
    const merged = {
      aiAnalysis: {
        ...current.settings.aiAnalysis,
        ...(newSettings.aiAnalysis || {}),
      },
      prReview: {
        ...current.settings.prReview,
        ...(newSettings.prReview || {}),
      },
      notifications: {
        ...current.settings.notifications,
        ...(newSettings.notifications || {}),
      },
    };

    // Sanitize severityThreshold
    const validThresholds = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    if (!validThresholds.includes(merged.aiAnalysis.severityThreshold?.toUpperCase())) {
      merged.aiAnalysis.severityThreshold = 'LOW';
    } else {
      merged.aiAnalysis.severityThreshold = merged.aiAnalysis.severityThreshold.toUpperCase();
    }

    const query = `
      INSERT INTO user_settings (user_id, settings, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP
      RETURNING settings, updated_at;
    `;

    const res = await db.query(query, [key, JSON.stringify(merged)]);
    const saved = res.rows[0];

    return {
      settings: saved.settings,
      updatedAt: saved.updated_at,
    };
  }

  /**
   * Resets settings back to default
   */
  async resetSettings(userId = 'default_user') {
    const key = (userId || 'default_user').toLowerCase();
    const query = `
      INSERT INTO user_settings (user_id, settings, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP
      RETURNING settings, updated_at;
    `;

    const res = await db.query(query, [key, JSON.stringify(DEFAULT_SETTINGS)]);
    return {
      settings: res.rows[0].settings,
      updatedAt: res.rows[0].updated_at,
    };
  }

  /**
   * Danger zone: Clears indexed repository data from PostgreSQL + pgvector
   */
  async clearIndexedData() {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const chunksDeleted = await client.query('DELETE FROM code_chunks;');
      const reposDeleted = await client.query('DELETE FROM repositories;');
      await client.query('COMMIT');

      console.log(`[SettingsService] Cleared indexed data: ${chunksDeleted.rowCount} chunks, ${reposDeleted.rowCount} repositories.`);
      return {
        success: true,
        chunksDeleted: chunksDeleted.rowCount,
        repositoriesDeleted: reposDeleted.rowCount,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const settingsService = new SettingsService();
export default settingsService;
