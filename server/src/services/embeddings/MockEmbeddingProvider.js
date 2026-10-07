import { EmbeddingProvider } from './EmbeddingProvider.js';

/**
 * Deterministic pseudo-embedding provider for local testing without external API keys.
 * Uses string hashing + sine projection normalized to unit sphere.
 */
export class MockEmbeddingProvider extends EmbeddingProvider {
  constructor(options = {}) {
    super();
    this.dimension = options.dimension || 768;
  }

  getProviderName() {
    return 'mock';
  }

  getDimension() {
    return this.dimension;
  }

  _hashTextToVector(text) {
    const vector = new Array(this.dimension);
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
      seed = (seed * 31 + text.charCodeAt(i)) & 0xffffffff;
    }

    let norm = 0;
    for (let i = 0; i < this.dimension; i++) {
      // Deterministic pseudo-random projection based on text seed
      const val = Math.sin(seed + i * 1.618033988749895);
      vector[i] = val;
      norm += val * val;
    }

    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < this.dimension; i++) {
      vector[i] = vector[i] / norm;
    }

    return vector;
  }

  async embedText(text) {
    return this._hashTextToVector(text);
  }

  async embedBatch(texts) {
    return texts.map((t) => this._hashTextToVector(t));
  }
}

export default MockEmbeddingProvider;
