import { githubService } from './githubService.js';
import { codeChunker } from './codeChunker.js';
import { embeddingService } from './embeddings/embeddingService.js';
import db from '../db/index.js';

// Directories to ignore
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.github',
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  'coverage',
  '.vscode',
  '.idea',
  'vendor',
  'tmp',
  'temp',
  'target',
  'bin',
  'obj',
  'Pods',
  '.gradle',
  '.cargo',
  'site-packages',
  'venv',
  'env',
  '.venv',
]);

// Ignored file names
const IGNORED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
  'Cargo.lock',
  'Gemfile.lock',
  '.DS_Store',
  'Thumbs.db',
]);

// Binary or non-code extensions to skip
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff',
  'mp4', 'webm', 'mov', 'avi', 'mp3', 'wav', 'ogg',
  'pdf', 'zip', 'tar', 'gz', 'rar', '7z',
  'exe', 'dll', 'so', 'dylib', 'bin', 'class', 'pyc', 'pyo',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'sqlite', 'db',
]);

// Supported source code extensions
const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'mjs', 'cjs',
  'ts', 'tsx', 'mts', 'cts',
  'py',
  'java',
  'go',
  'rs',
  'c', 'cpp', 'cc', 'h', 'hpp',
  'cs',
  'php',
  'rb',
  'html', 'css', 'scss',
  'sql',
  'sh', 'bash',
  'json',
  'yaml', 'yml',
  'vue', 'svelte', 'md', 'markdown',
]);

const MAX_FILE_SIZE = 80 * 1024; // 80 KB max per file
const MAX_FILES_INDEX_LIMIT = 25; // Index top 25 most critical source files
const MAX_TOTAL_CHUNKS = 50;      // Cap chunks at 50 to strictly respect 100 RPM quota

/**
 * Assigns an importance score to prioritize core application logic
 */
function scoreFilePath(path) {
  const lower = path.toLowerCase();
  let score = 10;
  if (lower.startsWith('src/') || lower.includes('/src/')) score += 30;
  if (lower.startsWith('server/') || lower.startsWith('app/') || lower.startsWith('lib/')) score += 25;
  if (lower.includes('controller') || lower.includes('route') || lower.includes('service') || lower.includes('api/')) score += 25;
  if (lower.includes('auth') || lower.includes('db') || lower.includes('database') || lower.includes('config')) score += 25;
  if (lower.includes('index.') || lower.includes('main.') || lower.includes('server.') || lower.includes('app.')) score += 30;
  if (lower.includes('.test.') || lower.includes('.spec.') || lower.includes('__test__') || lower.includes('mock')) score -= 15;
  if (lower.endsWith('.d.ts') || lower.endsWith('.css') || lower.endsWith('.scss')) score -= 10;
  return score;
}

function detectLanguage(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'jsx':
      return 'javascriptreact';
    case 'ts':
    case 'mts':
    case 'cts':
      return 'typescript';
    case 'tsx':
      return 'typescriptreact';
    case 'py':
      return 'python';
    case 'java':
      return 'java';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'cc':
    case 'hpp':
      return 'cpp';
    case 'cs':
      return 'csharp';
    case 'php':
      return 'php';
    case 'rb':
      return 'ruby';
    case 'html':
      return 'html';
    case 'css':
    case 'scss':
      return 'css';
    case 'sql':
      return 'sql';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'json':
      return 'json';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'vue':
      return 'vue';
    case 'svelte':
      return 'svelte';
    case 'md':
    case 'markdown':
      return 'markdown';
    default:
      return 'plaintext';
  }
}

// In-flight indexing map: repoKey -> Promise<result>
const inFlightIndexing = new Map();

export class CodebaseIndexer {
  /**
   * Generates a canonical repository identifier (e.g. "facebook/react" or "owner/repo")
   */
  getRepoKey(owner, repo) {
    return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
  }

  /**
   * Check if repository is indexed and return status
   */
  async getStatus(ownerOrId, repo) {
    let repoKey = ownerOrId;
    if (repo) {
      repoKey = this.getRepoKey(ownerOrId, repo);
    }

    const res = await db.query(
      `SELECT id, owner, name, full_name, default_branch, head_commit_sha, total_files, total_chunks, last_indexed_at 
       FROM repositories WHERE id = $1 OR full_name = $1`,
      [repoKey]
    );

    if (res.rows.length === 0) {
      return {
        isIndexed: false,
        repositoryId: repoKey,
      };
    }

    const row = res.rows[0];
    return {
      isIndexed: row.total_chunks > 0,
      repositoryId: row.id,
      owner: row.owner,
      repo: row.name,
      fullName: row.full_name,
      branch: row.default_branch,
      headCommitSha: row.head_commit_sha,
      totalFiles: row.total_files,
      totalChunks: row.total_chunks,
      lastIndexedAt: row.last_indexed_at,
    };
  }

  /**
   * List all indexed repositories in database
   */
  async listIndexedRepositories() {
    const res = await db.query(
      `SELECT id, owner, name, full_name, default_branch, total_files, total_chunks, last_indexed_at 
       FROM repositories 
       WHERE total_chunks > 0 
       ORDER BY last_indexed_at DESC`
    );
    return res.rows;
  }

  /**
   * Index or re-index a repository into PostgreSQL + pgvector
   */
  async indexRepository({ accessToken, owner, repo, branch, force = false }) {
    if (!owner || !repo) {
      throw new Error('Both owner and repo are required for codebase indexing');
    }

    const repoKey = this.getRepoKey(owner, repo);

    // 1. Deduplicate concurrent indexing requests in flight
    if (!force && inFlightIndexing.has(repoKey)) {
      console.log(`[CodebaseIndexer] Reusing in-flight indexing process for ${repoKey}...`);
      return await inFlightIndexing.get(repoKey);
    }

    // 2. Performance check: Skip if repository is already indexed and unchanged
    if (!force) {
      const existing = await db.query(
        `SELECT id, head_commit_sha, total_files, total_chunks, last_indexed_at, default_branch 
         FROM repositories WHERE LOWER(id) = LOWER($1)`,
        [repoKey]
      );

      if (existing.rows.length > 0 && existing.rows[0].total_chunks > 0) {
        const row = existing.rows[0];
        const targetBranch = branch || row.default_branch || 'main';
        const headCommitSha = await githubService.getBranchCommitSha(accessToken, owner, repo, targetBranch);

        const isShaMatch = headCommitSha && row.head_commit_sha && row.head_commit_sha === headCommitSha;
        const isRecentlyIndexed = row.last_indexed_at && (Date.now() - new Date(row.last_indexed_at).getTime() < 30 * 60 * 1000);

        if (isShaMatch || (!headCommitSha && isRecentlyIndexed)) {
          console.log(`[CodebaseIndexer] Repository ${repoKey} is already indexed (${row.total_chunks} chunks). Skipping re-index.`);
          return {
            isCached: true,
            repositoryId: repoKey,
            owner,
            repo,
            branch: targetBranch,
            headCommitSha: row.head_commit_sha,
            totalFiles: row.total_files,
            totalChunks: row.total_chunks,
            lastIndexedAt: row.last_indexed_at,
            message: 'Repository is up to date. Using cached vector index.',
          };
        }
      }
    }

    const runIndexing = async () => {
      console.log(`[CodebaseIndexer] Starting indexing for repository: ${repoKey} (force=${force})`);

      // 1. Fetch remote repository details
      const repoDetails = await githubService.getRepoDetails(accessToken, owner, repo);
      const targetBranch = branch || repoDetails.default_branch || 'main';

      // 2. Fetch latest branch commit SHA
      const headCommitSha = await githubService.getBranchCommitSha(accessToken, owner, repo, targetBranch);

      // 3. Fetch complete git tree
      console.log(`[CodebaseIndexer] Fetching tree for ${repoKey} on branch ${targetBranch}...`);
      const tree = await githubService.getRepoTree(accessToken, owner, repo, targetBranch);

    if (!Array.isArray(tree) || tree.length === 0) {
      throw new Error(`No files found in git tree for branch "${targetBranch}"`);
    }

    // 5. Filter candidate source files
    const candidateFiles = tree.filter((item) => {
      if (item.type !== 'blob') return false;

      const pathSegments = item.path.split('/');
      const fileName = pathSegments[pathSegments.length - 1];
      const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';

      // Skip ignored directories
      if (pathSegments.some((seg) => IGNORED_DIRECTORIES.has(seg))) return false;

      // Skip ignored files
      if (IGNORED_FILENAMES.has(fileName)) return false;

      // Skip binary extensions
      if (ext && BINARY_EXTENSIONS.has(ext)) return false;

      // Skip minified or bundle files
      if (fileName.includes('.min.') || fileName.includes('.bundle.')) return false;

      // Skip files exceeding max size
      if (item.size && item.size > MAX_FILE_SIZE) return false;

      // Must match recognized code extension
      return ext ? CODE_EXTENSIONS.has(ext) : false;
    })
    .map((item) => ({
      ...item,
      score: scoreFilePath(item.path),
    }))
    .sort((a, b) => b.score - a.score);

    const filesToFetch = candidateFiles.slice(0, MAX_FILES_INDEX_LIMIT);
    console.log(`[CodebaseIndexer] ${candidateFiles.length} candidate files found. Fetching contents for top ${filesToFetch.length} prioritized files...`);

    // 6. Concurrently fetch raw file contents in batches
    const fetchedFiles = [];
    const fetchBatchSize = 6;

    for (let i = 0; i < filesToFetch.length; i += fetchBatchSize) {
      const slice = filesToFetch.slice(i, i + fetchBatchSize);
      const results = await Promise.all(
        slice.map(async (fileItem) => {
          try {
            const rawContent = await githubService.getRawFileContent(
              accessToken,
              owner,
              repo,
              fileItem.path,
              targetBranch
            );
            return { fileItem, rawContent };
          } catch (err) {
            console.warn(`[CodebaseIndexer] Skipping file ${fileItem.path}: ${err.message}`);
            return { fileItem, rawContent: null };
          }
        })
      );

      for (const { fileItem, rawContent } of results) {
        if (!rawContent || !rawContent.trim()) continue;
        fetchedFiles.push({
          path: fileItem.path,
          language: detectLanguage(fileItem.path),
          content: rawContent,
        });
      }
    }

    if (fetchedFiles.length === 0) {
      throw new Error('No valid source code content could be fetched from repository');
    }

    // 7. Split code files into meaningful chunks
    console.log(`[CodebaseIndexer] Chunking ${fetchedFiles.length} source code files...`);
    const allChunks = codeChunker.chunkFiles(fetchedFiles);

    // 8. Deduplicate chunks by content hash
    const seenHashes = new Set();
    const uniqueChunks = [];
    for (const chunk of allChunks) {
      if (!seenHashes.has(chunk.contentHash)) {
        seenHashes.add(chunk.contentHash);
        uniqueChunks.push(chunk);
      }
      if (uniqueChunks.length >= MAX_TOTAL_CHUNKS) break;
    }

    console.log(`[CodebaseIndexer] Generated ${uniqueChunks.length} unique chunks (capped at ${MAX_TOTAL_CHUNKS}) from ${fetchedFiles.length} files. Generating embeddings...`);

    // 9. Generate embeddings for chunks
    // Prepare embedding input text: include file path context so semantic vector contains file identity
    const textsToEmbed = uniqueChunks.map(
      (c) => `File: ${c.filePath} (${c.language}, lines ${c.startLine}-${c.endLine})\n\n${c.chunkContent}`
    );

    const embeddings = await embeddingService.generateBatchEmbeddings(textsToEmbed);

    if (embeddings.length !== uniqueChunks.length) {
      throw new Error(`Embedding count mismatch: expected ${uniqueChunks.length}, got ${embeddings.length}`);
    }

    // Attach embedding vectors
    uniqueChunks.forEach((chunk, idx) => {
      chunk.embedding = embeddings[idx];
    });

    // 10. Store in PostgreSQL transaction
    console.log(`[CodebaseIndexer] Storing ${uniqueChunks.length} chunks in PostgreSQL + pgvector...`);
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert repository entry
      await client.query(
        `INSERT INTO repositories (
           id, owner, name, full_name, default_branch, head_commit_sha,
           total_files, total_chunks, last_indexed_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           head_commit_sha = EXCLUDED.head_commit_sha,
           total_files = EXCLUDED.total_files,
           total_chunks = EXCLUDED.total_chunks,
           last_indexed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP;`,
        [
          repoKey,
          owner,
          repo,
          `${owner}/${repo}`,
          targetBranch,
          headCommitSha || '',
          fetchedFiles.length,
          uniqueChunks.length,
        ]
      );

      // Delete existing chunks for this repository to avoid orphaned or duplicate records
      await client.query('DELETE FROM code_chunks WHERE repository_id = $1', [repoKey]);

      // Bulk insert chunks
      const insertQuery = `
        INSERT INTO code_chunks (
          repository_id, file_path, language, chunk_index,
          start_line, end_line, chunk_content, content_hash,
          token_estimate, embedding
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector);
      `;

      for (const chunk of uniqueChunks) {
        // Format vector as string '[val1, val2, ...]'
        const vectorStr = `[${chunk.embedding.join(',')}]`;
        await client.query(insertQuery, [
          repoKey,
          chunk.filePath,
          chunk.language,
          chunk.chunkIndex,
          chunk.startLine,
          chunk.endLine,
          chunk.chunkContent,
          chunk.contentHash,
          chunk.tokenEstimate,
          vectorStr,
        ]);
      }

      await client.query('COMMIT');
      console.log(`✅ [CodebaseIndexer] Successfully indexed ${repoKey} (${fetchedFiles.length} files, ${uniqueChunks.length} chunks).`);

      return {
        isCached: false,
        repositoryId: repoKey,
        owner,
        repo,
        branch: targetBranch,
        headCommitSha,
        totalFiles: fetchedFiles.length,
        totalChunks: uniqueChunks.length,
        lastIndexedAt: new Date().toISOString(),
        message: `Successfully indexed ${fetchedFiles.length} files and ${uniqueChunks.length} chunks.`,
      };
    } catch (dbErr) {
      await client.query('ROLLBACK');
      console.error('[CodebaseIndexer] Transaction rollback due to error:', dbErr.message);
      throw dbErr;
    } finally {
      client.release();
    }
  };

  const indexPromise = runIndexing();
  inFlightIndexing.set(repoKey, indexPromise);

  try {
    return await indexPromise;
  } finally {
    inFlightIndexing.delete(repoKey);
  }
}
}

export const codebaseIndexer = new CodebaseIndexer();
export default codebaseIndexer;
