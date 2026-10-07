import { EmbeddingProvider } from './EmbeddingProvider.js';
import { MockEmbeddingProvider } from './MockEmbeddingProvider.js';
import { config } from '../../config/index.js';

export class GeminiEmbeddingProvider extends EmbeddingProvider {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || config.ai.geminiApiKey || process.env.GEMINI_API_KEY || '';
    this.modelName = options.modelName || 'gemini-embedding-001';
    this.dimension = options.dimension || 768;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.mockFallback = new MockEmbeddingProvider({ dimension: this.dimension });
  }

  getProviderName() {
    return 'gemini';
  }

  getDimension() {
    return this.dimension;
  }

  /**
   * Sanitizes text to remove null bytes and limit length for embedding
   */
  _prepareText(text) {
    if (!text || typeof text !== 'string') return 'empty';
    // Remove null bytes and limit to ~6000 characters per chunk
    return text.replace(/\0/g, '').slice(0, 6000);
  }

  /**
   * Embeds a single text string with exponential backoff retry on 429
   */
  async embedText(text, retries = 3) {
    const cleanText = this._prepareText(text);
    if (!this.apiKey) {
      console.warn('[GeminiEmbeddingProvider] No GEMINI_API_KEY configured. Using deterministic fallback.');
      return this.mockFallback.embedText(cleanText);
    }

    const url = `${this.baseUrl}/models/${this.modelName}:embedContent?key=${this.apiKey.trim()}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${this.modelName}`,
            content: { parts: [{ text: cleanText }] },
            outputDimensionality: this.dimension,
          }),
        });

        if (response.status === 429) {
          if (attempt < retries) {
            const delay = (attempt + 1) * 2000;
            console.warn(`[GeminiEmbeddingProvider] Rate limit (429) on embedContent. Retrying in ${delay}ms (attempt ${attempt + 1}/${retries})...`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          console.warn('[GeminiEmbeddingProvider] Quota/rate limit exceeded after retries. Using deterministic fallback embedding.');
          return this.mockFallback.embedText(cleanText);
        }

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[GeminiEmbeddingProvider] embedContent failed (${response.status}): ${errText.slice(0, 150)}`);
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          return this.mockFallback.embedText(cleanText);
        }

        const data = await response.json();
        const vector = data.embedding?.values;
        if (!Array.isArray(vector) || vector.length === 0) {
          return this.mockFallback.embedText(cleanText);
        }

        return vector;
      } catch (networkErr) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        console.warn(`[GeminiEmbeddingProvider] Network error: ${networkErr.message}. Using fallback vector.`);
        return this.mockFallback.embedText(cleanText);
      }
    }

    return this.mockFallback.embedText(cleanText);
  }

  /**
   * Embeds multiple text strings using Gemini batchEmbedContents endpoint with backoff & rate-pacing
   */
  async embedBatch(texts, retries = 3) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    if (!this.apiKey) {
      console.warn('[GeminiEmbeddingProvider] No GEMINI_API_KEY configured. Using deterministic fallback embeddings.');
      return this.mockFallback.embedBatch(texts);
    }

    // Google free tier allows max 100 requests per minute
    // Batch size of 15 ensures we stay well under limits
    const CHUNK_BATCH_SIZE = 15;
    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += CHUNK_BATCH_SIZE) {
      const slice = texts.slice(i, i + CHUNK_BATCH_SIZE);
      const requests = slice.map((t) => ({
        model: `models/${this.modelName}`,
        content: { parts: [{ text: this._prepareText(t) }] },
        outputDimensionality: this.dimension,
      }));

      const url = `${this.baseUrl}/models/${this.modelName}:batchEmbedContents?key=${this.apiKey.trim()}`;
      let batchSuccess = false;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests }),
          });

          if (response.status === 429) {
            if (attempt < retries) {
              const delay = (attempt + 1) * 2500;
              console.warn(`[GeminiEmbeddingProvider] Rate limit (429) on batchEmbedContents. Waiting ${delay}ms before retry...`);
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }
            console.warn('[GeminiEmbeddingProvider] Rate limit (429) persisted on batch. Falling back to individual requests with backoff...');
            break;
          }

          if (response.ok) {
            const data = await response.json();
            const embeddings = data.embeddings || [];
            if (embeddings.length === slice.length) {
              for (const item of embeddings) {
                allEmbeddings.push(item.values);
              }
              batchSuccess = true;
              break;
            }
          } else {
            const errText = await response.text();
            console.warn(`[GeminiEmbeddingProvider] Batch API error (${response.status}): ${errText.slice(0, 150)}`);
            if (attempt < retries) {
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            }
            break;
          }
        } catch (fetchErr) {
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          break;
        }
      }

      // If batch failed after retries, embed individually with backoff and graceful fallback
      if (!batchSuccess) {
        console.log(`[GeminiEmbeddingProvider] Processing slice of ${slice.length} chunks individually...`);
        for (const t of slice) {
          const vec = await this.embedText(t);
          allEmbeddings.push(vec);
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      // Add a polite 400ms delay between batch chunks to respect the 100 RPM quota
      if (i + CHUNK_BATCH_SIZE < texts.length) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    return allEmbeddings;
  }
}

export default GeminiEmbeddingProvider;
