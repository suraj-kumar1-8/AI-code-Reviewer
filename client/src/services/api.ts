import type { GitHubUser, GitHubRepo } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = {
  /**
   * Health check
   */
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      return await res.json();
    } catch (err: any) {
      return { status: 'offline', message: err.message };
    }
  },

  /**
   * Get GitHub OAuth login URL
   */
  getGitHubLoginUrl() {
    return `${API_BASE_URL}/auth/github`;
  },

  /**
   * Fetch currently authenticated user via session cookie
   */
  async getMe(): Promise<{ authenticated: boolean; user?: GitHubUser; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (res.status === 401) {
        return { authenticated: false };
      }

      if (!res.ok) {
        throw new Error(`Failed to verify session: ${res.statusText}`);
      }

      return await res.json();
    } catch (err: any) {
      console.warn('[api.getMe] Session check failed:', err.message);
      return { authenticated: false, error: err.message };
    }
  },

  /**
   * Log out of current session
   */
  async logout(): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });
      return await res.json();
    } catch (err: any) {
      console.error('[api.logout] Logout failed:', err.message);
      return { success: false, message: err.message };
    }
  },

  /**
   * Fetch authenticated user's real GitHub repositories
   */
  async getRepos(params?: { sort?: string; type?: string }): Promise<{
    success: boolean;
    count: number;
    repositories: GitHubRepo[];
    error?: string;
  }> {
    const query = new URLSearchParams();
    if (params?.sort) query.set('sort', params.sort);
    if (params?.type) query.set('type', params.type);

    const res = await fetch(`${API_BASE_URL}/repos?${query.toString()}`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.details || `Failed to fetch repos: ${res.statusText}`);
    }

    return await res.json();
  },

  /**
   * Fetch single repository details
   */
  async getRepo(owner: string, repo: string): Promise<{
    success: boolean;
    repository: GitHubRepo;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/repos/${owner}/${repo}`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch repository ${owner}/${repo}`);
    }

    return await res.json();
  },
};

export default api;
