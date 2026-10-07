import { GeminiEmbeddingProvider } from './GeminiEmbeddingProvider.js';
import { OpenAIEmbeddingProvider } from './OpenAIEmbeddingProvider.js';
import { MockEmbeddingProvider } from './MockEmbeddingProvider.js';
import { config } from '../../config/index.js';

export class EmbeddingService {
  constructor() {
    this.providers = new Map();
    this.activeProvider = null;
    this._initProviders();
  }

  _initProviders() {
    // 1. Register available providers
    const gemini = new GeminiEmbeddingProvider({
      apiKey: config.ai.geminiApiKey || process.env.GEMINI_API_KEY,
      dimension: config.rag.embeddingDimension || 768,
    });
    this.providers.set('gemini', gemini);

    const openai = new OpenAIEmbeddingProvider({
      apiKey: config.ai.openaiApiKey || process.env.OPENAI_API_KEY,
      dimension: config.rag.embeddingDimension || 768,
    });
    this.providers.set('openai', openai);

    const mock = new MockEmbeddingProvider({
      dimension: config.rag.embeddingDimension || 768,
    });
    this.providers.set('mock', mock);

    // 2. Select default provider
    if (config.ai.geminiApiKey && config.ai.geminiApiKey.trim()) {
      this.activeProvider = gemini;
    } else if (config.ai.openaiApiKey && config.ai.openaiApiKey.trim()) {
      this.activeProvider = openai;
    } else {
      console.warn('[EmbeddingService] No API key detected for Gemini or OpenAI. Using MockEmbeddingProvider.');
      this.activeProvider = mock;
    }

    console.log(`[EmbeddingService] Initialized with active provider: "${this.activeProvider.getProviderName()}" (${this.activeProvider.getDimension()} dims)`);
  }

  /**
   * Dynamically switch embedding provider
   * @param {string} providerName ('gemini' | 'openai' | 'mock')
   */
  setProvider(providerName) {
    const provider = this.providers.get(providerName.toLowerCase());
    if (!provider) {
      throw new Error(`Embedding provider "${providerName}" is not registered. Available: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    this.activeProvider = provider;
    console.log(`[EmbeddingService] Switched active provider to: "${provider.getProviderName()}"`);
    return this.activeProvider;
  }

  getActiveProviderName() {
    return this.activeProvider?.getProviderName() || 'none';
  }

  getDimension() {
    return this.activeProvider?.getDimension() || 768;
  }

  /**
   * Generates embedding for a single text string
   */
  async generateEmbedding(text) {
    if (!this.activeProvider) {
      throw new Error('No active embedding provider configured');
    }
    return this.activeProvider.embedText(text);
  }

  /**
   * Generates embeddings for an array of text strings
   */
  async generateBatchEmbeddings(texts) {
    if (!this.activeProvider) {
      throw new Error('No active embedding provider configured');
    }
    return this.activeProvider.embedBatch(texts);
  }
}

export const embeddingService = new EmbeddingService();
export default embeddingService;
