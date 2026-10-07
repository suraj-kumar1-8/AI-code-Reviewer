import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { GitHubRepo, PRReview } from '../types';
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
  Sparkles,
  GitPullRequest,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  GitCommit,
  User,
  ChevronRight,
  Activity,
  Layers,
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

  // Repository state
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(true);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'stars' | 'name'>('updated');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [analyzingRepoId, setAnalyzingRepoId] = useState<number | null>(null);

  // Real Database PR Reviews state (Requirement 6)
  const [prReviews, setPrReviews] = useState<PRReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(true);
  const [selectedReview, setSelectedReview] = useState<PRReview | null>(null);
  const [prSearchQuery, setPrSearchQuery] = useState<string>('');
  const [prRiskFilter, setPrRiskFilter] = useState<string>('ALL');
  const [prAuthorFilter, setPrAuthorFilter] = useState<string>('ALL');
  const [prRepoFilter, setPrRepoFilter] = useState<string>('ALL');

  // Active view tab: 'overview' | 'reviews' | 'repos'
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'repos'>('overview');

  // Load repositories from GitHub API via server
  const loadRepositories = async () => {
    try {
      setRepoError(null);
      const data = await api.getRepos();
      if (data.success && Array.isArray(data.repositories)) {
        setRepositories(data.repositories);
        if (data.repositories.length > 0 && !localStorage.getItem('lastViewedRepoId')) {
          localStorage.setItem('lastViewedRepoId', String(data.repositories[0].id));
          localStorage.setItem('lastViewedRepoOwner', data.repositories[0].owner);
          localStorage.setItem('lastViewedRepoName', data.repositories[0].name);
        }
      } else {
        throw new Error(data.error || 'Failed to retrieve repository list');
      }
    } catch (err: any) {
      console.error('[Dashboard] Error fetching repos:', err);
      setRepoError(err.message || 'Could not fetch GitHub repositories. Please check your connection.');
    } finally {
      setLoadingRepos(false);
    }
  };

  // Load real PR reviews from PostgreSQL database
  const loadPRReviews = async () => {
    try {
      setLoadingReviews(true);
      const data = await api.getPRReviews();
      setPrReviews(data.reviews || []);
    } catch (err: any) {
      console.warn('[Dashboard] Error fetching PR reviews:', err.message);
    } finally {
      setLoadingReviews(false);
    }
  };

  const loadAllData = async () => {
    setIsRefreshing(true);
    await Promise.all([loadRepositories(), loadPRReviews()]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadRepositories();
    loadPRReviews();
  }, []);

  const handleManualRefresh = () => {
    loadAllData();
  };

  const handleAnalyzeRepo = (repo: GitHubRepo) => {
    if (analyzingRepoId !== null) return;
    setAnalyzingRepoId(repo.id);
    localStorage.setItem('lastViewedRepoId', String(repo.id));
    localStorage.setItem('lastViewedRepoOwner', repo.owner);
    localStorage.setItem('lastViewedRepoName', repo.name);
    navigate(`/review/${repo.owner}/${repo.name}`);
  };

  // Calculated repository metrics
  const repoStats = useMemo(() => {
    const totalRepos = repositories.length;
    const publicCount = repositories.filter((r) => !r.is_private).length;
    const privateCount = repositories.filter((r) => r.is_private).length;
    const totalStars = repositories.reduce((sum, r) => sum + (r.stars || 0), 0);
    const totalForks = repositories.reduce((sum, r) => sum + (r.forks || 0), 0);
    return { totalRepos, publicCount, privateCount, totalStars, totalForks };
  }, [repositories]);

  // Real Database Review Metrics (Requirement 6)
  const reviewStats = useMemo(() => {
    const total = prReviews.length;
    const critical = prReviews.filter((r) => r.risk_level?.toUpperCase() === 'CRITICAL').length;
    const high = prReviews.filter((r) => r.risk_level?.toUpperCase() === 'HIGH').length;
    const medium = prReviews.filter((r) => r.risk_level?.toUpperCase() === 'MEDIUM').length;
    const low = prReviews.filter((r) => r.risk_level?.toUpperCase() === 'LOW').length;
    const avgScore = total > 0 ? Math.round(prReviews.reduce((sum, r) => sum + (r.score || 0), 0) / total) : 0;
    const cleanPRs = prReviews.filter((r) => !r.issues || r.issues.length === 0 || r.score >= 80).length;

    return {
      total,
      critical,
      high,
      medium,
      low,
      avgScore,
      cleanPRs,
    };
  }, [prReviews]);

  // Unique authors and repos for PR review filters
  const uniqueAuthors = useMemo(() => {
    const set = new Set<string>();
    prReviews.forEach((r) => {
      if (r.pr_author) set.add(r.pr_author);
    });
    return Array.from(set).sort();
  }, [prReviews]);

  const uniqueReviewRepos = useMemo(() => {
    const set = new Set<string>();
    prReviews.forEach((r) => {
      if (r.owner && r.repo) set.add(`${r.owner}/${r.repo}`);
    });
    return Array.from(set).sort();
  }, [prReviews]);

  // Filtered PR Reviews
  const filteredPRReviews = useMemo(() => {
    return prReviews.filter((r) => {
      // Risk filter
      if (prRiskFilter !== 'ALL' && r.risk_level?.toUpperCase() !== prRiskFilter.toUpperCase()) {
        return false;
      }
      // Author filter
      if (prAuthorFilter !== 'ALL' && r.pr_author !== prAuthorFilter) {
        return false;
      }
      // Repo filter
      if (prRepoFilter !== 'ALL' && `${r.owner}/${r.repo}`.toLowerCase() !== prRepoFilter.toLowerCase()) {
        return false;
      }
      // Search query
      if (prSearchQuery.trim()) {
        const q = prSearchQuery.toLowerCase();
        const matchTitle = (r.pr_title || '').toLowerCase().includes(q);
        const matchRepo = `${r.owner}/${r.repo}`.toLowerCase().includes(q);
        const matchAuthor = (r.pr_author || '').toLowerCase().includes(q);
        const matchNumber = String(r.pr_number).includes(q);
        return matchTitle || matchRepo || matchAuthor || matchNumber;
      }
      return true;
    });
  }, [prReviews, prRiskFilter, prAuthorFilter, prRepoFilter, prSearchQuery]);

  // Filtered and sorted repositories
  const filteredRepos = useMemo(() => {
    return repositories
      .filter((repo) => {
        if (visibilityFilter === 'public' && repo.is_private) return false;
        if (visibilityFilter === 'private' && !repo.is_private) return false;
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
        if (sortBy === 'stars') return b.stars - a.stars;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [repositories, visibilityFilter, searchTerm, sortBy]);

  const getRiskBadge = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <ShieldAlert className="w-3 h-3" /> CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <ShieldAlert className="w-3 h-3" /> HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
            <ShieldAlert className="w-3 h-3" /> MEDIUM
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="w-3 h-3" /> LOW
          </span>
        );
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 60) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const formatUpdatedDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
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
        {/* Top Header */}
        <header className="border-b border-white/[0.08] px-4 sm:px-8 py-4 sm:py-5 bg-[#080F1A]/90 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center justify-between gap-4">
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
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline text-gray-400">AI Code Reviewer Engine Active</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                title="Sync and re-fetch latest data"
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
              >
                <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
                <span className="sm:hidden">{isRefreshing ? 'Syncing' : 'Sync'}</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Main Workspace */}
        <main className="p-4 sm:p-8 space-y-8 flex-1 overflow-y-auto">
          {/* Executive Real Database Metrics Row (Requirement 6) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Total Reviews */}
            <Card
              hoverEffect
              onClick={() => setActiveTab('reviews')}
              className={`p-5 border-white/[0.08] bg-[#0E1626]/80 flex flex-col justify-between cursor-pointer transition-all ${
                activeTab === 'reviews' ? 'ring-1 ring-purple-500/50 border-purple-500/40' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400">Total PR Reviews</p>
                  <p className="text-2xl font-extrabold text-white mt-1">
                    {loadingReviews ? '—' : reviewStats.total}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                  <GitPullRequest className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center gap-1 text-[11px] text-gray-400">
                <span className="text-purple-400 font-medium">Real DB records</span>
                <span>• Webhooks & manual</span>
              </div>
            </Card>

            {/* Average Health Score */}
            <Card
              hoverEffect
              className="p-5 border-white/[0.08] bg-[#0E1626]/80 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400">Average Health Score</p>
                  <p className="text-2xl font-extrabold text-white mt-1">
                    {loadingReviews ? '—' : reviewStats.total > 0 ? `${reviewStats.avgScore}/100` : '100/100'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Activity className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center gap-1.5 text-[11px]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    reviewStats.avgScore >= 80 ? 'bg-emerald-400' : reviewStats.avgScore >= 60 ? 'bg-yellow-400' : 'bg-rose-400'
                  }`}
                />
                <span className="text-emerald-400 font-medium">
                  {reviewStats.avgScore >= 80 ? 'Optimal Code Quality' : 'Review Attention Required'}
                </span>
              </div>
            </Card>

            {/* Clean PR Count */}
            <Card
              hoverEffect
              className="p-5 border-white/[0.08] bg-[#0E1626]/80 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400">Clean Pull Requests</p>
                  <p className="text-2xl font-extrabold text-white mt-1">
                    {loadingReviews ? '—' : reviewStats.cleanPRs}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center gap-1 text-[11px] text-gray-400">
                <span className="text-indigo-400 font-medium">Score ≥ 80 or zero defects</span>
              </div>
            </Card>

            {/* Risk Distribution Breakdown */}
            <Card
              hoverEffect
              className="p-5 border-white/[0.08] bg-[#0E1626]/80 flex flex-col justify-between"
            >
              <div>
                <p className="text-xs font-medium text-gray-400">Risk Distribution</p>
                <div className="grid grid-cols-4 gap-1 mt-2">
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-1.5 text-center">
                    <p className="text-[10px] text-rose-300 font-semibold">Crit</p>
                    <p className="text-sm font-bold text-rose-400">{reviewStats.critical}</p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-1.5 text-center">
                    <p className="text-[10px] text-amber-300 font-semibold">High</p>
                    <p className="text-sm font-bold text-amber-400">{reviewStats.high}</p>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-1.5 text-center">
                    <p className="text-[10px] text-yellow-300 font-semibold">Med</p>
                    <p className="text-sm font-bold text-yellow-400">{reviewStats.medium}</p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-1.5 text-center">
                    <p className="text-[10px] text-emerald-300 font-semibold">Low</p>
                    <p className="text-sm font-bold text-emerald-400">{reviewStats.low}</p>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Classified via Gemini AI Engine</p>
            </Card>
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Full Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'reviews'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <GitPullRequest className="w-3.5 h-3.5" />
              <span>PR Review Feed ({prReviews.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('repos')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'repos'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Connected Repositories ({repositories.length})</span>
            </button>
          </div>

          {/* SECTION 1: RECENT PR REVIEWS (Requirement 6) */}
          {(activeTab === 'overview' || activeTab === 'reviews') && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <GitPullRequest className="w-5 h-5 text-purple-400" />
                    <span>Recent PR AI Reviews</span>
                    {!loadingReviews && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {filteredPRReviews.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-400">
                    Live database reviews from GitHub Webhook deliveries and manual scans
                  </p>
                </div>

                {/* PR Review Filters & Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search PRs */}
                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={prSearchQuery}
                      onChange={(e) => setPrSearchQuery(e.target.value)}
                      placeholder="Search PR, repo, author..."
                      className="w-full bg-[#0E1626] border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60"
                    />
                    {prSearchQuery && (
                      <button
                        onClick={() => setPrSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Severity / Risk Filter */}
                  <div className="flex items-center bg-[#0E1626] border border-white/10 p-0.5 rounded-xl text-xs">
                    {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setPrRiskFilter(lvl)}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                          prRiskFilter === lvl ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>

                  {/* Author Filter Dropdown */}
                  {uniqueAuthors.length > 0 && (
                    <select
                      value={prAuthorFilter}
                      onChange={(e) => setPrAuthorFilter(e.target.value)}
                      className="bg-[#0E1626] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
                      title="Filter by Author"
                    >
                      <option value="ALL">All Authors</option>
                      {uniqueAuthors.map((author) => (
                        <option key={author} value={author}>
                          @{author}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Repository Filter Dropdown */}
                  {uniqueReviewRepos.length > 0 && (
                    <select
                      value={prRepoFilter}
                      onChange={(e) => setPrRepoFilter(e.target.value)}
                      className="bg-[#0E1626] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
                      title="Filter by Repository"
                    >
                      <option value="ALL">All Repositories</option>
                      {uniqueReviewRepos.map((repoName) => (
                        <option key={repoName} value={repoName}>
                          {repoName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* PR Reviews List */}
              {loadingReviews && (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl bg-[#0E1626]/70 border border-white/[0.08] animate-pulse h-28"
                    />
                  ))}
                </div>
              )}

              {!loadingReviews && filteredPRReviews.length === 0 && (
                <div className="p-8 text-center rounded-2xl bg-[#0E1626]/40 border border-white/10 space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mx-auto">
                    <GitPullRequest className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">No pull request reviews found</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    {prSearchQuery || prRiskFilter !== 'ALL' || prAuthorFilter !== 'ALL' || prRepoFilter !== 'ALL'
                      ? 'No reviews match your selected filter criteria. Try clearing filters.'
                      : 'Trigger a pull request review from the Pull Requests page or deliver a GitHub webhook.'}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/pull-requests')}
                    className="border-purple-500/30 text-purple-300"
                  >
                    Go to Pull Requests Workspace
                  </Button>
                </div>
              )}

              {!loadingReviews && filteredPRReviews.length > 0 && (
                <div className="space-y-3">
                  {filteredPRReviews.slice(0, activeTab === 'overview' ? 5 : undefined).map((review) => (
                    <div
                      key={review.id}
                      onClick={() => setSelectedReview(review)}
                      className="group p-4 sm:p-5 rounded-2xl bg-[#0E1626]/90 hover:bg-[#131E35] border border-white/[0.08] hover:border-purple-500/30 transition-all duration-200 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                            {review.owner}/{review.repo}
                          </span>
                          <span className="font-mono text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">
                            #{review.pr_number}
                          </span>
                          {getRiskBadge(review.risk_level)}
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                          {review.pr_title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-gray-500" />
                            @{review.pr_author}
                          </span>
                          <span className="flex items-center gap-1 font-mono text-gray-500">
                            <GitCommit className="w-3.5 h-3.5" />
                            {review.commit_sha?.slice(0, 7)}
                          </span>
                          <span className="flex items-center gap-1 text-gray-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                          {review.issues && (
                            <span className="text-gray-300 font-medium">
                              {review.issues.length} {review.issues.length === 1 ? 'finding' : 'findings'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                        <div
                          className={`px-3 py-1 rounded-xl border text-center font-mono font-bold text-xs ${getScoreColor(
                            review.score
                          )}`}
                        >
                          {review.score}/100
                        </div>
                        <button
                          className="p-1.5 rounded-lg text-gray-400 group-hover:text-white group-hover:bg-purple-500/20 transition-all"
                          aria-label="View Review Details"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {activeTab === 'overview' && filteredPRReviews.length > 5 && (
                    <div className="text-center pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('reviews')}
                        className="text-xs border-purple-500/30 text-purple-300"
                      >
                        View all {filteredPRReviews.length} Pull Request Reviews
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: CONNECTED REPOSITORIES */}
          {(activeTab === 'overview' || activeTab === 'repos') && (
            <div id="repositories-section" className="space-y-4 pt-4 border-t border-white/[0.08]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FolderGit2 className="w-5 h-5 text-indigo-400" />
                    <span>Connected GitHub Repositories</span>
                    {!loadingRepos && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                        {filteredRepos.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-400">
                    Inspect source code, run full repository reviews, or query with RAG
                  </p>
                </div>

                {/* Filter and Search Bar Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-full sm:w-60">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search repositories..."
                      className="w-full bg-[#0E1626] border border-white/10 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/60"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center bg-[#0E1626] border border-white/10 p-0.5 rounded-xl text-xs">
                    <button
                      onClick={() => setVisibilityFilter('all')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                        visibilityFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      All ({repoStats.totalRepos})
                    </button>
                    <button
                      onClick={() => setVisibilityFilter('public')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        visibilityFilter === 'public' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Globe className="w-3 h-3" /> Public ({repoStats.publicCount})
                    </button>
                    <button
                      onClick={() => setVisibilityFilter('private')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        visibilityFilter === 'private' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Lock className="w-3 h-3" /> Private ({repoStats.privateCount})
                    </button>
                  </div>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-[#0E1626] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="updated">Recently Updated</option>
                    <option value="stars">Most Stars</option>
                    <option value="name">Alphabetical</option>
                  </select>
                </div>
              </div>

              {/* Error State */}
              {repoError && (
                <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <div>
                      <h3 className="text-xs font-bold text-white">Repository Fetch Notice</h3>
                      <p className="text-xs text-rose-300/80">{repoError}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadRepositories}>
                    Retry
                  </Button>
                </div>
              )}

              {/* Loading Skeletons */}
              {loadingRepos && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl bg-[#0E1626]/70 border border-white/[0.08] animate-pulse h-52"
                    />
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!loadingRepos && !repoError && filteredRepos.length === 0 && (
                <div className="p-8 text-center rounded-2xl bg-[#0E1626]/40 border border-white/10 space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
                    <FolderGit2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">No repositories match criteria</h3>
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
                </div>
              )}

              {/* Repositories Grid */}
              {!loadingRepos && !repoError && filteredRepos.length > 0 && (
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
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-1.5 truncate">
                                <span className="truncate">{repo.name}</span>
                                <a
                                  href={repo.html_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Open on GitHub"
                                  className="text-gray-500 hover:text-white transition-colors shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </h3>
                              <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                                {repo.owner}/{repo.name}
                              </p>
                            </div>

                            <div className="shrink-0">
                              {repo.is_private ? (
                                <Badge variant="warning" size="sm" className="flex items-center gap-1 text-[11px]">
                                  <Lock className="w-3 h-3" />
                                  <span>Private</span>
                                </Badge>
                              ) : (
                                <Badge variant="neutral" size="sm" className="flex items-center gap-1 text-[11px] text-gray-300">
                                  <Globe className="w-3 h-3 text-cyan-400" />
                                  <span>Public</span>
                                </Badge>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-gray-400 line-clamp-2 mt-2 leading-relaxed min-h-[32px]">
                            {repo.description || 'No description provided.'}
                          </p>

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

                            <span className="text-gray-500 text-[11px] ml-auto">
                              {formatUpdatedDate(repo.updated_at)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-5 pt-3.5 border-t border-white/[0.08] flex items-center justify-between gap-2">
                          <span className="text-[11px] text-gray-500 font-mono truncate">
                            {repo.default_branch || 'main'}
                          </span>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/ask/${repo.owner}/${repo.name}`);
                              }}
                              title="Ask questions about this codebase with RAG"
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/40 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Ask</span>
                            </button>

                            <Button
                              variant="primary"
                              size="sm"
                              disabled={analyzingRepoId !== null}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAnalyzeRepo(repo);
                              }}
                              leftIcon={
                                analyzingRepoId === repo.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : undefined
                              }
                              rightIcon={
                                analyzingRepoId === repo.id ? undefined : (
                                  <ArrowRight className="w-3.5 h-3.5" />
                                )
                              }
                            >
                              {analyzingRepoId === repo.id ? 'Analyzing...' : 'Analyze'}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Comprehensive PR Review Details Modal (Requirement 6 & 7) */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div
            className="bg-[#090F20] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-white/[0.08] flex items-start justify-between bg-[#0B132B]/80">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                    {selectedReview.owner}/{selectedReview.repo}
                  </span>
                  <span className="font-mono text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">
                    #{selectedReview.pr_number}
                  </span>
                  {getRiskBadge(selectedReview.risk_level)}
                </div>
                <h2 className="text-lg font-bold text-white mt-1">{selectedReview.pr_title}</h2>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>Author: @{selectedReview.pr_author}</span>
                  <span>
                    Commit: <code className="font-mono text-gray-300">{selectedReview.commit_sha?.slice(0, 7)}</code>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedReview(null)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Executive Summary */}
              <div>
                <h4 className="text-xs uppercase font-semibold text-gray-400 tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Executive AI Summary
                </h4>
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                  {selectedReview.summary}
                </div>
              </div>

              {/* Findings & Issues */}
              <div>
                <h4 className="text-xs uppercase font-semibold text-gray-400 tracking-wider mb-3">
                  Detected Observations & Defects ({selectedReview.issues?.length || 0})
                </h4>

                {!selectedReview.issues || selectedReview.issues.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>No vulnerabilities or issues were detected in this PR diff. Code is clean!</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedReview.issues.map((issue, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                issue.severity === 'CRITICAL'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : issue.severity === 'HIGH'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : issue.severity === 'MEDIUM'
                                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {issue.severity}
                            </span>
                            <span className="text-[10px] font-medium text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                              {issue.category || 'Quality'}
                            </span>
                            <span className="text-xs font-semibold text-white">{issue.title}</span>
                          </div>
                          <span className="font-mono text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                            {issue.file}
                            {issue.line ? `:${issue.line}` : ''}
                          </span>
                        </div>

                        <p className="text-xs text-gray-300 leading-relaxed">{issue.description}</p>

                        {issue.recommendation && (
                          <div className="text-xs text-purple-300 bg-purple-500/10 p-2.5 rounded-lg border border-purple-500/20">
                            <strong>Recommendation:</strong> {issue.recommendation}
                          </div>
                        )}

                        {(issue.suggestedFix || (issue as any).suggested_fix) && (
                          <div className="text-xs bg-black/60 p-2.5 rounded-lg border border-emerald-500/20 font-mono text-emerald-300">
                            <div className="text-[10px] uppercase font-bold text-emerald-400 mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Suggested Fix:
                            </div>
                            <pre className="overflow-x-auto whitespace-pre-wrap">
                              {issue.suggestedFix || (issue as any).suggested_fix}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/[0.08] bg-[#0B132B]/60 flex items-center justify-between">
              <div className="text-xs text-gray-400">
                Health Score: <span className="font-bold text-white">{selectedReview.score}/100</span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`https://github.com/${selectedReview.owner}/${selectedReview.repo}/pull/${selectedReview.pr_number}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 underline"
                >
                  Open PR on GitHub <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <Button size="sm" onClick={() => setSelectedReview(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
