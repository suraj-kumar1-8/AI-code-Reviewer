import crypto from 'crypto';

/**
 * Meaningful code chunker for RAG pipelines.
 * Breaks source code into contextual windows with line tracking and natural boundary awareness.
 */
export class CodeChunker {
  constructor(options = {}) {
    this.targetChunkLines = options.targetChunkLines || 50;
    this.minChunkLines = options.minChunkLines || 15;
    this.overlapLines = options.overlapLines || 10;
    this.maxChunkChars = options.maxChunkChars || 3000;
  }

  /**
   * Generates a deterministic SHA-256 hash for chunk deduplication
   */
  hashContent(content) {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Approximate token count (roughly 4 characters per token for source code)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Determines if a line represents a logical code boundary
   * (e.g. function definition, class declaration, top-level export, blank line)
   */
  isBoundaryLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return true; // Empty line is an ideal breaking point
    return /^(export\s+|class\s+|function\s+|const\s+\w+\s*=\s*(async\s+)?\(|def\s+|public\s+|private\s+|protected\s+|type\s+|interface\s+|struct\s+|func\s+|\/\/ ===)/.test(
      trimmed
    );
  }

  /**
   * Chunks a single file into meaningful code chunks
   * @param {Object} file { path, content, language }
   * @returns {Array} chunks
   */
  chunkFile(file) {
    const { path: filePath, content, language = 'plaintext' } = file;

    if (!content || !content.trim()) {
      return [];
    }

    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    // If file is already small (under target chunk size), keep as a single cohesive chunk
    if (totalLines <= this.targetChunkLines) {
      const chunkText = lines.join('\n');
      return [
        {
          filePath,
          language,
          chunkIndex: 0,
          startLine: 1,
          endLine: totalLines,
          chunkContent: chunkText,
          contentHash: this.hashContent(chunkText),
          tokenEstimate: this.estimateTokens(chunkText),
        },
      ];
    }

    const chunks = [];
    let startIdx = 0;
    let chunkIndex = 0;

    while (startIdx < totalLines) {
      let endIdx = Math.min(startIdx + this.targetChunkLines, totalLines);

      // If we are not at the end of the file, try to find a natural boundary line
      if (endIdx < totalLines) {
        // Look ahead / back up to 8 lines for a natural boundary
        let bestBoundary = -1;
        const searchStart = Math.max(startIdx + this.minChunkLines, endIdx - 8);
        const searchEnd = Math.min(totalLines, endIdx + 8);

        for (let i = searchStart; i < searchEnd; i++) {
          if (this.isBoundaryLine(lines[i])) {
            bestBoundary = i;
            break;
          }
        }

        if (bestBoundary !== -1 && bestBoundary > startIdx) {
          endIdx = bestBoundary;
        }
      }

      // Extract lines for this chunk
      const chunkSlice = lines.slice(startIdx, endIdx);
      let chunkText = chunkSlice.join('\n');

      // Check max char threshold
      if (chunkText.length > this.maxChunkChars && chunkSlice.length > this.minChunkLines) {
        // Truncate to half lines if chunk is exceptionally wide
        endIdx = startIdx + Math.floor(chunkSlice.length / 2);
        chunkText = lines.slice(startIdx, endIdx).join('\n');
      }

      const startLineNumber = startIdx + 1; // 1-indexed
      const endLineNumber = endIdx;        // 1-indexed

      if (chunkText.trim().length > 0) {
        chunks.push({
          filePath,
          language,
          chunkIndex,
          startLine: startLineNumber,
          endLine: endLineNumber,
          chunkContent: chunkText,
          contentHash: this.hashContent(chunkText),
          tokenEstimate: this.estimateTokens(chunkText),
        });
        chunkIndex++;
      }

      // Advance startIdx with overlap, ensuring forward progress
      const nextStart = endIdx - this.overlapLines;
      if (nextStart <= startIdx) {
        startIdx = endIdx;
      } else {
        startIdx = nextStart;
      }

      // If remaining lines are fewer than minimum, consume rest
      if (totalLines - startIdx <= this.minChunkLines) {
        if (startIdx < totalLines) {
          const finalSlice = lines.slice(startIdx, totalLines);
          const finalChunk = finalSlice.join('\n');
          if (finalChunk.trim().length > 0) {
            chunks.push({
              filePath,
              language,
              chunkIndex,
              startLine: startIdx + 1,
              endLine: totalLines,
              chunkContent: finalChunk,
              contentHash: this.hashContent(finalChunk),
              tokenEstimate: this.estimateTokens(finalChunk),
            });
          }
        }
        break;
      }
    }

    return chunks;
  }

  /**
   * Chunks multiple files and flattens into an array of chunks
   * @param {Array} files
   * @returns {Array} allChunks
   */
  chunkFiles(files) {
    const allChunks = [];
    for (const file of files) {
      const chunks = this.chunkFile(file);
      allChunks.push(...chunks);
    }
    return allChunks;
  }
}

export const codeChunker = new CodeChunker();
export default codeChunker;
