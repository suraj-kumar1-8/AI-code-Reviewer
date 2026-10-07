# AI GitHub Code Reviewer

> **Production-Grade AI Code Review, Intelligent Codebase Insights (RAG), and Automated Pull Request Auditing Engine.**  
> Powered by **Google Gemini AI**, **PostgreSQL + pgvector**, **GitHub REST API & Webhooks**, and a modern developer-first SaaS interface.

---

## 📑 Table of Contents
1. [Overview](#-overview)
2. [Key Features](#-key-features)
3. [Architecture & System Flow](#-architecture--system-flow)
4. [Tech Stack](#-tech-stack)
5. [Core Pipelines](#-core-pipelines)
   - [GitHub OAuth Flow](#1-github-oauth-flow)
   - [AI Code Review Flow](#2-ai-code-review-flow)
   - [RAG Semantic Vector Search & Q&A](#3-rag-semantic-vector-search--qa)
   - [GitHub Webhooks & PR Automation](#4-github-webhooks--pr-automation)
6. [API Endpoints Reference](#-api-endpoints-reference)
7. [Environment Configuration](#-environment-configuration)
8. [Local Development Setup](#-local-development-setup)
9. [Deployment Guide](#-deployment-guide)
   - [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
   - [Backend Deployment (Render / Railway)](#backend-deployment-render--railway)
   - [Database Setup (Cloud PostgreSQL + pgvector)](#database-setup-cloud-postgresql--pgvector)
10. [Security & Isolation Standards](#-security--isolation-standards)
11. [Screenshots & UI Showcase](#-screenshots--ui-showcase)
12. [Future Improvements](#-future-improvements)

---

## 🌟 Overview

**AI GitHub Code Reviewer** is an enterprise-grade developer productivity platform designed to eliminate code review bottlenecks, detect subtle runtime regressions, audit security vulnerabilities before deployment, and enable developers to perform semantic Q&A across entire repositories.

By combining real-time GitHub OAuth integration, vector embeddings with PostgreSQL `pgvector`, and Google Gemini's reasoning models, the platform delivers actionable line-level code reviews, automated PR inspection comments, and zero-hallucination codebase question-answering.

---

## ⚡ Key Features

- **GitHub OAuth 2.0 Integration**: Direct authorization with GitHub, encrypted HTTP-only session cookies, and user repository synchronization.
- **8-Dimension AI Code Review Engine**: Evaluates code across Security, Bugs, Performance, Quality, Maintainability, Error Handling, Bad Practices, and Architecture with line-level findings and actionable code recommendations.
- **Ask Your Codebase (RAG)**: Full-codebase vector search powered by PostgreSQL + `pgvector` with HNSW cosine distance indexing and grounded Gemini answering.
- **Zero Hallucination Guardrails**: Cites exact source files, line ranges, and code snippets. If context is missing, it explicitly informs the user rather than guessing.
- **GitHub Webhook Automation**: Receives and verifies `pull_request.opened`, `synchronize`, and `reopened` events with HMAC SHA-256 signatures.
- **PR Diff Inspection & Auto-Commenting**: Automatically analyzes changed files in pull requests and posts structured review findings directly to GitHub pull request comments.
- **Intelligent Caching & Deduplication**: Prevents repeated analysis of unchanged repositories and identical commit SHAs `(repository_id, pr_number, commit_sha)`.
- **Gemini Rate Limiter Resilience**: Automatically detects HTTP 429 quota exhaustion, respects `retry-after` delays, and fails over to candidate generation models without failing reviews.
- **Executive Real-Data Dashboard**: Real-time KPI metrics (Total Reviews, Risk Distribution, Average Health Score, Clean PR count) calculated directly from real database records.

---

## 🏛️ Architecture & System Flow

```mermaid
flowchart TB
    subgraph Client ["Frontend (React 19 + TypeScript + Vite)"]
        UI[Developer SaaS Dashboard]
        AskUI[Ask Codebase RAG Chat]
        PRUI[Pull Request Review Hub]
    end

    subgraph GitHub ["GitHub Platform"]
        GH_OAuth[GitHub OAuth 2.0]
        GH_API[GitHub REST API]
        GH_Hooks[GitHub Webhook Deliveries]
    end

    subgraph Server ["Backend (Node.js + Express)"]
        AuthCtrl[Auth Controller & JWT Cookies]
        ReviewEngine[Review Engine & Rate Limiter]
        Chunker[Code Chunker & Ingest Pipeline]
        RAGService[RAG Engine]
        WebhookCtrl[Webhook Controller & HMAC Verifier]
    end

    subgraph AI ["AI & Vector Services"]
        GeminiFlash[Google Gemini 3.1 Flash Lite]
        GeminiEmbed[gemini-embedding-001 (768-dim)]
    end

    subgraph DB ["Database (PostgreSQL + pgvector)"]
        RepoTable[(repositories)]
        ChunksTable[(code_chunks + HNSW Index)]
        PRReviewsTable[(pr_reviews)]
    end

    UI -->|HTTP / Cookies| Server
    AskUI -->|Vector Q&A| RAGService
    PRUI -->|PR Management| ReviewEngine

    GH_Hooks -->|POST HMAC SHA-256| WebhookCtrl
    Server -->|Sync Repos & Diffs| GH_API
    Client -->|OAuth Redirect| GH_OAuth

    RAGService -->|Generate Embeddings| GeminiEmbed
    RAGService -->|Cosine Distance <=>| ChunksTable
    RAGService -->|Context + Prompt| GeminiFlash

    ReviewEngine -->|Analyze Diff/Files| GeminiFlash
    Chunker -->|Store Chunks & Embeddings| DB
    WebhookCtrl -->|Deduplicate & Persist| PRReviewsTable
```

---

## 🧰 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons |
| **Backend** | Node.js (ESM), Express 4, Cookie-Parser, CORS, JWT |
| **Database** | PostgreSQL 16 + `pgvector` (Vector similarity search with HNSW indexes) |
| **AI Models** | Google Gemini (`gemini-3.1-flash-lite`, `gemini-embedding-001`) via `@google/genai` |
| **Integrations** | GitHub REST API v3, GitHub Webhooks (HMAC SHA-256) |
| **Deployment** | Vercel (Client SPA), Render / Railway (Backend API), Neon / Supabase (PostgreSQL) |

---

## 🔄 Core Pipelines

### 1. GitHub OAuth Flow
```
User Clicks "Sign in with GitHub"
  │
  ▼
[GET /api/auth/github] ──> Redirects to GitHub OAuth consent dialog
  │
  ▼
[GET /api/auth/github/callback]
  ├── Exchange auth code for GitHub access token
  ├── Retrieve user profile from GitHub API
  ├── Issue signed JWT in HTTP-only, secure, sameSite='lax' cookie
  └── Redirect to /dashboard
```

### 2. AI Code Review Flow
1. **Extraction**: Fetches tree structure and prioritizes code files (`.ts`, `.js`, `.py`, `.go`, `.rs`, `.java`, etc.), filtering out binaries, vendor directories, and lockfiles.
2. **Analysis**: Gemini inspects the codebase across 8 dimensions (Security, Bugs, Performance, Quality, etc.).
3. **Structured Normalization**: JSON parser extracts top-level health score, summary, and findings with line numbers and recommendations.
4. **Resilience**: If Gemini hits 429 quota limits, `modelRateLimiter` triggers fallback models or resilient static lint analysis.

### 3. RAG Semantic Vector Search & Q&A
```
Developer Query: "Where is authentication handled?"
  │
  ▼
[Embedding Service] ──> Generates 768-dimensional vector via gemini-embedding-001
  │
  ▼
[PostgreSQL + pgvector] ──> Executes HNSW cosine distance search (ORDER BY embedding <=> query_vec)
  │
  ▼
[Top K Relevant Code Chunks] ──> Assembled with file paths and line ranges
  │
  ▼
[Gemini Prompt Formulation] ──> Strict grounding instructions (zero hallucination)
  │
  ▼
Output: Grounded technical answer with clickable source references and code snippets
```

### 4. GitHub Webhooks & PR Automation
- **Signature Verification**: Verifies `x-hub-signature-256` header against `GITHUB_WEBHOOK_SECRET` using timing-safe comparisons.
- **Event Filtering**: Only processes `opened`, `synchronize`, and `reopened` actions.
- **Deduplication Key**: Composite key `(repository_id, pr_number, commit_sha)` prevents processing the same commit multiple times.
- **Diff Fetching**: Obtains pull request file diffs, bounds patch length to prevent token overflow, and reviews additions.
- **PR Comments**: Posts executive review results and line observations directly to the pull request on GitHub.

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Server status, DB health & OAuth configuration | No |
| `GET` | `/api/auth/github` | Redirects to GitHub OAuth authorize page | No |
| `GET` | `/api/auth/github/callback` | OAuth code exchange and cookie issuance | No |
| `GET` | `/api/auth/me` | Fetch authenticated session profile | Yes (Cookie) |
| `POST` | `/api/auth/logout` | Clears session cookie | Yes (Cookie) |
| `GET` | `/api/repos` | List authenticated user's repositories | Yes (Cookie) |
| `GET` | `/api/repos/:owner/:repo` | Fetch single repository details | Yes (Cookie) |
| `POST` | `/api/reviews/analyze` | Run full repository AI code review | Yes (Cookie) |
| `GET` | `/api/reviews/:owner/:repo` | Get cached repository review | Yes (Cookie) |
| `POST` | `/api/codebase/index` | Chunk & index repository into pgvector | Yes (Cookie/Token) |
| `POST` | `/api/codebase/ask` | Ask semantic question to indexed codebase | Yes (Cookie/Token) |
| `GET` | `/api/codebase/status` | Check repository indexing status & chunk count | No |
| `GET` | `/api/codebase/repositories` | List all indexed repositories in database | No |
| `POST` | `/api/webhooks/github` | Receive & process GitHub pull request webhooks | HMAC Header |
| `GET` | `/api/reviews/pr` | List pull request reviews from database | No |
| `GET` | `/api/reviews/pr/:owner/:repo/:prNumber` | Get single PR review details | No |
| `POST` | `/api/reviews/pr/analyze` | Trigger on-demand review for public or private PR | Optional Token |

---

## ⚙️ Environment Configuration

Create a `.env` file in the root or `server/` directory:

```env
# Server Network
PORT=5001
NODE_ENV=development

# Frontend Client URL (used for CORS and OAuth redirects)
CLIENT_URL=http://localhost:5173

# JWT Session Encryption
JWT_SECRET=your_super_secret_jwt_encryption_key_min_32_chars

# GitHub OAuth Application
# Create at: https://github.com/settings/developers
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5001/api/auth/github/callback

# GitHub Webhook HMAC Secret
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret_for_hmac

# Google Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
AI_PROVIDER=gemini

# PostgreSQL + pgvector Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/code_reviewer
```

Client configuration (`client/.env`):
```env
# Optional in development (uses Vite proxy). Set in production:
# VITE_API_URL=https://your-api.onrender.com/api
VITE_API_URL=/api
```

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js**: v18 or v20+
- **Docker**: For running PostgreSQL with `pgvector` locally
- **Google Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/app/apikey)
- **GitHub OAuth App**: From [GitHub Developer Settings](https://github.com/settings/developers)

### 2. Start PostgreSQL + pgvector (Docker)
```bash
docker run -d \
  --name ai_code_reviewer_pgvector \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=code_reviewer \
  -p 5433:5432 \
  pgvector/pgvector:pg16
```

### 3. Configure GitHub OAuth App
1. Navigate to **GitHub Settings** $\rightarrow$ **Developer settings** $\rightarrow$ **OAuth Apps** $\rightarrow$ **New OAuth App**.
2. Set:
   - **Application name**: `AI GitHub Code Reviewer`
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:5001/api/auth/github/callback`
3. Click **Register application**.
4. Generate a **Client Secret** and copy both `Client ID` and `Client Secret` into your `.env`.

### 4. Configure Google Gemini API
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **Create API key** and copy it.
3. Set `GEMINI_API_KEY=your_key` in your `.env`.

### 5. Configure GitHub Webhook (Optional for local, required for live PR auto-reviews)
1. In your GitHub repository, go to **Settings** $\rightarrow$ **Webhooks** $\rightarrow$ **Add webhook**.
2. Set:
   - **Payload URL**: `https://<your-public-url>/api/webhooks/github` (use [smee.io](https://smee.io) or ngrok for local development)
   - **Content type**: `application/json`
   - **Secret**: Any secure random string matching `GITHUB_WEBHOOK_SECRET` in `.env`
   - **Events**: Select **Let me select individual events** and check **Pull requests**.

### 6. Install Dependencies
```bash
# In project root
npm install
```

### 7. Start Backend Server
```bash
cd server
npm run dev
# Server listens on http://localhost:5001
```

### 8. Start Frontend Client
```bash
cd client
npm run dev
# Vite runs on http://localhost:5173
```

### 9. Automated Verification Test Suite
Run the comprehensive Day 7 audit test suite:
```bash
node server/scripts/run-day7-audit.js
```

---

## 🚀 Deployment Guide

### Frontend Deployment (Vercel)
1. Push your repository to GitHub.
2. In Vercel, import the project and set the **Root Directory** to `client`.
3. Set **Framework Preset** to `Vite`.
4. Configure Environment Variables:
   - `VITE_API_URL`: `https://<your-backend-domain>/api`
5. Single-Page Application routing is automatically handled via `client/vercel.json`.

### Backend Deployment (Render / Railway)
1. **Using Render Blueprint (`render.yaml`)**:
   - In Render, click **New** $\rightarrow$ **Blueprint** and link your repository.
   - Render automatically provisions the web service and PostgreSQL database.
2. **Manual Web Service Setup**:
   - Environment: `Node`
   - Root Directory: `server`
   - Build Command: `npm install --production`
   - Start Command: `npm start`
   - Environment Variables:
     - `PORT`: `10000`
     - `NODE_ENV`: `production`
     - `CLIENT_URL`: `https://<your-frontend-domain>.vercel.app`
     - `GITHUB_CLIENT_ID`: Your OAuth App Client ID
     - `GITHUB_CLIENT_SECRET`: Your OAuth App Client Secret
     - `GITHUB_CALLBACK_URL`: `https://<your-backend-domain>/api/auth/github/callback`
     - `GITHUB_WEBHOOK_SECRET`: Your webhook HMAC secret
     - `GEMINI_API_KEY`: Your Gemini API Key
     - `GEMINI_MODEL`: `gemini-3.1-flash-lite`
     - `DATABASE_URL`: Connection string to your cloud PostgreSQL database

### Database Setup (Cloud PostgreSQL + pgvector)
Compatible with **Neon**, **Supabase**, **Render Postgres**, or **AWS Aurora**:
1. Create a PostgreSQL 16+ instance.
2. The server automatically runs schema migrations on startup, enabling the `vector` extension, creating tables, and establishing the HNSW index!

---

## 🔒 Security & Isolation Standards

- **Untrusted Code Never Executed**: The system strictly treats code as static text data. It **never** invokes `eval()`, shell commands, compilers, or interpreters on repository files.
- **Sealed Secrets**: All API keys, database credentials, and GitHub client secrets remain backend-only. Tokens are never exposed in logs or sent to the browser.
- **Constant-Time HMAC Verification**: Webhooks are verified using `crypto.timingSafeEqual` to prevent timing attack vulnerabilities.
- **Parameterized Queries**: All database interactions use parameterized placeholders (`$1`, `$2`), eliminating SQL injection vectors.
- **HTTP-Only Cookies**: JWT authentication sessions are stored in HTTP-only, SameSite-protected cookies.

---

## 📸 Screenshots & UI Showcase

- **Executive Dashboard**: Real-time KPI counters, Risk Distribution bars, PR Review Feed, and Connected Repositories.
- **Interactive Review Workspace**: Line-level code inspection with severity tags, category filters, and suggested code patches.
- **Ask Your Codebase (RAG)**: Chat interface grounded in pgvector embeddings with source citations and line numbers.
- **Pull Request Review Hub**: Live audit history from GitHub webhooks with instant modal inspection.

---

## 🔮 Future Improvements

- [ ] Automated GitHub Action wrapper for integration in CI/CD workflows.
- [ ] Multi-turn interactive discussions directly within PR review comments.
- [ ] Support for self-hosted local LLMs (Ollama / vLLM) as alternative review providers.
- [ ] Automated PR autofix creation with one-click pull request generation.

---

## 📄 License
MIT License. Built for modern software engineering teams.
# AI-code-Reviewer
