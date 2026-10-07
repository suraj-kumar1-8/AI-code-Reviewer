import { githubService } from './githubService.js';
import { config } from '../config/index.js';
import db from '../db/index.js';

// Safe characters pattern to prevent path traversal or command injection
const SAFE_IDENTIFIER_REGEX = /^[a-zA-Z0-9_.-]+$/;

// Common programming language extensions to inspect
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
  'vue', 'svelte',
]);

// Folders to completely ignore during repository scanning
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

// Files to explicitly skip
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

// Safety constraints
const MAX_FILE_SIZE = 50 * 1024; // 50 KB max per file
const MAX_FILES_LIMIT = 15;      // Inspect top 15 most important files
const MAX_TOTAL_CHARS = 70000;   // Character budget for AI payload

/**
 * Validates repository owner, name and branch
 */
function validateRepositoryIdentifiers(owner, repo, branch) {
  if (!owner || !SAFE_IDENTIFIER_REGEX.test(owner)) {
    throw new Error(`Invalid repository owner: "${owner}". Must be alphanumeric with - or _`);
  }
  if (!repo || !SAFE_IDENTIFIER_REGEX.test(repo)) {
    throw new Error(`Invalid repository name: "${repo}". Must be alphanumeric with - or _`);
  }
  if (branch && !/^[a-zA-Z0-9/_.-]+$/.test(branch)) {
    throw new Error(`Invalid branch name: "${branch}"`);
  }
}

/**
 * Maps file extension to a normalized language identifier
 */
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
    default:
      return 'plaintext';
  }
}

/**
 * Assigns an importance score to prioritize core application logic
 */
function scoreFilePath(path) {
  const lower = path.toLowerCase();
  let score = 10;

  // Highly prioritize project manifests and architecture configs
  if (
    lower.endsWith('package.json') ||
    lower.endsWith('requirements.txt') ||
    lower.endsWith('go.mod') ||
    lower.endsWith('cargo.toml') ||
    lower.includes('docker-compose') ||
    lower.endsWith('dockerfile')
  ) {
    score += 45;
  }

  // Prioritize primary source directories
  if (lower.startsWith('src/') || lower.includes('/src/')) score += 30;
  if (lower.startsWith('server/') || lower.startsWith('app/') || lower.startsWith('lib/')) score += 25;
  if (lower.includes('controller') || lower.includes('route') || lower.includes('service') || lower.includes('api/')) score += 20;

  // Prioritize application entrypoints
  if (lower.includes('index.') || lower.includes('main.') || lower.includes('server.') || lower.includes('app.')) score += 25;

  // Deprioritize test and mock files
  if (lower.includes('.test.') || lower.includes('.spec.') || lower.includes('__test__') || lower.includes('mock')) {
    score -= 15;
  }

  // Deprioritize typings or style-only files
  if (lower.endsWith('.d.ts') || lower.endsWith('.css') || lower.endsWith('.scss')) {
    score -= 10;
  }

  return score;
}

export const repoFileFetcher = {
  /**
   * Fetches and filters source code files from GitHub repository
   */
  async fetchRepoSourceFiles({ accessToken, owner, repo, branch = 'main' }) {
    // 1. Input Validation
    validateRepositoryIdentifiers(owner, repo, branch);

    const effectiveToken = accessToken || config.github?.token || process.env.GITHUB_TOKEN || null;

    // 2. Fetch repo metadata and git tree with resilient fallback to indexed chunks
    let repoDetails;
    let targetBranch = branch || 'main';
    let tree;

    try {
      repoDetails = await githubService.getRepoDetails(effectiveToken, owner, repo);
      targetBranch = branch || repoDetails.default_branch || 'main';
      tree = await githubService.getRepoTree(effectiveToken, owner, repo, targetBranch);
    } catch (fetchErr) {
      console.warn(`[repoFileFetcher] GitHub fetch note (${fetchErr.message}). Checking indexed PostgreSQL code_chunks...`);
      const repoKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
      const chunkRes = await db.query(
        `SELECT file_path, language, chunk_content, start_line, end_line
         FROM code_chunks
         WHERE repository_id = $1
         ORDER BY file_path, chunk_index ASC;`,
        [repoKey]
      );

      if (chunkRes.rows && chunkRes.rows.length > 0) {
        const fileMap = new Map();
        for (const r of chunkRes.rows) {
          if (!fileMap.has(r.file_path)) {
            fileMap.set(r.file_path, {
              path: r.file_path,
              language: r.language,
              content: r.chunk_content,
              size: r.chunk_content.length,
              lineCount: r.chunk_content.split('\n').length,
            });
          } else {
            const existing = fileMap.get(r.file_path);
            existing.content += '\n' + r.chunk_content;
            existing.size = existing.content.length;
            existing.lineCount = existing.content.split('\n').length;
          }
        }

        const reconstructedFiles = Array.from(fileMap.values());
        console.log(`[repoFileFetcher] Reconstructed ${reconstructedFiles.length} files from indexed chunks for ${repoKey}`);

        return {
          repoDetails: { name: repo, owner: { login: owner }, default_branch: targetBranch },
          targetBranch,
          totalFilesConsidered: reconstructedFiles.length,
          files: reconstructedFiles,
          fromIndexedChunks: true,
        };
      }

      throw fetchErr;
    }

    if (!Array.isArray(tree) || tree.length === 0) {
      return {
        repoDetails,
        files: [],
        totalFilesConsidered: 0,
        targetBranch,
      };
    }

    // 4. Filter for relevant, safe code files
    const candidateFiles = tree
      .filter((item) => {
        // Must be a blob (file), not a sub-tree/directory
        if (item.type !== 'blob') return false;

        const pathSegments = item.path.split('/');
        const fileName = pathSegments[pathSegments.length - 1];
        const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';

        // Skip ignored directories
        if (pathSegments.some((seg) => IGNORED_DIRECTORIES.has(seg))) return false;

        // Skip ignored file names
        if (IGNORED_FILENAMES.has(fileName)) return false;

        // Skip minified or bundle files
        if (fileName.includes('.min.') || fileName.includes('.bundle.')) return false;

        // Skip files exceeding individual size limit
        if (item.size && item.size > MAX_FILE_SIZE) return false;

        // Check extension
        return ext ? CODE_EXTENSIONS.has(ext) : false;
      })
      .map((item) => ({
        ...item,
        score: scoreFilePath(item.path),
      }))
      // Sort by score descending (most important files first)
      .sort((a, b) => b.score - a.score);

    // Limit to top candidate files
    const prioritizedFiles = candidateFiles.slice(0, MAX_FILES_LIMIT);

    // 5. Concurrently fetch raw file contents in batches
    const fetchedFiles = [];
    let currentCharsTotal = 0;
    const batchSize = 4;

    for (let i = 0; i < prioritizedFiles.length; i += batchSize) {
      if (currentCharsTotal >= MAX_TOTAL_CHARS) break;

      const batch = prioritizedFiles.slice(i, i + batchSize);
      const contents = await Promise.all(
        batch.map(async (fileItem) => {
          try {
            const rawContent = await githubService.getRawFileContent(
              effectiveToken,
              owner,
              repo,
              fileItem.path,
              targetBranch
            );
            return { fileItem, rawContent };
          } catch (err) {
            console.warn(`[repoFileFetcher] Skipped ${fileItem.path}: ${err.message}`);
            return { fileItem, rawContent: null };
          }
        })
      );

      for (const { fileItem, rawContent } of contents) {
        if (!rawContent || !rawContent.trim()) continue;

        // Check if adding this file exceeds character budget
        if (currentCharsTotal + rawContent.length > MAX_TOTAL_CHARS && fetchedFiles.length >= 3) {
          continue;
        }

        const lines = rawContent.split('\n');
        fetchedFiles.push({
          path: fileItem.path,
          language: detectLanguage(fileItem.path),
          content: rawContent,
          size: fileItem.size || rawContent.length,
          lineCount: lines.length,
        });

        currentCharsTotal += rawContent.length;
      }
    }

    return {
      repoDetails,
      targetBranch,
      totalFilesConsidered: candidateFiles.length,
      files: fetchedFiles,
    };
  },

  /**
   * Alias for fetchRepoSourceFiles
   */
  async fetchRepositorySourceFiles(args) {
    return this.fetchRepoSourceFiles(args);
  },
};

export default repoFileFetcher;
