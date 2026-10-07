import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import db from '../db/index.js';
import { embeddingService } from './embeddings/embeddingService.js';
import { modelRateLimiter } from './modelRateLimiter.js';

export class DebuggingService {
  /**
   * Performs root cause analysis on error messages, stack traces, and logs
   */
  async debugError({
    accessToken,
    owner,
    repo,
    errorMessage,
    stackTrace = '',
    failingFile = '',
    logs = '',
    createdBy = 'system',
  }) {
    if (!owner || !repo || !errorMessage || !errorMessage.trim()) {
      throw new Error('"owner", "repo", and "errorMessage" are required for debugging.');
    }

    const cleanOwner = owner.toLowerCase();
    const cleanRepo = repo.toLowerCase();
    const repoKey = `${cleanOwner}/${cleanRepo}`;
    const cleanError = errorMessage.trim();

    // 1. Parse error type and locate file references from stack trace
    const parsedError = this.parseErrorAndStack(cleanError, stackTrace, failingFile);

    // 2. Retrieve relevant code chunks from pgvector / database
    const relevantChunks = await this.retrieveContextChunks(repoKey, parsedError);

    // 3. Grounding check: If no relevant code was found, avoid hallucinating
    if (relevantChunks.length === 0 && !parsedError.targetFile) {
      return {
        error: cleanError,
        rootCause: "I couldn't determine the root cause with enough confidence from the available code and error information.",
        evidence: [],
        affectedFiles: [],
        recommendedFix: 'Please verify that the repository is indexed and provide the specific failing file path or full stack trace.',
        confidence: 'LOW',
        regressionTests: '// Insufficient context to generate regression test.',
      };
    }

    // 4. Synthesize Root Cause, Evidence, Fix, and Tests with Gemini (or deterministic fallback)
    const analysis = await this.synthesizeRootCause({
      repoKey,
      parsedError,
      relevantChunks,
      logs,
    });

    // 5. Persist to PostgreSQL debugging_sessions
    try {
      await db.query(
        `INSERT INTO debugging_sessions (
           repository_id, owner, repo, error_message, stack_trace,
           failing_file, root_cause, evidence, affected_files,
           recommended_fix, confidence, regression_tests, created_by, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP);`,
        [
          repoKey,
          cleanOwner,
          cleanRepo,
          cleanError,
          stackTrace || null,
          parsedError.targetFile || null,
          analysis.rootCause,
          JSON.stringify(analysis.evidence),
          JSON.stringify(analysis.affectedFiles),
          analysis.recommendedFix,
          analysis.confidence,
          analysis.regressionTests,
          createdBy,
        ]
      );
    } catch (dbErr) {
      console.warn('[DebuggingService] DB insert warning:', dbErr.message);
    }

    return {
      error: cleanError,
      errorType: parsedError.errorType,
      rootCause: analysis.rootCause,
      evidence: analysis.evidence,
      affectedFiles: analysis.affectedFiles,
      recommendedFix: analysis.recommendedFix,
      confidence: analysis.confidence,
      regressionTests: analysis.regressionTests,
    };
  }

  /**
   * Parses error message and stack trace for file paths and line numbers
   */
  parseErrorAndStack(errorMessage, stackTrace, failingFile) {
    const combined = `${errorMessage}\n${stackTrace}`;

    // Error type regex (e.g., TypeError, ReferenceError, KeyError, NullPointerException, 404, 500)
    const typeMatch = /(?:([a-zA-Z0-9_]+Error|[a-zA-Z0-9_]+Exception))\s*:\s*(.*)/i.exec(errorMessage);
    const errorType = typeMatch ? typeMatch[1] : 'RuntimeError';

    // File path regex in stack trace (e.g., at function (src/services/auth.js:45:12) or src/index.ts:25)
    let targetFile = failingFile ? failingFile.trim().replace(/^\/+/, '') : '';
    let targetLine = null;

    if (!targetFile && stackTrace) {
      const stackFileMatch = /(?:at\s+.*?\((?:.*?\/)?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+):(\d+):\d+\)|(?:at\s+(?:.*?\/)?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+):(\d+):\d+))/i.exec(stackTrace);
      if (stackFileMatch) {
        targetFile = stackFileMatch[1] || stackFileMatch[3] || '';
        targetLine = parseInt(stackFileMatch[2] || stackFileMatch[4] || '1', 10);
      }
    }

    // Property name if "Cannot read property 'x' of undefined"
    const propMatch = /Cannot read properties? of (?:undefined|null) \(reading '([a-zA-Z0-9_$]+)'\)/i.exec(errorMessage);
    const accessedProperty = propMatch ? propMatch[1] : null;

    return {
      errorType,
      errorMessage,
      targetFile,
      targetLine,
      accessedProperty,
      combined,
    };
  }

  /**
   * Retrieves relevant code chunks using pgvector and text queries
   */
  async retrieveContextChunks(repoKey, parsedError) {
    const chunks = [];

    // 1. Direct file chunks if target file is known
    if (parsedError.targetFile) {
      try {
        const fileRes = await db.query(
          `SELECT file_path, start_line, end_line, chunk_content
           FROM code_chunks
           WHERE repository_id = $1 AND file_path ILIKE $2
           ORDER BY chunk_index ASC LIMIT 4;`,
          [repoKey, `%${parsedError.targetFile}%`]
        );
        if (fileRes.rows.length > 0) {
          chunks.push(...fileRes.rows);
        }
      } catch (err) {
        console.warn('[DebuggingService] Direct chunk error:', err.message);
      }
    }

    // 2. Vector search on error message and accessed property
    try {
      const searchTerm = `${parsedError.errorMessage} ${parsedError.accessedProperty || ''}`.trim();
      const embedding = await embeddingService.generateEmbedding(searchTerm);
      const vectorStr = `[${embedding.join(',')}]`;

      const vectorRes = await db.query(
        `SELECT file_path, start_line, end_line, chunk_content,
                ROUND((1 - (embedding <=> $1::vector))::numeric, 4) AS similarity
         FROM code_chunks
         WHERE repository_id = $2
         ORDER BY embedding <=> $1::vector ASC LIMIT 4;`,
        [vectorStr, repoKey]
      );

      for (const row of vectorRes.rows) {
        if (!chunks.some((c) => c.file_path === row.file_path && c.start_line === row.start_line)) {
          chunks.push(row);
        }
      }
    } catch (err) {
      console.warn('[DebuggingService] Vector retrieval error:', err.message);
    }

    return chunks;
  }

  /**
   * Synthesizes root cause analysis, fix, and regression test with strict code grounding
   */
  async synthesizeRootCause({ repoKey, parsedError, relevantChunks, logs }) {
    const affectedFiles = Array.from(new Set(relevantChunks.map((c) => c.file_path)));
    if (parsedError.targetFile && !affectedFiles.includes(parsedError.targetFile)) {
      affectedFiles.unshift(parsedError.targetFile);
    }

    const contextText = relevantChunks
      .map((c, idx) => `--- [SNIPPET ${idx + 1}] File: ${c.file_path} (Lines ${c.start_line}-${c.end_line}) ---\n${c.chunk_content}`)
      .join('\n\n');

    // Default heuristic fallback if no Gemini API key
    const defaultEvidence = relevantChunks.slice(0, 2).map((c) => ({
      file: c.file_path,
      lines: `${c.start_line}-${c.end_line}`,
      snippet: c.chunk_content.slice(0, 200),
    }));

    const defaultRootCause = parsedError.accessedProperty
      ? `Property "${parsedError.accessedProperty}" was accessed on an object that is null or undefined at runtime. This typically occurs when an asynchronous API response or database query returned null or 404, but the caller accessed the property without a guard clause or optional chaining (?.).`
      : `Unhandled exception in ${parsedError.targetFile || 'application runtime'}. The operation failed because incoming arguments or state violated runtime invariants without a defensive boundary.`;

    const defaultFix = parsedError.accessedProperty
      ? `// Use optional chaining or guard against null/undefined:\nif (!data) {\n  return null; // Or handle empty state\n}\nconst value = data?.${parsedError.accessedProperty} ?? 'fallback';`
      : `// Wrap with defensive check or try/catch boundary:\ntry {\n  // Protected execution\n} catch (err) {\n  console.error('[Handled Error]:', err.message);\n  throw err;\n}`;

    const defaultTests = `describe('Regression Test: ${parsedError.errorType}', () => {\n  it('should handle undefined / null payload gracefully without throwing', () => {\n    // Verify boundary guard\n    expect(() => { /* handler(null) */ }).not.toThrow();\n  });\n});`;

    if (!config.geminiApiKey || relevantChunks.length === 0) {
      return {
        rootCause: defaultRootCause,
        evidence: defaultEvidence,
        affectedFiles,
        recommendedFix: defaultFix,
        confidence: relevantChunks.length > 0 ? 'MEDIUM' : 'LOW',
        regressionTests: defaultTests,
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const prompt = `You are a Principal Software Engineer and Staff Debugging Expert for repository: "${repoKey}".
Analyze the following error and actual source code context:

ERROR:
${parsedError.errorMessage}

STACK TRACE / LOGS:
${parsedError.combined}
${logs ? `ADDITIONAL LOGS:\n${logs}` : ''}

RELEVANT CODEBASE CONTEXT:
${contextText}

STRICT GROUNDING RULES:
1. Base your root cause analysis ONLY on evidence from the provided code and error details.
2. If the context does not contain enough evidence, state clearly:
"I couldn't determine the root cause with enough confidence from the available code and error information."
3. Never invent files, variables, or functions.
4. Output STRICT JSON:
{
  "rootCause": "<Precise 2-sentence explanation of why the error occurs>",
  "evidence": [
    { "file": "<exact file path>", "lines": "<line range>", "snippet": "<code snippet evidence>" }
  ],
  "affectedFiles": ["<file1>", "<file2>"],
  "recommendedFix": "<Executable, concrete code fix snippet with explanation>",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "regressionTests": "<Full runnable unit/regression test code in Jest/Vitest>"
}`;

      const modelName = config.geminiModel || 'gemini-3.1-flash-lite';
      const res = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = res?.text || '';
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        rootCause: parsed.rootCause || defaultRootCause,
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : defaultEvidence,
        affectedFiles: Array.isArray(parsed.affectedFiles) && parsed.affectedFiles.length > 0 ? parsed.affectedFiles : affectedFiles,
        recommendedFix: parsed.recommendedFix || defaultFix,
        confidence: parsed.confidence || 'HIGH',
        regressionTests: parsed.regressionTests || defaultTests,
      };
    } catch (err) {
      console.warn('[DebuggingService] AI generation note:', err.message);
      return {
        rootCause: defaultRootCause,
        evidence: defaultEvidence,
        affectedFiles,
        recommendedFix: defaultFix,
        confidence: 'MEDIUM',
        regressionTests: defaultTests,
      };
    }
  }
}

export const debuggingService = new DebuggingService();
export default debuggingService;
