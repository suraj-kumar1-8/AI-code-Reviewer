import db from '../db/index.js';

export class CodebaseSearchService {
  /**
   * Searches indexed codebase chunks by multiple dimensions
   * @param {Object} params
   * @param {string} params.repositoryId
   * @param {string} params.query
   * @param {string} [params.type='all'] 'all' | 'filename' | 'function' | 'class' | 'api' | 'symbol' | 'keyword'
   * @param {number} [params.limit=25]
   */
  async search({ repositoryId, query, type = 'all', limit = 25 }) {
    if (!repositoryId || !query || !query.trim()) {
      return { total: 0, query: query || '', results: [] };
    }

    const trimmedQuery = query.trim();
    const cleanRepoId = repositoryId.toLowerCase();

    // Fetch chunks for the repository
    const chunksRes = await db.query(
      `SELECT file_path, start_line, end_line, chunk_content, language
       FROM code_chunks
       WHERE repository_id = $1
       ORDER BY chunk_index ASC;`,
      [cleanRepoId]
    );

    const chunks = chunksRes.rows;
    const results = [];

    const lowerQuery = trimmedQuery.toLowerCase();
    const regexQuery = new RegExp(this.escapeRegExp(trimmedQuery), 'i');

    for (const chunk of chunks) {
      const filePath = chunk.file_path;
      const content = chunk.chunk_content;
      const lines = content.split('\n');

      // 1. Filename Match
      if (type === 'all' || type === 'filename') {
        if (filePath.toLowerCase().includes(lowerQuery)) {
          results.push({
            file: filePath,
            location: `${chunk.start_line}-${chunk.end_line}`,
            relevantCode: lines.slice(0, 5).join('\n'),
            whyMatches: `File path "${filePath}" contains search term "${trimmedQuery}"`,
            matchType: 'filename',
            score: filePath.toLowerCase().endsWith(lowerQuery) ? 100 : 80,
          });
        }
      }

      // Line-by-line inspection for symbols, functions, classes, API endpoints, keywords
      lines.forEach((lineText, idx) => {
        const lineNum = chunk.start_line + idx;
        const trimmed = lineText.trim();
        if (!trimmed) return;

        // 2. API Endpoint Match
        if (type === 'all' || type === 'api') {
          const apiMatch = /(?:router|app)\.(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/i.exec(trimmed) ||
                           /fetch\s*\(\s*['"]([^'"]+)['"]/i.exec(trimmed) ||
                           /axios\.(?:get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]/i.exec(trimmed);
          if (apiMatch && apiMatch[1].toLowerCase().includes(lowerQuery)) {
            const contextStart = Math.max(0, idx - 1);
            const contextEnd = Math.min(lines.length, idx + 3);
            results.push({
              file: filePath,
              location: `Line ${lineNum}`,
              relevantCode: lines.slice(contextStart, contextEnd).join('\n'),
              whyMatches: `Matches API endpoint route declaration "${apiMatch[1]}"`,
              matchType: 'api',
              score: 95,
            });
          }
        }

        // 3. Class Match
        if (type === 'all' || type === 'class') {
          const classMatch = /class\s+([a-zA-Z0-9_$]+)/.exec(trimmed);
          if (classMatch && classMatch[1].toLowerCase().includes(lowerQuery)) {
            const contextStart = Math.max(0, idx - 1);
            const contextEnd = Math.min(lines.length, idx + 4);
            results.push({
              file: filePath,
              location: `Line ${lineNum}`,
              relevantCode: lines.slice(contextStart, contextEnd).join('\n'),
              whyMatches: `Matches class declaration "class ${classMatch[1]}"`,
              matchType: 'class',
              score: 92,
            });
          }
        }

        // 4. Function Match
        if (type === 'all' || type === 'function') {
          const fnMatch = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|def\s+([a-zA-Z0-9_$]+))/.exec(trimmed);
          if (fnMatch) {
            const fnName = fnMatch[1] || fnMatch[2] || fnMatch[3];
            if (fnName && fnName.toLowerCase().includes(lowerQuery)) {
              const contextStart = Math.max(0, idx - 1);
              const contextEnd = Math.min(lines.length, idx + 4);
              results.push({
                file: filePath,
                location: `Line ${lineNum}`,
                relevantCode: lines.slice(contextStart, contextEnd).join('\n'),
                whyMatches: `Matches function signature "${fnName}()"`,
                matchType: 'function',
                score: 90,
              });
            }
          }
        }

        // 5. Symbol / Variable Match
        if (type === 'all' || type === 'symbol') {
          const symMatch = /(?:const|let|var|type|interface|enum)\s+([a-zA-Z0-9_$]+)/.exec(trimmed);
          if (symMatch && symMatch[1].toLowerCase().includes(lowerQuery)) {
            const contextStart = Math.max(0, idx - 1);
            const contextEnd = Math.min(lines.length, idx + 3);
            results.push({
              file: filePath,
              location: `Line ${lineNum}`,
              relevantCode: lines.slice(contextStart, contextEnd).join('\n'),
              whyMatches: `Matches symbol declaration "${symMatch[1]}"`,
              matchType: 'symbol',
              score: 85,
            });
          }
        }

        // 6. General Keyword Match
        if ((type === 'all' || type === 'keyword') && regexQuery.test(trimmed)) {
          // Avoid duplicate entry if line was already added as function/api/class/symbol
          const contextStart = Math.max(0, idx - 1);
          const contextEnd = Math.min(lines.length, idx + 3);
          results.push({
            file: filePath,
            location: `Line ${lineNum}`,
            relevantCode: lines.slice(contextStart, contextEnd).join('\n'),
            whyMatches: `Contains keyword "${trimmedQuery}" in code line`,
            matchType: 'keyword',
            score: 70,
          });
        }
      });
    }

    // Deduplicate results by file + location
    const uniqueMap = new Map();
    for (const r of results) {
      const key = `${r.file}:${r.location}:${r.matchType}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, r);
      }
    }

    // Sort by relevance score descending
    const sorted = Array.from(uniqueMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      total: sorted.length,
      repositoryId: cleanRepoId,
      query: trimmedQuery,
      type,
      results: sorted,
    };
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const codebaseSearchService = new CodebaseSearchService();
export default codebaseSearchService;
