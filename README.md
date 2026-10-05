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
  - "Analyze Repository" button linking directly to the review workspace.

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
[Controllers (server/src/controllers/*.js)]
      │
      ▼
[GitHub Service (server/src/services/githubService.js)]
      │  (Bearer token authentication)
      ▼
[GitHub REST API (https://api.github.com)]
```

---

## 🔑 GitHub OAuth Setup Guide

To connect the application to real GitHub accounts, create a GitHub OAuth App:

### Step 1: Create a GitHub OAuth Application
1. Go to your GitHub account: **Settings** → **Developer settings** → **OAuth Apps** (or visit [https://github.com/settings/developers](https://github.com/settings/developers)).
2. Click **New OAuth App**.
3. Fill in the application details:
   - **Application name**: `AI Code Reviewer`
   - **Homepage URL**: `http://localhost:5173`
   - **Application description**: `AI-powered GitHub code review platform`
   - **Authorization callback URL**: `http://localhost:5001/api/auth/github/callback`
4. Click **Register application**.

### Step 2: Generate Client Secret
1. On the newly created application page, copy the **Client ID**.
2. Click **Generate a new client secret** and copy the generated **Client Secret**.

### Step 3: Configure Environment Variables
Open `server/.env` and insert your credentials:

```env
PORT=5001
JWT_SECRET=your_super_secret_jwt_key_min_32_characters
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_CALLBACK_URL=http://localhost:5001/api/auth/github/callback
FRONTEND_URL=http://localhost:5173
```

> **Security Note:** Never commit `server/.env` to source control. It is already added to `.gitignore`.

---

## ⚡ Running the Project Locally

### 1. Start the Backend API Server
```bash
cd server
npm install
npm run dev
# Server runs on http://localhost:5001
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
1. Click **Sign In** or **Get Started**.
2. Click **Continue with GitHub**.
3. Authorize the application on GitHub.
4. You will be redirected to the Dashboard displaying your real GitHub repositories!
5. Search, filter by Public/Private, or click **Analyze Repository** to view the review page.

---

## 📁 Repository Structure

```
ai-github-code-reviewer/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/          # ProtectedRoute guard
│   │   │   ├── ui/            # Button, Badge, Card, etc.
│   │   │   ├── layout/        # Navbar, Footer, Sidebar
│   │   │   └── landing/       # Hero, CodePreview, Features, etc.
│   │   ├── context/           # AuthContext (user session state)
│   │   ├── pages/
│   │   │   ├── Landing.tsx    # Approved SaaS Landing Page
│   │   │   ├── Login.tsx      # GitHub OAuth Login Page
│   │   │   ├── Dashboard.tsx  # Real Repositories Dashboard
│   │   │   └── Review.tsx     # Code Review & Issue Explorer
│   │   ├── services/
│   │   │   └── api.ts         # Centralized API service
│   │   ├── types/             # TypeScript definitions (GitHubUser, GitHubRepo, etc.)
│   │   └── App.tsx
│   └── vite.config.ts         # Proxies /api requests to localhost:5001
│
├── server/
│   ├── src/
│   │   ├── config/            # Environment & endpoint constants
│   │   ├── controllers/       # authController, repoController
│   │   ├── middleware/        # authMiddleware (JWT cookie verification)
│   │   ├── routes/            # authRoutes, repoRoutes
│   │   ├── services/          # githubService (GitHub REST API calls)
│   │   └── server.js          # Express app entrypoint
│   ├── .env                   # GitHub OAuth credentials & JWT secret
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 🔒 Security Measures

- **No Secrets on Frontend**: The GitHub Client Secret and GitHub Access Token are strictly kept backend-side and never sent to the browser or stored in `localStorage`.
- **HTTP-Only Cookies**: User sessions use signed JWT tokens encapsulated inside an `httpOnly`, `sameSite: 'lax'` cookie (`acr_session`), preventing XSS token theft.
- **CORS Protection**: Access to backend endpoints is strictly restricted to the frontend origin with credentials enabled.
