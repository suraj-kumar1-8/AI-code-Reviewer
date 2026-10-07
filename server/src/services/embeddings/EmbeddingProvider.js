/**
 * Base abstract class defining the contract for all Embedding Providers
 */
export class EmbeddingProvider {
  /**
   * Return unique provider name (e.g. 'gemini', 'openai', 'mock')
   * @returns {string}
   */
  getProviderName() {
    throw new Error('getProviderName() must be implemented by subclass');
  }

  /**
   * Return the vector dimensionality (e.g. 768)
   * @returns {number}
   */
  getDimension() {
    return 768;
  }

  /**
   * Generate an embedding vector for a single string
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async embedText(text) {
    throw new Error('embedText() must be implemented by subclass');
  }

  /**
   * Generate embeddings for an array of strings
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async embedBatch(texts) {
    throw new Error('embedBatch() must be implemented by subclass');
  }
}

export default EmbeddingProvider;
