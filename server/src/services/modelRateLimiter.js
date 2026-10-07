/**
 * Model rate limiter and health tracker
 * Keeps track of models that returned HTTP 429 (quota exhaustion) to prevent
 * hammering them repeatedly on subsequent requests.
 */

class ModelRateLimiter {
  constructor() {
    // Map of modelName -> { until: timestamp, reason: string }
    this.rateLimitedModels = new Map();
    // Default cooldown if no Retry-After or retryDelay is provided (10 minutes)
    this.defaultCooldownMs = 10 * 60 * 1000;
  }

  /**
   * Check if a model is currently marked as rate-limited
   */
  isRateLimited(modelName) {
    if (!modelName) return false;
    const entry = this.rateLimitedModels.get(modelName);
    if (!entry) return false;

    if (Date.now() > entry.until) {
      // Cooldown expired
      this.rateLimitedModels.delete(modelName);
      return false;
    }
    return true;
  }

  /**
   * Mark a model as rate-limited with an optional delay in ms
   */
  markRateLimited(modelName, delayMs = null, reason = 'RESOURCE_EXHAUSTED') {
    if (!modelName) return;
    const cooldown = delayMs && delayMs > 0 ? delayMs : this.defaultCooldownMs;
    const until = Date.now() + cooldown;
    this.rateLimitedModels.set(modelName, { until, reason });
    const minutes = Math.round(cooldown / 60000);
    console.warn(`[ModelRateLimiter] Model "${modelName}" marked rate-limited for ${minutes} min (${reason}).`);
  }

  /**
   * Extract retry delay in ms from error or response payload if available
   */
  extractRetryDelay(errorOrBody) {
    try {
      if (typeof errorOrBody === 'string') {
        const match = errorOrBody.match(/retry(?:Delay)?["':\s]+(\d+)/i);
        if (match) return parseInt(match[1], 10) * 1000;
      }
      if (errorOrBody?.details) {
        for (const detail of errorOrBody.details) {
          if (detail.retryDelay) {
            const seconds = parseFloat(detail.retryDelay.replace('s', ''));
            if (!isNaN(seconds)) return Math.min(seconds * 1000, 3600 * 1000); // cap at 1 hour
          }
        }
      }
    } catch {
      // ignore parsing errors
    }
    return this.defaultCooldownMs;
  }

  /**
   * Filters and orders candidate models, skipping those currently rate-limited
   */
  getCandidateModels(preferredModel, fallbackModels = []) {
    const all = Array.from(new Set([preferredModel, ...fallbackModels])).filter(Boolean);
    const available = all.filter((m) => !this.isRateLimited(m));

    // If all models are marked rate limited (rare), allow all rather than blocking completely
    if (available.length === 0) {
      console.warn('[ModelRateLimiter] All candidate models marked rate limited. Resetting limits to attempt recovery.');
      this.rateLimitedModels.clear();
      return all;
    }

    return available;
  }

  /**
   * Clears all rate limited model entries
   */
  reset() {
    this.rateLimitedModels.clear();
  }
}

export const modelRateLimiter = new ModelRateLimiter();
export default modelRateLimiter;
