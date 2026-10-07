import { EmbeddingProvider } from './EmbeddingProvider.js';
import { config } from '../../config/index.js';

export class OpenAIEmbeddingProvider extends EmbeddingProvider {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || config.ai.openaiApiKey || process.env.OPENAI_API_KEY || '';
    this.modelName = options.modelName || 'text-embedding-3-small';
    this.dimension = options.dimension || 768; // text-embedding-3-small supports dimensions parameter
  }

  getProviderName() {
    return 'openai';
  }

  getDimension() {
    return this.dimension;
  }

  async embedText(text) {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in server/.env');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey.trim()}`,
      },
      body: JSON.stringify({
        input: text.slice(0, 8000),
        model: this.modelName,
        dimensions: this.dimension,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI embedding failed (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async embedBatch(texts) {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in server/.env');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey.trim()}`,
      },
      body: JSON.stringify({
        input: texts.map((t) => t.slice(0, 8000)),
        model: this.modelName,
        dimensions: this.dimension,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI batch embedding failed (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.data.map((item) => item.embedding);
  }
}

export default OpenAIEmbeddingProvider;
