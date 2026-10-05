import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { GitHubRepo } from '../types';
import {
  Search,
  FolderGit2,
  Star,
  GitFork,
  ArrowRight,
  ExternalLink,
  Lock,
  Globe,
  RefreshCw,
  AlertCircle,
  X,
  Calendar,
  Menu,
} from 'lucide-react';

const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#F7DF1E',
  TypeScript: '#3178C6',
  Python: '#3572A5',
  HTML: '#E34F26',
  CSS: '#563D7C',
  Go: '#00ADD8',
  Rust: '#DEA584',
  Java: '#B07219',
  Ruby: '#701516',
  PHP: '#4F5D95',
  'C++': '#F34B7D',
  C: '#555555',
  'C#': '#178600',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Shell: '#89E051',
  Vue: '#41B883',
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'stars' | 'name'>('updated');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Fetch real repositories from GitHub API via server
  const loadRepositories = async () => {
    try {
      setError(null);
      const data = await api.getRepos();
      if (data.success && Array.isArray(data.repositories)) {
        setRepositories(data.repositories);
        // Cache first repo ID for sidebar review link if not set
        if (data.repositories.length > 0 && !localStorage.getItem('lastViewedRepoId')) {
          localStorage.setItem('lastViewedRepoId', String(data.repositories[0].id));
        }
      } else {
        throw new Error(data.error || 'Failed to retrieve repository list');
      }
    } catch (err: any) {
      console.error('[Dashboard] Error fetching repos:', err);
      setError(err.message || 'Could not fetch GitHub repositories. Please check your connection.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadRepositories();
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadRepositories();
  };

  const handleAnalyzeRepo = (repo: GitHubRepo) => {
    localStorage.setItem('lastViewedRepoId', String(repo.id));
    navigate(`/review/${repo.id}`);
  };

  // Calculated statistics
  const stats = useMemo(() => {
    const totalRepos = repositories.length;
    const publicCount = repositories.filter((r) => !r.is_private).length;
    const privateCount = repositories.filter((r) => r.is_private).length;
    const totalStars = repositories.reduce((sum, r) => sum + (r.stars || 0), 0);
    const totalForks = repositories.reduce((sum, r) => sum + (r.forks || 0), 0);

    return {
      totalRepos,
      publicCount,
      privateCount,
      totalStars,
      totalForks,
    };
  }, [repositories]);

  // Filtered and sorted repositories
  const filteredRepos = useMemo(() => {
    return repositories
      .filter((repo) => {
        // Visibility filter
        if (visibilityFilter === 'public' && repo.is_private) return false;
        if (visibilityFilter === 'private' && !repo.is_private) return false;

        // Search term filter
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase();
          const matchesName = repo.name.toLowerCase().includes(query);
          const matchesDesc = (repo.description || '').toLowerCase().includes(query);
          const matchesLang = (repo.language || '').toLowerCase().includes(query);
          return matchesName || matchesDesc || matchesLang;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'stars') {
          return b.stars - a.stars;
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        // Default: updated_at desc
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [repositories, visibilityFilter, searchTerm, sortBy]);

  // Helper for formatted date
  const formatUpdatedDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Updated today';
      if (diffDays === 1) return 'Updated yesterday';
      if (diffDays < 30) return `Updated ${diffDays} days ago`;

      return `Updated ${date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      })}`;
    } catch {
      return 'Recently updated';
    }
  };

  return (
    <div className="min-h-screen bg-[#080F1A] text-white flex">
      {/* Desktop Sidebar Navigation */}
      <Sidebar className="hidden md:flex" />

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/80 backdrop-blur-sm flex">
          <Sidebar className="w-72" onClose={() => setMobileMenuOpen(false)} />
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header / Profile Banner */}
        <header className="border-b border-white/[0.08] px-4 sm:px-8 py-4 sm:py-5 bg-[#080F1A]/90 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Mobile Menu Trigger & Profile Greeting */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl object-cover border-2 border-indigo-500/40 shadow-lg shadow-indigo-500/10 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-base sm:text-lg font-bold text-white shrink-0">
                  {user?.login?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 truncate">
                  <span className="truncate">Welcome back, {user?.name || user?.login || 'Developer'}</span>
                  <span className="inline-block text-lg shrink-0">👋</span>
                </h1>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                  <span className="font-mono text-indigo-400 font-medium">@{user?.login || 'github'}</span>
                  {user?.bio && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline truncate max-w-sm text-gray-400">{user.bio}</span>
                    </>
                  )}
                  {user?.location && (
                    <>
                      <span className="hidden md:inline">•</span>
                      <span className="hidden md:inline text-gray-500">{user.location}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing || loading}
                title="Sync and re-fetch latest repositories from GitHub API"
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
              >
                <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync GitHub'}</span>
                <span className="sm:hidden">{isRefreshing ? 'Syncing' : 'Sync'}</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="p-4 sm:p-8 space-y-8 flex-1 overflow-y-auto">
          {/* Real Metrics Row — Clickable to Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <Card
              hoverEffect
              onClick={() => setVisibilityFilter('all')}
              title="Click to view all repositories"
              className={`p-5 border-white/[0.08] bg-[#0E1626]/80 flex items-center justify-between cursor-pointer transition-all ${
                visibilityFilter === 'all' ? 'ring-1 ring-indigo-500/50 border-indigo-500/40' : ''
              }`}
            >
              <div>
                <p className="text-xs font-medium text-gray-400">Total Repositories</p>
                <p className="text-2xl font-extrabold text-white mt-1">
                  {loading ? '—' : stats.totalRepos}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">Connected from GitHub</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <FolderGit2 className="w-6 h-6" />
              </div>
            </Card>

            <Card
              hoverEffect
              onClick={() => setVisibilityFilter('public')}
              title="Click to filter by public repositories"
              className={`p-5 border-white/[0.08] bg-[#0E1626]/80 flex items-center justify-between cursor-pointer transition-all ${
                visibilityFilter === 'public' ? 'ring-1 ring-emerald-500/50 border-emerald-500/40' : ''
              }`}
            >
              <div>
                <p className="text-xs font-medium text-gray-400">Public Repositories</p>
                <p className="text-2xl font-extrabold text-white mt-1">
                  {loading ? '—' : stats.publicCount}
                </p>
                <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Publicly visible
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Globe className="w-6 h-6" />
              </div>
            </Card>

            <Card
              hoverEffect
              onClick={() => setVisibilityFilter('private')}
              title="Click to filter by private repositories"
              className={`p-5 border-white/[0.08] bg-[#0E1626]/80 flex items-center justify-between cursor-pointer transition-all ${
                visibilityFilter === 'private' ? 'ring-1 ring-purple-500/50 border-purple-500/40' : ''
              }`}
            >
              <div>
                <p className="text-xs font-medium text-gray-400">Private Repositories</p>
                <p className="text-2xl font-extrabold text-white mt-1">
                  {loading ? '—' : stats.privateCount}
                </p>
                <p className="text-[11px] text-purple-400 mt-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Encrypted & private
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Lock className="w-6 h-6" />
              </div>
            </Card>

            <Card
              hoverEffect
              onClick={() => setSortBy('stars')}
              title="Click to sort repositories by most stars"
              className={`p-5 border-white/[0.08] bg-[#0E1626]/80 flex items-center justify-between cursor-pointer transition-all ${
                sortBy === 'stars' ? 'ring-1 ring-amber-500/50 border-amber-500/40' : ''
              }`}
            >
              <div>
                <p className="text-xs font-medium text-gray-400">Total Stars & Forks</p>
                <p className="text-2xl font-extrabold text-white mt-1">
                  {loading ? '—' : `${stats.totalStars} ⭐`}
                </p>
                <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                  <GitFork className="w-3 h-3" />
                  {stats.totalForks} forks across repos
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Star className="w-6 h-6" />
              </div>
            </Card>
          </div>

          {/* Repositories Section */}
          <div id="repositories-section" className="space-y-5">
            {/* Filter and Search Bar Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Your Repositories</span>
                  {!loading && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                      {filteredRepos.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-400">
                  Select any repository to begin automated code inspection & review
                </p>
              </div>

              {/* Filters & Search Inputs */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, lang, description..."
                    className="w-full bg-[#0E1626] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Visibility Filter Tabs */}
                <div className="flex items-center bg-[#0E1626] border border-white/10 p-1 rounded-xl">
                  <button
                    onClick={() => setVisibilityFilter('all')}
                    title="Show all repositories"
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      visibilityFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    All ({stats.totalRepos})
                  </button>
                  <button
                    onClick={() => setVisibilityFilter('public')}
                    title="Show public repositories only"
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      visibilityFilter === 'public'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    Public ({stats.publicCount})
                  </button>
                  <button
                    onClick={() => setVisibilityFilter('private')}
                    title="Show private repositories only"
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      visibilityFilter === 'private'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    Private ({stats.privateCount})
                  </button>
                </div>

                {/* Sort dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  title="Sort repositories"
                  className="bg-[#0E1626] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/60 cursor-pointer"
                >
                  <option value="updated">Recently Updated</option>
                  <option value="stars">Most Stars</option>
                  <option value="name">Alphabetical</option>
                </select>
              </div>
            </div>

            {/* Error State */}
            {error && (
              <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Error Connecting to GitHub</h3>
                    <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Verify that your GitHub OAuth credentials are set in <code className="text-indigo-300">server/.env</code> and that your access token is valid.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadRepositories}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  className="border-rose-500/40 text-rose-200 hover:bg-rose-500/10 shrink-0"
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Loading Skeleton */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="p-5 rounded-2xl bg-[#0E1626]/70 border border-white/[0.08] animate-pulse flex flex-col justify-between h-56"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="space-y-2 flex-1">
                          <div className="h-5 bg-white/10 rounded-md w-3/4" />
                          <div className="h-3 bg-white/5 rounded-md w-1/2" />
                        </div>
                        <div className="w-16 h-6 bg-white/10 rounded-full" />
                      </div>

                      <div className="space-y-2 my-4">
                        <div className="h-3 bg-white/5 rounded-md w-full" />
                        <div className="h-3 bg-white/5 rounded-md w-4/5" />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                      <div className="h-4 bg-white/10 rounded-md w-24" />
                      <div className="h-8 bg-white/10 rounded-lg w-24" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && filteredRepos.length === 0 && (
              <div className="p-12 text-center rounded-2xl bg-[#0E1626]/40 border border-white/10 flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <FolderGit2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">No repositories found</h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm">
                    {searchTerm || visibilityFilter !== 'all'
                      ? 'No repositories match your current filter or search criteria.'
                      : 'We couldn’t find any repositories in your GitHub account.'}
                  </p>
                </div>
                {(searchTerm || visibilityFilter !== 'all') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setVisibilityFilter('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            )}

            {/* Real Repositories Grid */}
            {!loading && !error && filteredRepos.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredRepos.map((repo) => {
                  const langColor = LANGUAGE_COLORS[repo.language] || '#9CA3AF';

                  return (
                    <Card
                      key={repo.id}
                      hoverEffect
                      className="p-5 flex flex-col justify-between border-white/[0.08] bg-[#0E1626]/90 hover:border-indigo-500/40 group cursor-pointer transition-all duration-200"
                      onClick={() => handleAnalyzeRepo(repo)}
                    >
                      <div>
                        {/* Header: Title + Visibility Badge */}
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-1.5 truncate">
                              <span className="truncate">{repo.name}</span>
                              <a
                                href={repo.html_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Open on GitHub in new tab"
                                className="text-gray-500 hover:text-white transition-colors shrink-0 p-0.5"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </h3>
                            <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                              {repo.owner}/{repo.name}
                            </p>
                          </div>

                          {/* Visibility badge */}
                          <div className="shrink-0">
                            {repo.is_private ? (
                              <Badge variant="warning" size="sm" className="flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                <span>Private</span>
                              </Badge>
                            ) : (
                              <Badge variant="neutral" size="sm" className="flex items-center gap-1 text-gray-300">
                                <Globe className="w-3 h-3 text-cyan-400" />
                                <span>Public</span>
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-gray-400 line-clamp-2 mt-2 leading-relaxed min-h-[32px]">
                          {repo.description || 'No description provided.'}
                        </p>

                        {/* Metadata row: Language, Stars, Forks, Updated Date */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-4 pt-3 border-t border-white/5">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: langColor }}
                            />
                            <span>{repo.language}</span>
                          </span>

                          <span className="flex items-center gap-1 text-amber-400">
                            <Star className="w-3.5 h-3.5 fill-amber-400/30" />
                            <span>{repo.stars}</span>
                          </span>

                          <span className="flex items-center gap-1 text-gray-400">
                            <GitFork className="w-3.5 h-3.5" />
                            <span>{repo.forks}</span>
                          </span>

                          <span className="text-gray-500 text-[11px] flex items-center gap-1 ml-auto">
                            <Calendar className="w-3 h-3" />
                            {formatUpdatedDate(repo.updated_at)}
                          </span>
                        </div>
                      </div>

                      {/* Card Footer: Branch & Action */}
                      <div className="mt-5 pt-3.5 border-t border-white/[0.08] flex items-center justify-between">
                        <span className="text-[11px] text-gray-500 font-mono">
                          branch: {repo.default_branch || 'main'}
                        </span>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAnalyzeRepo(repo);
                          }}
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        >
                          Analyze Repository
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
