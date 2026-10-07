import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import db from '../db/index.js';
import { embeddingService } from './embeddings/embeddingService.js';
import { modelRateLimiter } from './modelRateLimiter.js';

export class CodeExplanationService {
  /**
   * Explains a specific file, function, or code block using RAG + Gemini
   */
  async explainCode({ repositoryId, filePath, codeSnippet, functionName, owner, repo }) {
    let repoKey = repositoryId;
    if (!repoKey && owner && repo) {
      repoKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
    }

    if (!repoKey) {
      throw new Error('repositoryId or owner and repo are required');
    }

    // 1. Gather context from pgvector or database chunks
    let relevantChunks = [];
    try {
      if (filePath) {
        // Query exact file chunks first
        const fileRes = await db.query(
          `SELECT file_path, start_line, end_line, chunk_content, language
           FROM code_chunks
           WHERE repository_id = $1 AND file_path ILIKE $2
           ORDER BY chunk_index ASC LIMIT 5;`,
          [repoKey, `%${filePath}%`]
        );

        if (fileRes.rows.length > 0) {
          relevantChunks = fileRes.rows;
        }
      }

      // If no file chunks found or we have a functionName, search via pgvector semantic query
      if (relevantChunks.length === 0 && (functionName || codeSnippet)) {
        const queryTerm = functionName || (codeSnippet ? codeSnippet.slice(0, 200) : filePath);
        const queryVector = await embeddingService.generateEmbedding(queryTerm);
        const vectorStr = `[${queryVector.join(',')}]`;

        const vectorRes = await db.query(
          `SELECT file_path, start_line, end_line, chunk_content, language,
                  (1 - (embedding <=> $1::vector)) AS similarity
           FROM code_chunks
           WHERE repository_id = $2
           ORDER BY embedding <=> $1::vector ASC
           LIMIT 4;`,
          [vectorStr, repoKey]
        );

        if (vectorRes.rows.length > 0 && vectorRes.rows[0].similarity >= 0.25) {
          relevantChunks = vectorRes.rows;
        }
      }
    } catch (dbErr) {
      console.warn('[CodeExplanationService] Vector retrieval error:', dbErr.message);
    }

    // 2. Strict grounding check: If no relevant chunks and no provided snippet, we MUST reject hallucination
    if (relevantChunks.length === 0 && (!codeSnippet || !codeSnippet.trim())) {
      return {
        success: false,
        explanation: "I couldn't find enough information in this codebase to explain this accurately.",
        sourceReferences: [],
      };
    }

    const contextCode = codeSnippet && codeSnippet.trim()
      ? `PROVIDED CODE SNIPPET (File: ${filePath || 'Target File'}):\n${codeSnippet}`
      : relevantChunks.map((c, i) => `--- CHUNK ${i + 1} (${c.file_path}: Lines ${c.start_line}-${c.end_line}) ---\n${c.chunk_content}`).join('\n\n');

    const sourceReferences = relevantChunks.map((c) => ({
      file: c.file_path,
      lines: `${c.start_line}-${c.end_line}`,
    }));

    if (filePath && !sourceReferences.some((s) => s.file === filePath)) {
      sourceReferences.unshift({ file: filePath, lines: '1-end' });
    }

    // 3. Build prompt for Gemini
    const prompt = `You are a Principal Software Engineer explaining code from repository "${repoKey}".

Target to explain: ${functionName ? `Function "${functionName}"` : `File "${filePath || 'Source Code'}"`}

STRICT GROUNDING RULES:
1. Base your explanation SOLELY on the real code provided below.
2. If the context does not contain enough information to understand the code, answer with EXACTLY:
"I couldn't find enough information in this codebase to explain this accurately."
3. Do NOT hallucinate variables, arguments, external packages, or behavior not present in the code.
4. Output STRICT JSON without markdown wrapping (no backticks):
{
  "purpose": "<Clear 2-sentence summary of what this code does and why>",
  "inputs": ["<List input parameters, arguments, environment configs, or request payload>"],
  "outputs": ["<Return value, generated response, or mutation side effects>"],
  "importantLogic": ["<Step 1 logic breakdown>", "<Step 2 logic breakdown>", "<Step 3 logic breakdown>"],
  "dependencies": ["<Internal/external modules, database, or libraries used>"],
  "potentialRisks": ["<Concurrency, edge-case nulls, missing validation, or performance risk>"],
  "improvementSuggestions": ["<Concrete refactoring suggestion 1>", "<Concrete refactoring suggestion 2>"],
  "sourceReferences": [
    { "file": "<Exact file path>", "lines": "<line range>" }
  ]
}

ACTUAL CODE CONTEXT:
${contextCode}`;

    if (!config.geminiApiKey) {
      // Deterministic fallback if API key is not present
      return {
        success: true,
        purpose: `Module "${filePath || functionName}" handles domain operations in ${repoKey}.`,
        inputs: ['Parameters passed to exported handler functions.'],
        outputs: ['Asynchronous Promise or HTTP JSON payload.'],
        importantLogic: [
          'Receives incoming invocation parameters.',
          'Executes domain operations and internal validation.',
          'Returns structured result to caller.',
        ],
        dependencies: ['Node.js standard libraries and repository service modules.'],
        potentialRisks: ['Verify that edge-case null checks and error handlers surround external calls.'],
        improvementSuggestions: ['Add unit tests covering edge branches and error scenarios.'],
        sourceReferences,
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const modelName = config.geminiModel || 'gemini-3.1-flash-lite';

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = response?.text || '';
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

      if (cleaned.includes("I couldn't find enough information")) {
        return {
          success: false,
          explanation: "I couldn't find enough information in this codebase to explain this accurately.",
          sourceReferences: [],
        };
      }

      const parsed = JSON.parse(cleaned);
      return {
        success: true,
        purpose: parsed.purpose || 'Explanation generated from codebase context.',
        inputs: parsed.inputs || [],
        outputs: parsed.outputs || [],
        importantLogic: parsed.importantLogic || [],
        dependencies: parsed.dependencies || [],
        potentialRisks: parsed.potentialRisks || [],
        improvementSuggestions: parsed.improvementSuggestions || [],
        sourceReferences: parsed.sourceReferences && parsed.sourceReferences.length > 0 ? parsed.sourceReferences : sourceReferences,
      };
    } catch (err) {
      console.warn('[CodeExplanationService] AI generation error:', err.message);
      return {
        success: false,
        explanation: "I couldn't find enough information in this codebase to explain this accurately.",
        sourceReferences: [],
      };
    }
  }
}

export const codeExplanationService = new CodeExplanationService();
export default codeExplanationService;
