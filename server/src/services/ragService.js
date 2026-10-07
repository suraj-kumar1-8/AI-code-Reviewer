import { GoogleGenAI } from '@google/genai';
import { embeddingService } from './embeddings/embeddingService.js';
import { modelRateLimiter } from './modelRateLimiter.js';
import { config } from '../config/index.js';
import db from '../db/index.js';

export class RagService {
  /**
   * Sanitizes user question
   */
  sanitizeQuestion(question) {
    if (!question || typeof question !== 'string') {
      throw new Error('A valid question string is required');
    }
    const trimmed = question.trim().replace(/\0/g, '');
    if (trimmed.length < 2) {
      throw new Error('Question must be at least 2 characters');
    }
    if (trimmed.length > 1000) {
      return trimmed.slice(0, 1000);
    }
    return trimmed;
  }

  /**
   * Retrieves top relevant code chunks from pgvector
   */
  async retrieveRelevantChunks(repositoryId, question, { limit = 6, similarityThreshold = 0.25 } = {}) {
    // 1. Generate embedding vector for the question
    const queryEmbedding = await embeddingService.generateEmbedding(question);
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    // 2. Query pgvector using cosine distance
    const query = `
      SELECT 
        id,
        file_path,
        language,
        chunk_index,
        start_line,
        end_line,
        chunk_content,
        ROUND((1 - (embedding <=> $1::vector))::numeric, 4) AS similarity
      FROM code_chunks
      WHERE repository_id = $2
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $3;
    `;

    const result = await db.query(query, [vectorStr, repositoryId, limit]);
    const chunks = result.rows;

    // Filter by threshold if we have matches
    return chunks.map((row) => ({
      id: row.id,
      filePath: row.file_path,
      language: row.language,
      startLine: row.start_line,
      endLine: row.end_line,
      chunkContent: row.chunk_content,
      similarity: parseFloat(row.similarity),
    }));
  }

  /**
   * Builds the strict grounded prompt for Gemini
   */
  buildPrompt(repositoryId, question, chunks) {
    let contextText = '';

    if (chunks.length === 0) {
      contextText = 'No relevant code chunks found in repository.';
    } else {
      chunks.forEach((c, idx) => {
        contextText += `\n\n--- [CHUNK ${idx + 1}] File: ${c.filePath} (Lines ${c.startLine}-${c.endLine}, Lang: ${c.language}) ---\n${c.chunkContent}`;
      });
    }

    return `You are a Principal Software Engineer and Codebase Assistant for repository: "${repositoryId}".
Your mission is to answer developer questions about this codebase with high technical accuracy.

GROUNDING RULES (MANDATORY):
1. Base your answer EXCLUSIVELY on the provided code chunks below.
2. If the provided code chunks do NOT contain enough information to answer the question, you MUST respond with EXACTLY:
"I couldn't find enough information in this codebase to answer that."
3. Do NOT guess, speculate, or hallucinate files, functions, packages, or routes that are not in the context.
4. When explaining where code or logic resides, explicitly cite the relevant file path and line numbers (e.g. \`${chunks[0]?.filePath || 'path/to/file'}\` (lines ${chunks[0]?.startLine || 1}-${chunks[0]?.endLine || 20})).
5. Explain clearly how the code works and include concise code snippets from the context where relevant.

CODEBASE CONTEXT:
${contextText}

QUESTION:
${question}

ANSWER:`;
  }

  /**
   * Generates answer from Gemini using retrieved code chunks
   */
  async ask({ repositoryId, question }) {
    const cleanQuestion = this.sanitizeQuestion(question);
    console.log('[RAG] Query received');

    // 1. Check if repository is indexed
    const repoCheck = await db.query(
      'SELECT id, owner, name, full_name, total_chunks FROM repositories WHERE id = $1',
      [repositoryId]
    );

    if (repoCheck.rows.length === 0 || repoCheck.rows[0].total_chunks === 0) {
      throw new Error(`Repository "${repositoryId}" is not indexed. Please index the repository first before asking questions.`);
    }

    const repoInfo = repoCheck.rows[0];

    // 2. Retrieve top relevant chunks from pgvector
    const chunks = await this.retrieveRelevantChunks(repositoryId, cleanQuestion, {
      limit: config.rag?.topK || 6,
      similarityThreshold: config.rag?.similarityThreshold || 0.25,
    });

    console.log(`[RAG] Retrieved chunks: ${chunks.length}`);

    if (chunks.length === 0) {
      console.log(`[RAG] Calling Gemini: false`);
      console.log(`[RAG] Sources returned: 0`);
      return {
        answer: "I couldn't find enough information in this codebase to answer that.",
        sources: [],
        repositoryId,
        question: cleanQuestion,
      };
    }

    // 3. Construct prompt
    const prompt = this.buildPrompt(repositoryId, cleanQuestion, chunks);
    const apiKey = config.ai.geminiApiKey || process.env.GEMINI_API_KEY;
    let answerText = '';

    if (apiKey && apiKey.trim()) {
      const preferredModel = config.ai.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
      const fallbackList = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
      const candidateModels = modelRateLimiter.getCandidateModels(preferredModel, fallbackList);
      const primaryModel = candidateModels[0] || preferredModel;

      console.log(`[RAG] Calling Gemini: true`);
      console.log(`[RAG] Model: ${primaryModel}`);

      // Attempt 1: Google GenAI SDK
      try {
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        const res = await ai.models.generateContent({
          model: primaryModel,
          contents: prompt,
          config: {
            temperature: 0.1, // Low temperature for deterministic, hallucination-free answers
          },
        });

        if (res && res.text && res.text.trim()) {
          answerText = res.text.trim();
          console.log(`[RAG] Gemini response received: true`);
        }
      } catch (sdkErr) {
        const is429 = sdkErr.message?.includes('429') || sdkErr.message?.includes('RESOURCE_EXHAUSTED');
        if (is429) {
          const delay = modelRateLimiter.extractRetryDelay(sdkErr.message);
          modelRateLimiter.markRateLimited(primaryModel, delay, '429 Quota Exhausted');
        }
        console.warn(`[RagService] SDK generation error on ${primaryModel}: ${sdkErr.message}. Trying candidate models via REST fallback...`);
      }

      // Attempt 2: REST Fallback (skipping any model that hit 429)
      if (!answerText) {
        const restCandidates = modelRateLimiter.getCandidateModels(candidateModels[1] || 'gemini-3.1-flash-lite', fallbackList);

        for (const candidate of restCandidates) {
          try {
            console.log(`[RAG] Model: ${candidate}`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey.trim()}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(15000),
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 },
              }),
            });

            if (res.ok) {
              const data = await res.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text && text.trim()) {
                answerText = text.trim();
                console.log(`[RAG] Gemini response received: true`);
                break;
              }
            } else {
              const errBody = await res.text();
              if (res.status === 429) {
                const delay = modelRateLimiter.extractRetryDelay(errBody);
                modelRateLimiter.markRateLimited(candidate, delay, '429 Quota Exhausted');
              }
              console.warn(`[RagService] Model ${candidate} returned HTTP ${res.status}: ${errBody.slice(0, 150)}`);
            }
          } catch (restErr) {
            console.warn(`[RagService] Model ${candidate} failed: ${restErr.message}`);
          }
        }
      }
    }

    // Fallback if no response
    if (!answerText) {
      answerText = "I couldn't find enough information in this codebase to answer that.";
    }

    // 4. Format source references
    const sources = chunks.map((c) => ({
      file: c.filePath,
      startLine: c.startLine,
      endLine: c.endLine,
      language: c.language,
      similarity: c.similarity,
      snippet: c.chunkContent.slice(0, 600),
    }));

    const sourceFiles = Array.from(new Set(chunks.map((c) => c.filePath)));
    const relevantCodeSnippets = chunks.map((c) => ({
      file: c.filePath,
      startLine: c.startLine,
      endLine: c.endLine,
      snippet: c.chunkContent.slice(0, 600),
    }));

    console.log(`[RAG] Sources returned: ${sources.length}`);

    return {
      answer: answerText,
      sources,
      sourceFiles,
      relevantCodeSnippets,
      repositoryId,
      repository: {
        owner: repoInfo.owner,
        repo: repoInfo.name,
        fullName: repoInfo.full_name,
      },
      question: cleanQuestion,
    };
  }
}

export const ragService = new RagService();
export default ragService;
