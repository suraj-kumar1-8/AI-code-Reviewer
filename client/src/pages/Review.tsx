import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { CodeIssue, ReviewResult } from '../types';
import { api } from '../services/api';
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  FolderGit2,
  FileCode,
  CheckCircle,
  X,
  Code2,
  Menu,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Info,
  Bug,
  ShieldCheck,
} from 'lucide-react';

export const Review: React.FC = () => {
  const { id, owner: ownerParam, repo: repoParam } = useParams<{
    id?: string;
    owner?: string;
    repo?: string;
  }>();

  const [review, setReview] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [inspectIssue, setInspectIssue] = useState<CodeIssue | null>(null);
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Resolved repository coordinates
  const [repoCoords, setRepoCoords] = useState<{ owner: string; repo: string; branch: string }>({
    owner: ownerParam || localStorage.getItem('lastViewedRepoOwner') || 'suraj',
    repo: repoParam || localStorage.getItem('lastViewedRepoName') || id || 'cloudshare',
    branch: 'main',
  });

  // Execute review analysis via backend
  const runAnalysis = React.useCallback(async (owner: string, repo: string, branch: string, force = false) => {
    try {
      if (force) {
        setIsReanalyzing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await api.analyzeRepo({
        owner,
        repo,
        branch,
        force,
      });

      if (result.success !== false) {
        setReview(result);
      } else {
        throw new Error(result.error || 'Failed to complete code analysis');
      }
    } catch (err: any) {
      console.error('[Review] Analysis failed:', err);
      setError(err.message || 'An error occurred during repository analysis.');
    } finally {
      setLoading(false);
      setIsReanalyzing(false);
    }
  }, []);

  // Resolve repository coordinates from ID or URL params
  useEffect(() => {
    let isMounted = true;

    const resolveCoordsAndAnalyze = async () => {
      let resolvedOwner = ownerParam || localStorage.getItem('lastViewedRepoOwner') || '';
      let resolvedRepo = repoParam || localStorage.getItem('lastViewedRepoName') || '';
      let resolvedBranch = 'main';

      try {
        if (!resolvedOwner || !resolvedRepo || (id && id !== resolvedRepo)) {
          // Look up repos from user account
          const reposData = await api.getRepos().catch(() => ({ repositories: [] }));
          const repos = reposData.repositories || [];

          if (id) {
            const matched = repos.find(
              (r) => String(r.id) === id || r.name.toLowerCase() === id.toLowerCase()
            );
            if (matched) {
              resolvedOwner = matched.owner;
              resolvedRepo = matched.name;
              resolvedBranch = matched.default_branch || 'main';
            }
          }

          if (!resolvedOwner && repos.length > 0) {
            resolvedOwner = repos[0].owner;
            resolvedRepo = repos[0].name;
            resolvedBranch = repos[0].default_branch || 'main';
          }
        }

        // Fallback for initial demo or unlinked repo
        if (!resolvedOwner) resolvedOwner = 'developer';
        if (!resolvedRepo) resolvedRepo = id || 'repository';

        if (isMounted) {
          setRepoCoords({ owner: resolvedOwner, repo: resolvedRepo, branch: resolvedBranch });
          localStorage.setItem('lastViewedRepoOwner', resolvedOwner);
          localStorage.setItem('lastViewedRepoName', resolvedRepo);
          localStorage.setItem('lastViewedRepoId', id || resolvedRepo);
        }

        // Fetch real AI Analysis
        await runAnalysis(resolvedOwner, resolvedRepo, resolvedBranch, false);
      } catch (err: any) {
        if (isMounted) {
          console.error('[Review] Coordinate resolution error:', err);
          setError(err.message || 'Failed to initialize repository review.');
          setLoading(false);
        }
      }
    };

    resolveCoordsAndAnalyze();

    return () => {
      isMounted = false;
    };
  }, [id, ownerParam, repoParam, runAnalysis]);

  const handleReanalyze = () => {
    runAnalysis(repoCoords.owner, repoCoords.repo, repoCoords.branch, true);
  };

  // Severity breakdown counts
  const severityCounts = useMemo(() => {
    if (!review?.issues) return { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
    const issues = review.issues;

    return {
      critical: issues.filter((i) => String(i.severity).toLowerCase() === 'critical').length,
      high: issues.filter((i) => String(i.severity).toLowerCase() === 'high').length,
      medium: issues.filter((i) => String(i.severity).toLowerCase() === 'medium').length,
      low: issues.filter((i) => String(i.severity).toLowerCase() === 'low').length,
      total: issues.length,
    };
  }, [review]);

  // Category breakdown counts
  const categoryCounts = useMemo(() => {
    if (!review?.issues) return { security: 0, bugs: 0, performance: 0, quality: 0 };
    const issues = review.issues;

    return {
      security: issues.filter((i) => /security/i.test(String(i.category))).length,
      bugs: issues.filter((i) => /bug/i.test(String(i.category))).length,
      performance: issues.filter((i) => /perf/i.test(String(i.category))).length,
      quality: issues.filter((i) => /qual|maintain/i.test(String(i.category))).length,
    };
  }, [review]);

  // Filtered issues based on category tab & severity dropdown
  const filteredIssues = useMemo(() => {
    if (!review?.issues) return [];

    return review.issues.filter((issue) => {
      // Category filter
      if (activeCategory !== 'all') {
        const cat = String(issue.category).toLowerCase();
        if (activeCategory === 'quality') {
          if (!cat.includes('qual') && !cat.includes('maintain')) return false;
        } else if (!cat.includes(activeCategory)) {
          return false;
        }
      }

      // Severity filter
      if (filterSeverity !== 'all') {
        if (String(issue.severity).toLowerCase() !== filterSeverity.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [review, activeCategory, filterSeverity]);

  const getSeverityBadgeVariant = (severity: string) => {
    switch (String(severity).toLowerCase()) {
      case 'critical':
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const getScoreVerdict = (score: number) => {
    if (score >= 85) return { label: 'Excellent', color: 'text-emerald-400', desc: 'Codebase exhibits strong security postures and modern best practices.' };
    if (score >= 70) return { label: 'Good', color: 'text-indigo-400', desc: 'Well-structured codebase with minor opportunities for optimization.' };
    if (score >= 50) return { label: 'Needs Improvement', color: 'text-amber-400', desc: 'Identified notable security or performance risks requiring attention.' };
    return { label: 'Critical Action Required', color: 'text-rose-400', desc: 'Multiple high-severity vulnerabilities require immediate remediation.' };
  };

  const scoreVerdict = getScoreVerdict(review?.score || 80);

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

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="border-b border-white/[0.08] px-4 sm:px-8 py-5 bg-[#080F1A]/90 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center justify-between mb-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Repositories</span>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 truncate">
                  <span className="truncate">{repoCoords.repo}</span>
                  <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                    Live Review
                  </span>
                </h1>
                <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                  {repoCoords.owner}/{repoCoords.repo} • Branch: {review?.repository?.targetBranch || repoCoords.branch}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <a
                href={`https://github.com/${repoCoords.owner}/${repoCoords.repo}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  title="View repository on GitHub"
                >
                  <span className="hidden sm:inline">View on GitHub</span>
                  <span className="sm:hidden">GitHub</span>
                </Button>
              </a>

              <Button
                variant="primary"
                size="sm"
                onClick={handleReanalyze}
                disabled={isReanalyzing || loading}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isReanalyzing ? 'animate-spin' : ''}`} />}
                title="Trigger fresh AI code analysis on this repository"
              >
                {isReanalyzing ? 'Analyzing...' : 'Re-analyze'}
              </Button>
            </div>
          </div>

          {/* Navigation Category Tabs */}
          {!loading && !error && (
            <div className="flex items-center gap-2 mt-6 overflow-x-auto scrollbar-none pt-2 border-t border-white/5">
              {[
                { id: 'all', label: 'Overview', count: review?.issues?.length || 0 },
                { id: 'security', label: 'Security', count: categoryCounts.security },
                { id: 'bugs', label: 'Bugs', count: categoryCounts.bugs },
                { id: 'performance', label: 'Performance', count: categoryCounts.performance },
                { id: 'quality', label: 'Code Quality', count: categoryCounts.quality },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeCategory === tab.id
                      ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 text-gray-300">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </header>

        {/* Review Page Main Body */}
        <main className="p-4 sm:p-8 space-y-8 flex-1 overflow-y-auto">
          {/* Loading State: Animated AI Analysis Progress */}
          {loading && (
            <div className="p-12 rounded-2xl bg-[#0E1626]/70 border border-white/[0.08] flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-bold text-white">Analyzing Repository with AI</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Fetching source code tree from GitHub, filtering safe source files, and running security, performance, and bug inspection...
                </p>
              </div>

              {/* Progress skeleton pulse bars */}
              <div className="w-full max-w-sm space-y-2">
                <div className="h-2 bg-indigo-500/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 rounded-full animate-pulse w-3/4" />
                </div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Scanning AST & Security Rules</span>
                  <span>Generating Fix Suggestions</span>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="p-8 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-bold text-white">Analysis Could Not Complete</h3>
                <p className="text-xs text-rose-300/90 leading-relaxed">{error}</p>
                <p className="text-[11px] text-gray-400 mt-2">
                  Verify your GitHub connection or check that the repository has accessible source code files.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReanalyze}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                className="border-rose-500/30 text-rose-200 hover:bg-rose-500/10"
              >
                Retry Analysis
              </Button>
            </div>
          )}

          {/* Content When Review Loaded */}
          {!loading && !error && review && (
            <>
              {/* Executive Summary Card */}
              <Card className="p-6 border-white/[0.08] bg-gradient-to-br from-[#0E1626] to-[#0A101D] relative overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-300">
                        AI Executive Summary
                      </h2>
                      <span className="text-[11px] font-mono text-gray-500">
                        {review.analyzedFilesCount} files analyzed
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                      {review.summary}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Health Score & Sub-Metrics Row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Overall Score Card */}
                <Card className="lg:col-span-4 p-6 flex flex-col justify-center items-center text-center border-white/[0.08] bg-[#0E1626]/80">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                    Overall Health Score
                  </span>

                  <div className="relative w-32 h-32 flex items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500/20 via-indigo-500/20 to-cyan-500/20 border-4 border-indigo-500/40 shadow-inner my-2">
                    <div className="text-center">
                      <div className="text-4xl font-extrabold text-white">{review.score}</div>
                      <div className="text-xs text-gray-400">/ 100</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className={`text-sm font-bold ${scoreVerdict.color}`}>
                      {scoreVerdict.label}
                    </span>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs">
                      {scoreVerdict.desc}
                    </p>
                  </div>
                </Card>

                {/* Sub-Metrics Cards Grid */}
                <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card className="p-5 border-white/[0.08] bg-[#0E1626]/80 flex flex-col justify-between">
                    <span className="text-xs text-gray-400 font-medium">Code Quality</span>
                    <div className="my-3">
                      <span className="text-2xl font-bold text-white">
                        {review.metrics?.codeQuality || 85}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">/100</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${review.metrics?.codeQuality || 85}%` }}
                      />
                    </div>
                  </Card>

                  <Card className="p-5 border-white/[0.08] bg-[#0E1626]/80 flex flex-col justify-between">
                    <span className="text-xs text-gray-400 font-medium">Security</span>
                    <div className="my-3">
                      <span className="text-2xl font-bold text-amber-400">
                        {review.metrics?.security || 74}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">/100</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${review.metrics?.security || 74}%` }}
                      />
                    </div>
                  </Card>

                  <Card className="p-5 border-white/[0.08] bg-[#0E1626]/80 flex flex-col justify-between">
                    <span className="text-xs text-gray-400 font-medium">Performance</span>
                    <div className="my-3">
                      <span className="text-2xl font-bold text-cyan-400">
                        {review.metrics?.performance || 81}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">/100</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${review.metrics?.performance || 81}%` }}
                      />
                    </div>
                  </Card>

                  <Card className="p-5 border-white/[0.08] bg-[#0E1626]/80 flex flex-col justify-between">
                    <span className="text-xs text-gray-400 font-medium">Maintainability</span>
                    <div className="my-3">
                      <span className="text-2xl font-bold text-emerald-400">
                        {review.metrics?.maintainability || 88}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">/100</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${review.metrics?.maintainability || 88}%` }}
                      />
                    </div>
                  </Card>
                </div>
              </div>

              {/* Severity Pill Counters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-3.5 py-2 rounded-xl bg-red-950/30 border border-red-500/30 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-red-300">
                    {severityCounts.critical} Critical
                  </span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-300">
                    {severityCounts.high} High
                  </span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-center gap-2">
                  <Bug className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-indigo-300">
                    {severityCounts.medium} Medium
                  </span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 flex items-center gap-2">
                  <Info className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-300">
                    {severityCounts.low} Low
                  </span>
                </div>
              </div>

              {/* Issues Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>Issues Found</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                        {filteredIssues.length}
                      </span>
                    </h2>
                    <p className="text-xs text-gray-400">
                      Inspected source file observations with exact line references and AI refactors
                    </p>
                  </div>

                  {/* Severity Filter Dropdown */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Severity:</span>
                    <select
                      value={filterSeverity}
                      onChange={(e) => setFilterSeverity(e.target.value)}
                      className="bg-[#111827] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                    >
                      <option value="all">All Severities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                {/* Empty Review State */}
                {filteredIssues.length === 0 && (
                  <div className="p-12 text-center rounded-2xl bg-[#0E1626]/40 border border-white/10 flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-white">No Issues Detected</h3>
                      <p className="text-xs text-gray-400 max-w-sm">
                        {filterSeverity !== 'all' || activeCategory !== 'all'
                          ? 'No issues match your current category or severity filter.'
                          : 'Congratulations! Your analyzed repository files adhere to security, quality, and performance guidelines.'}
                      </p>
                    </div>
                    {(filterSeverity !== 'all' || activeCategory !== 'all') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveCategory('all');
                          setFilterSeverity('all');
                        }}
                      >
                        Reset Filters
                      </Button>
                    )}
                  </div>
                )}

                {/* Issues List */}
                {filteredIssues.length > 0 && (
                  <div className="space-y-3">
                    {filteredIssues.map((issue) => (
                      <Card
                        key={issue.id}
                        hoverEffect
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-white/10 bg-[#0E1626]/90"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <Badge
                            variant={getSeverityBadgeVariant(issue.severity)}
                            size="sm"
                            className="mt-0.5 uppercase shrink-0 font-mono text-[10px]"
                          >
                            {issue.severity}
                          </Badge>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-white truncate">
                                {issue.title}
                              </h3>
                              <Badge variant="neutral" size="sm" className="hidden sm:inline-block text-[10px]">
                                {issue.category}
                              </Badge>
                            </div>

                            <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                              {issue.description}
                            </p>

                            <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-gray-500">
                              <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="truncate">
                                {issue.filePath}:{issue.lineNumber}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setInspectIssue(issue)}
                            leftIcon={<Code2 className="w-3.5 h-3.5 text-indigo-400" />}
                          >
                            View Code
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Code Inspection & Suggested Fix Modal */}
      {inspectIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl bg-[#0F172A] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getSeverityBadgeVariant(inspectIssue.severity)} size="sm" className="uppercase font-mono text-[10px]">
                    {inspectIssue.severity}
                  </Badge>
                  <Badge variant="neutral" size="sm" className="text-[10px]">
                    {inspectIssue.category}
                  </Badge>
                  <span className="text-xs font-mono text-gray-400">
                    {inspectIssue.filePath}:{inspectIssue.lineNumber}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  {inspectIssue.title}
                </h3>
              </div>
              <button
                onClick={() => {
                  setInspectIssue(null);
                  setApplyFeedback(null);
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-gray-400 font-semibold">Diagnosis:</span>
                <p className="text-gray-200 mt-1 leading-relaxed">{inspectIssue.description}</p>
              </div>

              {inspectIssue.codeSnippet && (
                <div>
                  <span className="text-red-400 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Detected Issue Code:
                  </span>
                  <pre className="mt-1.5 p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-red-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {inspectIssue.codeSnippet}
                  </pre>
                </div>
              )}

              <div>
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Recommended Fix:
                </span>
                <p className="text-gray-200 mt-1 leading-relaxed">{inspectIssue.recommendation}</p>
              </div>

              {inspectIssue.fixedCodeSnippet && (
                <div>
                  <span className="text-emerald-400 font-semibold">Suggested Refactor:</span>
                  <pre className="mt-1.5 p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {inspectIssue.fixedCodeSnippet}
                  </pre>
                </div>
              )}
            </div>

            {applyFeedback && (
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{applyFeedback}</span>
              </div>
            )}

            <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInspectIssue(null);
                  setApplyFeedback(null);
                }}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                onClick={() => {
                  setApplyFeedback('Fix patch drafted! Automated GitHub Pull Request creation will be available in upcoming release.');
                  setTimeout(() => {
                    setInspectIssue(null);
                    setApplyFeedback(null);
                  }, 2400);
                }}
              >
                Apply Fix Suggestion
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Review;
