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
   * Retrieves relevant code chunks using hybrid retrieval:
   * 1. Semantic pgvector search
   * 2. Filename/path matching
   * 3. Keyword matching
   * 4. Local reranking
   *
   * Only ONE Gemini embedding request is made per user question.
   */
  async retrieveRelevantChunks(
    repositoryId,
    question,
    { limit = 6, similarityThreshold = 0.25 } = {}
  ) {
    // 1. Generate ONE embedding for the question
    const queryEmbedding = await embeddingService.generateEmbedding(question);
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    // 2. Retrieve a larger candidate pool from PostgreSQL.
    // This is a database query, NOT an additional Gemini API request.
    const candidateLimit = Math.max(limit * 4, 24);

    const query = `
      SELECT
        id,
        file_path,
        language,
        chunk_index,
        start_line,
        end_line,
        chunk_content,
        (1 - (embedding <=> $1::vector)) AS similarity
      FROM code_chunks
      WHERE repository_id = $2
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $3;
    `;

    const result = await db.query(query, [
      vectorStr,
      repositoryId,
      candidateLimit,
    ]);

    const normalizedQuestion = question.toLowerCase();

    // Common words that should not influence keyword matching.
    const stopWords = new Set([
      'the',
      'is',
      'are',
      'was',
      'were',
      'where',
      'what',
      'which',
      'how',
      'why',
      'when',
      'does',
      'do',
      'did',
      'and',
      'or',
      'of',
      'in',
      'on',
      'to',
      'for',
      'from',
      'with',
      'about',
      'this',
      'that',
      'code',
      'file',
      'logic',
      'implemented',
      'handle',
      'handled',
      'contains',
      'give',
      'me',
    ]);

    // Extract useful keywords from the question.
    const keywords = normalizedQuestion
      .replace(/[`"'()[\]{}:;,!?]/g, ' ')
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(
        (word) =>
          word.length >= 3 &&
          !stopWords.has(word)
      );

    // Detect explicit file/path references.
    // Examples:
    // src/beep_agent/auth.py
    // auth.py
    // server/src/auth.js
    const explicitPathMatch = normalizedQuestion.match(
      /(?:[\w.-]+\/)*[\w.-]+\.(?:js|jsx|ts|tsx|py|java|go|rs|php|rb|cpp|c|h|json|md|sql|html|css)/
    );

    const explicitPath = explicitPathMatch
      ? explicitPathMatch[0]
      : null;

    const chunks = result.rows.map((row) => {
      const filePath = String(row.file_path || '').toLowerCase();
      const content = String(row.chunk_content || '').toLowerCase();

      const similarity = Number(row.similarity || 0);

      let lexicalScore = 0;

      // Strong boost for an explicitly mentioned filename/path.
      if (explicitPath) {
        if (filePath === explicitPath) {
          lexicalScore += 1.0;
        } else if (filePath.endsWith(`/${explicitPath}`)) {
          lexicalScore += 0.9;
        } else if (filePath.includes(explicitPath)) {
          lexicalScore += 0.7;
        }
      }

      // Filename/path keyword boost.
      for (const keyword of keywords) {
        if (filePath.includes(keyword)) {
          lexicalScore += 0.25;
        }
      }

      // Code content keyword boost.
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          lexicalScore += 0.05;
        }
      }

      // Keep semantic similarity as the primary signal,
      // while allowing filename/path relevance to improve ranking.
      const rerankScore =
        similarity * 0.70 +
        Math.min(lexicalScore, 1) * 0.30;

      return {
        id: row.id,
        filePath: row.file_path,
        language: row.language,
        startLine: row.start_line,
        endLine: row.end_line,
        chunkContent: row.chunk_content,
        similarity,
        lexicalScore,
        rerankScore,
      };
    });

    // 3. Local reranking.
    // No Gemini/API call here.
    chunks.sort((a, b) => b.rerankScore - a.rerankScore);

    // 4. Apply similarity threshold and select final context.
    const selected = chunks
      .filter((chunk) => chunk.similarity >= similarityThreshold)
      .slice(0, limit);

    console.log(
      `[RAG] Hybrid retrieval: ${result.rows.length} candidates -> ${selected.length} final chunks`
    );

    if (selected.length > 0) {
      console.log(
        `[RAG] Top sources: ${selected
          .slice(0, 3)
          .map(
            (chunk) =>
              `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`
          )
          .join(', ')}`
      );
    }

    return selected;
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
        contextText += `

--- [CHUNK ${idx + 1}] File: ${c.filePath} (Lines ${c.startLine}-${c.endLine}, Lang: ${c.language}) ---
${c.chunkContent}`;
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
6. Prefer the most directly relevant source file over loosely related files.
7. If a question asks where a specific concept is implemented, identify the file whose code actually implements that concept, not merely a file that imports or references it.

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

    if (
      repoCheck.rows.length === 0 ||
      repoCheck.rows[0].total_chunks === 0
    ) {
      throw new Error(
        `Repository "${repositoryId}" is not indexed. Please index the repository first before asking questions.`
      );
    }

    const repoInfo = repoCheck.rows[0];

    // 2. Retrieve relevant chunks
    const chunks = await this.retrieveRelevantChunks(
      repositoryId,
      cleanQuestion,
      {
        limit: config.rag?.topK || 6,
        similarityThreshold:
          config.rag?.similarityThreshold || 0.25,
      }
    );

    console.log(`[RAG] Retrieved chunks: ${chunks.length}`);

    if (chunks.length === 0) {
      console.log(`[RAG] Calling Gemini: false`);
      console.log(`[RAG] Sources returned: 0`);

      return {
        answer:
          "I couldn't find enough information in this codebase to answer that.",
        sources: [],
        repositoryId,
        question: cleanQuestion,
      };
    }

    // 3. Construct grounded prompt
    const prompt = this.buildPrompt(
      repositoryId,
      cleanQuestion,
      chunks
    );

    const apiKey =
      config.ai.geminiApiKey ||
      process.env.GEMINI_API_KEY;

    let answerText = '';

    if (apiKey && apiKey.trim()) {
      const preferredModel =
        config.ai.geminiModel ||
        process.env.GEMINI_MODEL ||
        'gemini-3.1-flash-lite';

      const fallbackList = [
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-flash-latest',
      ];

      const candidateModels =
        modelRateLimiter.getCandidateModels(
          preferredModel,
          fallbackList
        );

      const primaryModel =
        candidateModels[0] || preferredModel;

      console.log(`[RAG] Calling Gemini: true`);
      console.log(`[RAG] Model: ${primaryModel}`);

      // Attempt 1: Google GenAI SDK
      try {
        const ai = new GoogleGenAI({
          apiKey: apiKey.trim(),
        });

        const res = await ai.models.generateContent({
          model: primaryModel,
          contents: prompt,
          config: {
            temperature: 0.1,
          },
        });

        if (
          res &&
          res.text &&
          res.text.trim()
        ) {
          answerText = res.text.trim();

          console.log(
            `[RAG] Gemini response received: true`
          );
        }
      } catch (sdkErr) {
        const is429 =
          sdkErr.message?.includes('429') ||
          sdkErr.message?.includes(
            'RESOURCE_EXHAUSTED'
          );

        if (is429) {
          const delay =
            modelRateLimiter.extractRetryDelay(
              sdkErr.message
            );

          modelRateLimiter.markRateLimited(
            primaryModel,
            delay,
            '429 Quota Exhausted'
          );
        }

        console.warn(
          `[RagService] SDK generation error on ${primaryModel}: ${sdkErr.message}. Trying candidate models via REST fallback...`
        );
      }

      // Attempt 2: REST fallback
      if (!answerText) {
        const restCandidates =
          modelRateLimiter.getCandidateModels(
            candidateModels[1] ||
              'gemini-3.1-flash-lite',
            fallbackList
          );

        for (const candidate of restCandidates) {
          try {
            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        {
                          text: prompt,
                        },
                      ],
                    },
                  ],
                  generationConfig: {
                    temperature: 0.1,
                  },
                }),
              }
            );

            const data =
              await response.json();

            if (!response.ok) {
              const message =
                data?.error?.message ||
                `HTTP ${response.status}`;

              const is429 =
                response.status === 429 ||
                message.includes('429') ||
                message.includes(
                  'RESOURCE_EXHAUSTED'
                );

              if (is429) {
                const delay =
                  modelRateLimiter.extractRetryDelay(
                    message
                  );

                modelRateLimiter.markRateLimited(
                  candidate,
                  delay,
                  '429 Quota Exhausted'
                );
              }

              console.warn(
                `[RagService] REST generation error on ${candidate}: ${message}`
              );

              continue;
            }

            const text =
              data?.candidates?.[0]?.content?.parts
                ?.map((part) => part.text || '')
                .join('')
                .trim();

            if (text) {
              answerText = text;

              console.log(
                `[RAG] Gemini REST response received: true`
              );

              break;
            }
          } catch (restErr) {
            console.warn(
              `[RagService] REST generation error on ${candidate}: ${restErr.message}`
            );
          }
        }
      }
    }

    if (!answerText) {
      answerText =
        "I couldn't generate an answer from the available codebase context.";
    }

    const sources = chunks.map((c) => ({
      filePath: c.filePath,
      startLine: c.startLine,
      endLine: c.endLine,
      similarity: c.similarity,
    }));

    return {
      answer: answerText,
      sources,
      repositoryId,
      repository: {
        owner: repoInfo.owner,
        name: repoInfo.name,
        fullName: repoInfo.full_name,
      },
      question: cleanQuestion,
    };
  }
}

export const ragService = new RagService();
export default ragService;
