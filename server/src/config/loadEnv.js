import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Candidate locations for server/.env
// 1. Relative to this file: server/src/config -> ../../.env (server/.env)
// 2. Relative to process.cwd(): process.cwd()/server/.env
// 3. Relative to process.cwd(): process.cwd()/.env
const candidateEnvPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(process.cwd(), '.env'),
];

let loadedPath = null;

for (const candidate of candidateEnvPaths) {
  if (fs.existsSync(candidate)) {
    const result = dotenv.config({ path: candidate });
    if (!result.error) {
      loadedPath = candidate;
      break;
    }
  }
}

if (!loadedPath) {
  // Final fallback to default dotenv.config()
  dotenv.config();
}

const clientIdLoaded = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_ID.trim());
const clientSecretLoaded = Boolean(process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_CLIENT_SECRET.trim());
const geminiKeyLoaded = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());

console.log(`[Env Loader] Target file: ${loadedPath || 'default process.cwd()/.env'}`);
console.log(`GitHub Client ID loaded: ${clientIdLoaded}`);
console.log(`GitHub Client Secret loaded: ${clientSecretLoaded}`);
console.log(`Gemini API Key loaded: ${geminiKeyLoaded}`);

export const envStatus = {
  loadedPath,
  clientIdLoaded,
  clientSecretLoaded,
  geminiKeyLoaded,
};

export default envStatus;
