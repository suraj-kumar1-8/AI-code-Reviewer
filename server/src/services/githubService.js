import { config } from '../config/index.js';

async function handleGitHubError(response, actionName) {
  if (response.status === 401) {
    throw new Error('Your GitHub authorization session has expired or is invalid. Please sign in with GitHub again.');
  }
  const err = await response.text();
  throw new Error(`Failed to ${actionName}: ${response.status} ${err}`);
}

export const githubService = {
  /**
   * Generates the GitHub OAuth authorization URL
   */
  getOAuthUrl(state) {
    if (!config.github.clientId) {
      throw new Error('GITHUB_CLIENT_ID is not configured in server/.env');
    }
    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: config.github.callbackUrl,
      scope: config.github.scopes,
      state: state || 'acr_state',
    });
    return `${config.github.authorizeUrl}?${params.toString()}`;
  },

  /**
   * Exchanges authorization code for an OAuth access token
   */
  async exchangeCodeForToken(code) {
    if (!config.github.clientId || !config.github.clientSecret) {
      throw new Error('GitHub OAuth Client ID or Client Secret missing in server/.env');
    }

    const response = await fetch(config.github.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
        redirect_uri: config.github.callbackUrl,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
    }

    if (!data.access_token) {
      throw new Error('No access_token returned by GitHub');
    }

    return data.access_token;
  },

  /**
   * Fetches the authenticated user profile from GitHub API
   */
  async getUserProfile(accessToken) {
    const response = await fetch(`${config.github.apiBaseUrl}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Reviewer',
      },
    });

    if (!response.ok) {
      await handleGitHubError(response, 'fetch user profile');
    }

    const user = await response.json();

    return {
      id: user.id,
      login: user.login,
      name: user.name || user.login,
      avatar_url: user.avatar_url,
      html_url: user.html_url,
      bio: user.bio || '',
      location: user.location || '',
      public_repos: user.public_repos || 0,
      total_private_repos: user.total_private_repos || 0,
    };
  },

  /**
   * Fetches user's repositories from GitHub REST API
   */
  async getUserRepos(accessToken, { sort = 'updated', per_page = 100, type = 'all' } = {}) {
    const params = new URLSearchParams({
      sort,
      direction: 'desc',
      per_page: String(per_page),
      type,
    });

    const response = await fetch(`${config.github.apiBaseUrl}/user/repos?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Reviewer',
      },
    });

    if (!response.ok) {
      await handleGitHubError(response, 'fetch repositories');
    }

    const repos = await response.json();

    return repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner: repo.owner?.login || '',
      owner_avatar: repo.owner?.avatar_url || '',
      description: repo.description || 'No description provided.',
      language: repo.language || 'Plain Text',
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      visibility: repo.private ? 'private' : 'public',
      is_private: repo.private,
      updated_at: repo.updated_at,
      html_url: repo.html_url,
      default_branch: repo.default_branch || 'main',
      open_issues_count: repo.open_issues_count || 0,
    }));
  },

  /**
   * Fetches single repository details
   */
  async getRepoDetails(accessToken, owner, repo) {
    const response = await fetch(`${config.github.apiBaseUrl}/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Reviewer',
      },
    });

    if (!response.ok) {
      await handleGitHubError(response, `fetch repo details for ${owner}/${repo}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      owner: data.owner?.login || owner,
      description: data.description || '',
      language: data.language || 'Plain Text',
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      visibility: data.private ? 'private' : 'public',
      default_branch: data.default_branch || 'main',
      html_url: data.html_url,
      updated_at: data.updated_at,
    };
  },

  /**
   * Fetches the complete git tree for a repository
   */
  async getRepoTree(accessToken, owner, repo, branch = 'main') {
    // Attempt tree by branch name directly
    let response = await fetch(
      `${config.github.apiBaseUrl}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AI-Code-Reviewer',
        },
      }
    );

    // If branch name fails (e.g., master instead of main), look up commit SHA
    if (!response.ok && (response.status === 404 || response.status === 422)) {
      const commitRes = await fetch(
        `${config.github.apiBaseUrl}/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Code-Reviewer',
          },
        }
      );

      if (commitRes.ok) {
        const commitData = await commitRes.json();
        const treeSha = commitData.commit?.tree?.sha;
        if (treeSha) {
          response = await fetch(
            `${config.github.apiBaseUrl}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'AI-Code-Reviewer',
              },
            }
          );
        }
      }
    }

    if (!response.ok) {
      await handleGitHubError(response, `fetch git tree for ${owner}/${repo} (${branch})`);
    }

    const data = await response.json();
    return data.tree || [];
  },

  /**
   * Fetches raw text content of a single source file
   */
  async getRawFileContent(accessToken, owner, repo, filePath, ref = 'main') {
    const encodedPath = filePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    const response = await fetch(
      `${config.github.apiBaseUrl}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.raw',
          'User-Agent': 'AI-Code-Reviewer',
        },
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      await handleGitHubError(response, `fetch file ${filePath}`);
    }

    return await response.text();
  },
};

export default githubService;
