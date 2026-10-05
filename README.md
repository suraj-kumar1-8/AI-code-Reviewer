# AI Code Reviewer ✦

> An AI-powered GitHub code review platform that analyzes repositories, detects bugs and security vulnerabilities, evaluates code quality & performance, and provides intelligent codebase insights.

---

## 🚀 Progress & Milestones

### ✅ Day 1 — Foundation & UI Design
- Modern, responsive SaaS Landing Page matching the approved dark developer design.
- Design System & Color Palette (Deep dark background `#080F1A`, Indigo `#6366F1`, Purple `#8B5CF6`, Cyan `#06B6D4`).
- Routing structure (`/`, `/login`, `/dashboard`, `/review/:id`).
- Interactive code review preview, issue category tabs, and modal inspection views.

### ✅ Day 2 — GitHub OAuth & Repository Integration
- **Real GitHub OAuth Flow**:
  - Secure authorization code grant exchange on the Express backend.
  - Client ID & Secret kept securely in `server/.env`.
  - GitHub access tokens never exposed to frontend code or `localStorage`.
- **Authentication & Protected Routes**:
  - Encrypted, HTTP-only JWT session cookie (`acr_session`).
  - Session verification endpoint (`/api/auth/me`).
  - Route guard (`ProtectedRoute`) protecting `/dashboard` and `/review/*`.
  - Secure session termination and logout (`/api/auth/logout`).
- **GitHub Profile Integration**:
  - Displays authenticated user's avatar, username, name, and bio in Navbar, Sidebar, and Dashboard header.
- **Real Repositories via GitHub REST API**:
  - Fetches user repositories directly from GitHub API (`/api/repos`).
  - Displays name, owner, description, primary language with color indicators, star count, fork count, visibility (Public/Private), and last updated date.
- **Repository Dashboard**:
  - Live search by repo name, language, or description.
  - Filter chips for **All**, **Public**, and **Private** repositories.
  - Sort by Recently Updated, Most Stars, or Alphabetical.
  - Pulsing loading skeletons during network fetch.
  - Informative empty and error states with quick retry/refresh actions.

### ✅ Day 3 — Real Repository Analysis & AI Code Review
- **Repository File Extraction (`repoFileFetcher`)**:
  - Fetches repository tree and raw source code files using GitHub REST API.
  - Ignores `.git`, `node_modules`, `dist`, `build`, binaries, and lockfiles.
  - Filters and prioritizes common programming language files (`.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.java`, `.go`, `.rs`, `.c`, `.cpp`, `.cs`, `.php`, `.rb`, etc.).
  - Enforces safe file-size limit (50 KB/file) and total file budget to prevent memory flooding.
- **Backend AI Review Architecture (`aiService`)**:
  - Reusable AI code review service supporting **Google Gemini API** (`gemini-2.0-flash`) and **OpenAI API** (`gpt-4o-mini`).
  - Resilient AST/heuristic static security and bug analysis engine fallback when API keys are not provided or quotas are reached.
  - In-memory review cache to optimize repeat inspections and prevent duplicate AI requests.
  - Inspects code across 6 pillars:
    1. Bugs & Logic Errors
    2. Security Vulnerabilities (injection, hardcoded secrets, auth risks)
    3. Performance Bottlenecks & Synchronous I/O
    4. Code Quality & Formatting
    5. Maintainability & Architecture
    6. Best Practices
- **Structured JSON Schema**:
  - Returns `summary`, `score` (0-100), `metrics` (`codeQuality`, `security`, `performance`, `maintainability`), and structured `issues` list with `severity`, `category`, `file`, `line`, `title`, `description`, `recommendation`, `codeSnippet`, and `fixedCodeSnippet`.
- **Interactive Review Page (`/review/:id` & `/review/:owner/:repo`)**:
  - Executive AI summary card with file counts.
  - Health score circular gauge with status verdict.
  - Sub-metrics breakdown (Code Quality, Security, Performance, Maintainability).
  - Severity breakdown pills (Critical, High, Medium, Low).
  - Category filter tabs (Overview, Security, Bugs, Performance, Code Quality).
  - Severity filter dropdown.
  - Code inspection modal displaying detected issue code, diagnosis, and recommended refactor snippet.
  - Animated scanning loading state, empty state, and error handling with retry actions.
  - Duplicate request prevention on "Analyze Repository" triggers.

---

## 🛠️ Clean Architecture

The application strictly follows a decoupled, layered architecture:

```
[Client (React 19 + TypeScript)]
      │
      ▼
[API Service Layer (client/src/services/api.ts)]
      │  (HTTP / JSON with credentials: 'include')
      ▼
[Express Routes (server/src/routes/*.js)]
      │
      ▼
[Controllers (server/src/controllers/reviewController.js)]
      │
      ▼
[GitHub Service & Repository File Fetcher]
      │  (GitHub REST API - Tree & Blobs)
      ▼
[AI Review Service (server/src/services/aiService.js)]
      │
      ├──> Google Gemini 2.0 Flash / OpenAI API
      └──> Resilient Static Code Analysis Engine (Fallback)
```

---

## 🔑 Environment & AI Setup Guide

To configure GitHub OAuth and the AI engine, edit [`server/.env`](file:///Users/surajkumar/AI%20Code%20Reviewer/server/.env):

```env
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JWT_SECRET=ai-code-reviewer-super-secret-jwt-key-2026

# GitHub OAuth App Credentials
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5001/api/auth/github/callback

# AI Code Review Engine (Optional: Generative AI Reasoning)
# 1. Google Gemini (Recommended): Get key from https://aistudio.google.com/
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash

# 2. OpenAI (Optional Alternative): Get key from https://platform.openai.com/
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

> **Note:** If no AI API key is set, the application automatically uses its built-in static security and bug analysis engine to scan the real code, ensuring 100% functionality out of the box!

---

## ⚡ Running the Project Locally

### 1. Start the Backend API Server
```bash
cd server
npm install
npm run dev
# Server listens on http://localhost:5001
```

### 2. Start the Frontend Client
In a separate terminal:
```bash
cd client
npm install
npm run dev
# Client runs on http://localhost:5173
```

### 3. Open in Browser
Visit **[http://localhost:5173](http://localhost:5173)**:
1. Click **Sign In** $\rightarrow$ **Continue with GitHub**.
2. Authorize via GitHub OAuth.
3. On the Dashboard, browse your real GitHub repositories.
4. Click **Analyze Repository** on any repository card.
5. The review page will fetch the repository source tree, analyze the files with AI, and present executive summaries, health metrics, issue breakdowns, and refactor suggestions!

---

## 🔒 Security Standards

- **Zero Client Credential Exposure**: Neither GitHub tokens nor AI API keys are ever sent to the browser or stored in `localStorage`.
- **Untrusted Code Isolation**: The application strictly reads static text files over the GitHub API. It **never** clones, executes, evaluates, or runs untrusted repository code.
- **Input Sanitization**: Repository owner, name, and branch parameters are rigorously validated with strict regex patterns to prevent path traversal or injection.
- **Rate Limit & Size Guards**: Source files are restricted to safe file-size thresholds (50 KB per file) and a maximum total file budget to prevent memory exhaustion and API quota abuse.
