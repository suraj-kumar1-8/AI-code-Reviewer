import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { CodeIssue, ReviewResult, SourceFile } from '../types';
import { api } from '../services/api';
import { CodeViewer } from '../components/review/CodeViewer';
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  FolderGit2,
  FileCode,
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
  Search,
  ChevronDown,
  ChevronUp,
  RotateCcw,
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

  // Issue modal inspection
  const [inspectIssue, setInspectIssue] = useState<CodeIssue | null>(null);

  // In-card expand/collapse state (set of issue IDs)
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterFile, setFilterFile] = useState<string>('all');

  // Resolved repository coordinates
  const [repoCoords, setRepoCoords] = useState<{ owner: string; repo: string; branch: string }>({
    owner: ownerParam || localStorage.getItem('lastViewedRepoOwner') || 'suraj',
    repo: repoParam || localStorage.getItem('lastViewedRepoName') || id || 'repository',
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
        // By default expand the first critical/high issue if available
        if (result.issues && result.issues.length > 0) {
          const highOrCrit = result.issues.find(
            (i) => i.severity === 'CRITICAL' || i.severity === 'HIGH'
          );
          setExpandedIssueIds(new Set([highOrCrit ? highOrCrit.id : result.issues[0].id]));
        }
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

        if (!resolvedOwner) resolvedOwner = 'developer';
        if (!resolvedRepo) resolvedRepo = id || 'repository';

        if (isMounted) {
          setRepoCoords({ owner: resolvedOwner, repo: resolvedRepo, branch: resolvedBranch });
          localStorage.setItem('lastViewedRepoOwner', resolvedOwner);
          localStorage.setItem('lastViewedRepoName', resolvedRepo);
          localStorage.setItem('lastViewedRepoId', id || resolvedRepo);
        }

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

  // Toggle single issue expand/collapse
  const toggleIssueExpanded = (issueId: string) => {
    setExpandedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  // Expand or collapse all
  const expandAllIssues = () => {
    if (!review?.issues) return;
    setExpandedIssueIds(new Set(review.issues.map((i) => i.id)));
  };

  const collapseAllIssues = () => {
    setExpandedIssueIds(new Set());
  };

  // Map files for quick lookup in CodeViewer
  const sourceFilesMap = useMemo(() => {
    const map = new Map<string, SourceFile>();
    if (review?.sourceFiles) {
      review.sourceFiles.forEach((f) => map.set(f.path, f));
    }
    return map;
  }, [review]);

  // Unique files with issue counts
  const fileOptions = useMemo(() => {
    if (!review?.issues) return [];
    const counts = new Map<string, number>();
    review.issues.forEach((issue) => {
      const f = issue.file || issue.filePath;
      counts.set(f, (counts.get(f) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([path, count]) => ({ path, count }));
  }, [review]);

  // Severity stats (from backend stats object or computed)
  const severityStats = useMemo(() => {
    if (!review) return { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
    if (review.stats) {
      return {
        critical: review.stats.critical || 0,
        high: review.stats.high || 0,
        medium: review.stats.medium || 0,
        low: review.stats.low || 0,
        total: (review.stats.critical || 0) + (review.stats.high || 0) + (review.stats.medium || 0) + (review.stats.low || 0),
      };
    }
    const issues = review.issues || [];
    return {
      critical: issues.filter((i) => String(i.severity).toUpperCase() === 'CRITICAL').length,
      high: issues.filter((i) => String(i.severity).toUpperCase() === 'HIGH').length,
      medium: issues.filter((i) => String(i.severity).toUpperCase() === 'MEDIUM').length,
      low: issues.filter((i) => String(i.severity).toUpperCase() === 'LOW').length,
      total: issues.length,
    };
  }, [review]);

  // Category counts
  const categoryCounts = useMemo(() => {
    if (!review?.issues) return { security: 0, bugs: 0, performance: 0, quality: 0, errorHandling: 0, other: 0 };
    const issues = review.issues;

    return {
      security: issues.filter((i) => /sec/i.test(String(i.category))).length,
      bugs: issues.filter((i) => /bug/i.test(String(i.category))).length,
      performance: issues.filter((i) => /perf/i.test(String(i.category))).length,
      quality: issues.filter((i) => /qual|maintain/i.test(String(i.category))).length,
      errorHandling: issues.filter((i) => /error/i.test(String(i.category))).length,
      other: issues.filter((i) => /practice|arch/i.test(String(i.category))).length,
    };
  }, [review]);

  // Filtered issues based on Search, Severity, Category, File
  const filteredIssues = useMemo(() => {
    if (!review?.issues) return [];

    return review.issues.filter((issue) => {
      // 1. Severity filter
      if (filterSeverity !== 'all') {
        if (String(issue.severity).toUpperCase() !== filterSeverity.toUpperCase()) {
          return false;
        }
      }

      // 2. Category filter
      if (activeCategory !== 'all') {
        const cat = String(issue.category).toLowerCase();
        if (activeCategory === 'security' && !cat.includes('sec')) return false;
        if (activeCategory === 'bugs' && !cat.includes('bug')) return false;
        if (activeCategory === 'performance' && !cat.includes('perf')) return false;
        if (activeCategory === 'quality' && !cat.includes('qual') && !cat.includes('maintain')) return false;
        if (activeCategory === 'error' && !cat.includes('error')) return false;
        if (activeCategory === 'arch' && !cat.includes('arch') && !cat.includes('practice')) return false;
      }

      // 3. File filter
      if (filterFile !== 'all') {
        const filePath = issue.file || issue.filePath;
        if (filePath !== filterFile) return false;
      }

      // 4. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (issue.title || '').toLowerCase().includes(q);
        const descMatch = (issue.description || '').toLowerCase().includes(q);
        const impactMatch = (issue.impact || '').toLowerCase().includes(q);
        const recMatch = (issue.recommendation || '').toLowerCase().includes(q);
        const fileMatch = (issue.file || issue.filePath || '').toLowerCase().includes(q);

        if (!titleMatch && !descMatch && !impactMatch && !recMatch && !fileMatch) {
          return false;
        }
      }

      return true;
    });
  }, [review, activeCategory, filterSeverity, filterFile, searchQuery]);

  const hasActiveFilters = filterSeverity !== 'all' || activeCategory !== 'all' || filterFile !== 'all' || searchQuery.trim() !== '';

  const resetAllFilters = () => {
    setFilterSeverity('all');
    setActiveCategory('all');
    setFilterFile('all');
    setSearchQuery('');
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (String(severity).toUpperCase()) {
      case 'CRITICAL':
        return 'danger';
      case 'HIGH':
        return 'danger';
      case 'MEDIUM':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const getScoreVerdict = (score: number) => {
    if (score >= 85) {
      return {
        label: 'Excellent',
        color: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
        desc: 'Codebase exhibits robust architecture, strict security hygiene, and clean patterns.',
      };
    }
    if (score >= 70) {
      return {
        label: 'Good Quality',
        color: 'text-indigo-400',
        badgeBg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
        desc: 'Solid codebase with minor architectural or performance optimization opportunities.',
      };
    }
    if (score >= 50) {
      return {
        label: 'Needs Improvement',
        color: 'text-amber-400',
        badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
        desc: 'Identified notable security vulnerabilities or error-handling defects requiring attention.',
      };
    }
    return {
      label: 'Critical Remediation Needed',
      color: 'text-rose-400',
      badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
      desc: 'Multiple critical security flaws or high-impact logical bugs require immediate remediation.',
    };
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
                { id: 'all', label: 'All Findings', count: review?.issues?.length || 0 },
                { id: 'security', label: 'Security', count: categoryCounts.security },
                { id: 'bugs', label: 'Bugs', count: categoryCounts.bugs },
                { id: 'performance', label: 'Performance', count: categoryCounts.performance },
                { id: 'quality', label: 'Code Quality', count: categoryCounts.quality },
                { id: 'error', label: 'Error Handling', count: categoryCounts.errorHandling },
                { id: 'arch', label: 'Architecture & Best Practices', count: categoryCounts.other },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeCategory === tab.id
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
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
          {/* Loading State: Multi-Stage Animated Scanner */}
          {loading && (
            <div className="p-10 sm:p-14 rounded-2xl bg-[#0E1626]/80 border border-white/[0.08] flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-bold text-white">Advanced AI Code Review in Progress</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Fetching AST trees, scanning security vulnerabilities, analyzing operational bugs, and generating developer-ready refactors...
                </p>
              </div>

              {/* Progress skeleton pulse bars */}
              <div className="w-full max-w-md space-y-2.5">
                <div className="h-2 bg-indigo-500/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 rounded-full animate-pulse w-4/5" />
                </div>
                <div className="grid grid-cols-3 text-[11px] text-gray-500 text-center font-mono">
                  <span>1. Tree Ingestion</span>
                  <span>2. Gemini Reasoning</span>
                  <span>3. Fix Generation</span>
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
                  Verify that the repository contains supported source code files and your GitHub connection is authenticated.
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
                        {review.analyzedFilesCount} source files analyzed
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-300 leading-relaxed whitespace-pre-line">
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
                    Overall Codebase Health
                  </span>

                  <div className="relative w-32 h-32 flex items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500/20 via-indigo-500/20 to-cyan-500/20 border-4 border-indigo-500/40 shadow-inner my-2">
                    <div className="text-center">
                      <div className="text-4xl font-extrabold text-white">{review.score}</div>
                      <div className="text-xs text-gray-400">/ 100</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${scoreVerdict.badgeBg}`}>
                      {scoreVerdict.label}
                    </span>
                    <p className="text-xs text-gray-400 mt-2 max-w-xs leading-relaxed">
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

              {/* Severity Pill Counters (Interactive Quick Filters) */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Severity Breakdown (Click to filter)
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setFilterSeverity(filterSeverity === 'CRITICAL' ? 'all' : 'CRITICAL')}
                    className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                      filterSeverity === 'CRITICAL'
                        ? 'bg-red-500/30 border-red-500 text-white shadow-lg shadow-red-500/20'
                        : 'bg-red-950/20 border-red-500/30 text-red-300 hover:bg-red-950/40'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-bold">
                      {severityStats.critical} Critical
                    </span>
                  </button>

                  <button
                    onClick={() => setFilterSeverity(filterSeverity === 'HIGH' ? 'all' : 'HIGH')}
                    className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                      filterSeverity === 'HIGH'
                        ? 'bg-amber-500/30 border-amber-500 text-white shadow-lg shadow-amber-500/20'
                        : 'bg-amber-950/20 border-amber-500/30 text-amber-300 hover:bg-amber-950/40'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold">
                      {severityStats.high} High
                    </span>
                  </button>

                  <button
                    onClick={() => setFilterSeverity(filterSeverity === 'MEDIUM' ? 'all' : 'MEDIUM')}
                    className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                      filterSeverity === 'MEDIUM'
                        ? 'bg-indigo-500/30 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        : 'bg-indigo-950/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-950/40'
                    }`}
                  >
                    <Bug className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold">
                      {severityStats.medium} Medium
                    </span>
                  </button>

                  <button
                    onClick={() => setFilterSeverity(filterSeverity === 'LOW' ? 'all' : 'LOW')}
                    className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                      filterSeverity === 'LOW'
                        ? 'bg-slate-700/60 border-gray-400 text-white shadow-lg'
                        : 'bg-slate-900 border-white/10 text-gray-300 hover:bg-slate-800'
                    }`}
                  >
                    <Info className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-bold">
                      {severityStats.low} Low
                    </span>
                  </button>

                  {filterSeverity !== 'all' && (
                    <button
                      onClick={() => setFilterSeverity('all')}
                      className="text-xs text-gray-400 hover:text-white underline cursor-pointer ml-1"
                    >
                      Clear severity filter
                    </button>
                  )}
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="p-4 rounded-xl bg-[#0E1626]/90 border border-white/10 space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  {/* Search input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search issues by title, description, impact, or file..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#080F1A] border border-white/10 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Severity select */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-gray-400 hidden sm:inline">Severity:</span>
                      <select
                        value={filterSeverity}
                        onChange={(e) => setFilterSeverity(e.target.value)}
                        className="bg-[#080F1A] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                      >
                        <option value="all">All Severities</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                    </div>

                    {/* File select */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-gray-400 hidden sm:inline">File:</span>
                      <select
                        value={filterFile}
                        onChange={(e) => setFilterFile(e.target.value)}
                        className="bg-[#080F1A] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer max-w-[200px] truncate"
                      >
                        <option value="all">All Files ({fileOptions.length})</option>
                        {fileOptions.map((f) => (
                          <option key={f.path} value={f.path}>
                            {f.path} ({f.count})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Reset Filters button */}
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetAllFilters}
                        leftIcon={<RotateCcw className="w-3 h-3" />}
                        className="text-xs"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>

                {/* Sub-toolbar: Issue counts & Expand/Collapse controls */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      Showing {filteredIssues.length} of {review.issues.length} findings
                    </span>
                    {hasActiveFilters && (
                      <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                        Filtered
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={expandAllIssues}
                      className="text-[11px] text-gray-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Expand All
                    </button>
                    <span>•</span>
                    <button
                      onClick={collapseAllIssues}
                      className="text-[11px] text-gray-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
              </div>

              {/* Issues List Section */}
              <div className="space-y-4">
                {/* Empty State */}
                {filteredIssues.length === 0 && (
                  <div className="p-12 text-center rounded-2xl bg-[#0E1626]/40 border border-white/10 flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-white">No Issues Found</h3>
                      <p className="text-xs text-gray-400 max-w-sm">
                        {hasActiveFilters
                          ? 'No issues match your current filters or search term.'
                          : 'Congratulations! All scanned files satisfy security, performance, and architecture rules.'}
                      </p>
                    </div>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={resetAllFilters}>
                        Reset All Filters
                      </Button>
                    )}
                  </div>
                )}

                {/* Issues Cards */}
                {filteredIssues.length > 0 && (
                  <div className="space-y-3.5">
                    {filteredIssues.map((issue) => {
                      const isExpanded = expandedIssueIds.has(issue.id);
                      const issueFile = issue.file || issue.filePath;
                      const sourceFileObj = sourceFilesMap.get(issueFile);

                      return (
                        <Card
                          key={issue.id}
                          className="border-white/10 bg-[#0E1626]/90 overflow-hidden transition-all duration-200"
                        >
                          {/* Card Header Row */}
                          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <Badge
                                variant={getSeverityBadgeVariant(issue.severity)}
                                size="sm"
                                className="mt-0.5 uppercase shrink-0 font-mono text-[10px]"
                              >
                                {issue.severity}
                              </Badge>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm font-semibold text-white truncate">
                                    {issue.title}
                                  </h3>
                                  <Badge variant="neutral" size="sm" className="text-[10px]">
                                    {issue.category}
                                  </Badge>
                                </div>

                                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                                  {issue.description}
                                </p>

                                <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] font-mono text-gray-400">
                                  <div className="flex items-center gap-1.5 text-indigo-300">
                                    <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span className="truncate">{issueFile}:{issue.line}</span>
                                  </div>

                                  {issue.impact && (
                                    <span className="text-[10px] text-red-300/80 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 truncate max-w-xs">
                                      Impact: {issue.impact}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Card Header Actions */}
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setInspectIssue(issue)}
                                leftIcon={<Code2 className="w-3.5 h-3.5 text-indigo-400" />}
                                title="Open full Code Viewer modal"
                              >
                                View Code
                              </Button>

                              <button
                                onClick={() => toggleIssueExpanded(issue.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                                aria-label={isExpanded ? 'Collapse issue' : 'Expand issue'}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Card Details (Inline Code Viewer & Recommendations) */}
                          {isExpanded && (
                            <div className="px-4 pb-5 sm:px-5 pt-0 border-t border-white/5 space-y-4 animate-fade-in">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 text-xs">
                                <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/25 space-y-1">
                                  <div className="flex items-center gap-1.5 text-red-400 font-semibold text-[11px]">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Impact & Risk</span>
                                  </div>
                                  <p className="text-red-200/90 leading-relaxed text-[11px]">
                                    {issue.impact}
                                  </p>
                                </div>

                                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/25 space-y-1">
                                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Actionable Recommendation</span>
                                  </div>
                                  <p className="text-emerald-200/90 leading-relaxed text-[11px]">
                                    {issue.recommendation}
                                  </p>
                                </div>
                              </div>

                              {/* Inline Code Viewer */}
                              <CodeViewer
                                issue={issue}
                                sourceFile={sourceFileObj}
                                isModal={false}
                              />
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Dedicated Code Inspection Modal */}
      {inspectIssue && (
        <CodeViewer
          issue={inspectIssue}
          sourceFile={sourceFilesMap.get(inspectIssue.file || inspectIssue.filePath)}
          isModal={true}
          onClose={() => setInspectIssue(null)}
        />
      )}
    </div>
  );
};

export default Review;
