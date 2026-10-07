import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { ExplainCodeModal } from '../components/codebase/ExplainCodeModal';
import { api } from '../services/api';
import type {
  TechnicalDebtFinding,
  TechnicalDebtStats,
  CodeComplexityMetrics,
  GitHubRepo,
  DebtSeverity,
  DebtCategory,
} from '../types';
import {
  FileWarning,
  RefreshCw,
  Search,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Code,
  Layers,
  Clock,
  Gauge,
} from 'lucide-react';
import { cn } from '../utils/cn';

const CATEGORIES: DebtCategory[] = [
  'Complexity',
  'Duplication',
  'Maintainability',
  'Architecture',
  'Error Handling',
  'Code Quality',
];

export const TechnicalDebt: React.FC = () => {
  const { owner: routeOwner, repo: routeRepo } = useParams<{ owner?: string; repo?: string }>();
  const navigate = useNavigate();

  // State
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>(routeOwner || 'developit');
  const [selectedRepo, setSelectedRepo] = useState<string>(routeRepo || 'mitt');
  const [findings, setFindings] = useState<TechnicalDebtFinding[]>([]);
  const [stats, setStats] = useState<TechnicalDebtStats | null>(null);
  const [complexity, setComplexity] = useState<CodeComplexityMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedFindings, setExpandedFindings] = useState<Record<string | number, boolean>>({});

  // Active tab: 'findings' | 'complexity'
  const [activeTab, setActiveTab] = useState<'findings' | 'complexity'>('findings');

  // Explain with AI modal
  const [explainModalOpen, setExplainModalOpen] = useState(false);
  const [explainFile, setExplainFile] = useState('');
  const [explainSnippet, setExplainSnippet] = useState('');

  // 1. Fetch repositories
  useEffect(() => {
    let isMounted = true;
    api
      .getRepos()
      .then((res) => {
        if (isMounted && res.repositories && res.repositories.length > 0) {
          setRepos(res.repositories);
          if (!routeOwner || !routeRepo) {
            setSelectedOwner(res.repositories[0].owner);
            setSelectedRepo(res.repositories[0].name);
          }
        }
      })
      .catch((err) => {
        console.warn('[TechnicalDebt] Failed to fetch repos:', err.message);
      });
    return () => {
      isMounted = false;
    };
  }, [routeOwner, routeRepo]);

  // Sync route params
  useEffect(() => {
    if (routeOwner && routeRepo) {
      setSelectedOwner(routeOwner);
      setSelectedRepo(routeRepo);
    }
  }, [routeOwner, routeRepo]);

  // 2. Load findings and complexity
  const loadDebtData = useCallback(async (owner: string, repo: string) => {
    setLoading(true);
    setError(null);

    try {
      const [debtRes, compRes] = await Promise.allSettled([
        api.getTechnicalDebt(owner, repo),
        api.getComplexity(owner, repo),
      ]);

      if (debtRes.status === 'fulfilled') {
        setFindings(debtRes.value.findings || []);
        setStats(debtRes.value.stats);
      } else {
        // If not scanned yet, auto trigger scan
        const scanRes = await api.scanTechnicalDebt({ owner, repo });
        setFindings(scanRes.findings || []);
        if (scanRes.complexityMetrics) setComplexity(scanRes.complexityMetrics);
      }

      if (compRes.status === 'fulfilled') {
        setComplexity(compRes.value);
      }
    } catch (err: any) {
      console.warn('[TechnicalDebt] Error loading data:', err.message);
      setError(err.message || 'Failed to load technical debt data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOwner && selectedRepo) {
      loadDebtData(selectedOwner, selectedRepo);
    }
  }, [selectedOwner, selectedRepo, loadDebtData]);

  // 3. Trigger manual scan
  const handleScan = async (force: boolean = false) => {
    setScanning(true);
    setError(null);

    try {
      const res = await api.scanTechnicalDebt({
        owner: selectedOwner,
        repo: selectedRepo,
        force,
      });

      setFindings(res.findings || []);
      if (res.complexityMetrics) {
        setComplexity(res.complexityMetrics);
      }
      // Re-fetch stats
      const debtData = await api.getTechnicalDebt(selectedOwner, selectedRepo);
      setStats(debtData.stats);
    } catch (err: any) {
      setError(err.message || 'Failed to scan technical debt.');
    } finally {
      setScanning(false);
    }
  };

  const handleRepoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [o, r] = e.target.value.split('/');
    if (o && r) {
      setSelectedOwner(o);
      setSelectedRepo(r);
      navigate(`/technical-debt/${o}/${r}`);
    }
  };

  const toggleExpand = (id: string | number) => {
    setExpandedFindings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openExplain = (file: string, snippet: string) => {
    setExplainFile(file);
    setExplainSnippet(snippet);
    setExplainModalOpen(true);
  };

  // Filtered findings
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (severityFilter !== 'ALL' && f.severity !== severityFilter) return false;
      if (categoryFilter !== 'ALL' && f.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesFile = f.file.toLowerCase().includes(q);
        const matchesTitle = f.title.toLowerCase().includes(q);
        const matchesDesc = f.description.toLowerCase().includes(q);
        if (!matchesFile && !matchesTitle && !matchesDesc) return false;
      }
      return true;
    });
  }, [findings, severityFilter, categoryFilter, searchQuery]);

  const getSeverityBadge = (sev: DebtSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      case 'MEDIUM':
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
      case 'LOW':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-300 border-gray-500/20';
    }
  };

  const getEffortBadge = (effort: string) => {
    switch (effort) {
      case 'HIGH':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    }
  };

  return (
    <div className="flex min-h-screen bg-[#070D18] text-white">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#070D18]/90 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-400">
              <FileWarning className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">Technical Debt & Complexity</h1>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  CODE HEALTH DEFICITS
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Audits duplication, cyclomatic complexity, nesting depth, error boundaries, and estimated remediation effort
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Repository Select */}
            <select
              value={`${selectedOwner}/${selectedRepo}`}
              onChange={handleRepoChange}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            >
              {repos.length > 0 ? (
                repos.map((r) => (
                  <option key={r.id} value={`${r.owner}/${r.name}`} className="bg-[#070D18] text-white">
                    {r.owner}/{r.name}
                  </option>
                ))
              ) : (
                <option value={`${selectedOwner}/${selectedRepo}`} className="bg-[#070D18] text-white">
                  {selectedOwner}/{selectedRepo}
                </option>
              )}
            </select>

            {/* Scan Button */}
            <button
              onClick={() => handleScan(true)}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', scanning && 'animate-spin')} />
              <span>{scanning ? 'Scanning Debt...' : 'Scan Technical Debt'}</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 max-w-7xl w-full mx-auto">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Technical Debt Scan Notice</p>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}

          {/* Stats Bar (Total Findings, Critical, High, Medium, Low) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl border border-white/[0.08] bg-[#070D18] shadow-sm">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Total Findings</span>
              <p className="text-2xl font-bold font-mono text-white mt-1">
                {stats?.total ?? findings.length}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.02]">
              <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider">Critical</span>
              <p className="text-2xl font-bold font-mono text-rose-400 mt-1">
                {stats?.critical ?? findings.filter((f) => f.severity === 'CRITICAL').length}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.02]">
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">High</span>
              <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
                {stats?.high ?? findings.filter((f) => f.severity === 'HIGH').length}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.02]">
              <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">Medium</span>
              <p className="text-2xl font-bold font-mono text-indigo-400 mt-1">
                {stats?.medium ?? findings.filter((f) => f.severity === 'MEDIUM').length}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.02]">
              <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider">Low</span>
              <p className="text-2xl font-bold font-mono text-blue-400 mt-1">
                {stats?.low ?? findings.filter((f) => f.severity === 'LOW').length}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
            <button
              onClick={() => setActiveTab('findings')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2',
                activeTab === 'findings'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <FileWarning className="w-4 h-4" />
              <span>Debt Findings ({findings.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('complexity')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2',
                activeTab === 'complexity'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <Gauge className="w-4 h-4" />
              <span>Complexity Analysis ({complexity?.complexityScore ?? '--'}/100)</span>
            </button>
          </div>

          {activeTab === 'findings' ? (
            <div className="space-y-4">
              {/* Filters Bar (Severity, Category, Search) */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Severity Filter */}
                  <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                    <span className="text-[11px] text-gray-400 font-mono">Severity:</span>
                    <select
                      value={severityFilter}
                      onChange={(e) => setSeverityFilter(e.target.value)}
                      className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-[#070D18]">ALL</option>
                      <option value="CRITICAL" className="bg-[#070D18]">CRITICAL</option>
                      <option value="HIGH" className="bg-[#070D18]">HIGH</option>
                      <option value="MEDIUM" className="bg-[#070D18]">MEDIUM</option>
                      <option value="LOW" className="bg-[#070D18]">LOW</option>
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                    <span className="text-[11px] text-gray-400 font-mono">Category:</span>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-[#070D18]">ALL</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat} className="bg-[#070D18]">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* File / Title Search */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by file or description..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Findings List */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <RefreshCw className="w-7 h-7 text-purple-400 animate-spin" />
                  <p className="text-xs text-gray-400">Loading technical debt findings...</p>
                </div>
              ) : filteredFindings.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                  <p className="text-xs text-gray-400">
                    No technical debt findings matching the selected filters.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFindings.map((finding) => {
                    const isExpanded = !!expandedFindings[finding.id];
                    return (
                      <div
                        key={finding.id}
                        className="rounded-2xl border border-white/[0.08] bg-[#070D18] hover:border-white/20 transition-all overflow-hidden shadow-md"
                      >
                        <div
                          onClick={() => toggleExpand(finding.id)}
                          className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none bg-white/[0.01] hover:bg-white/[0.03]"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span
                              className={cn(
                                'text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border shrink-0',
                                getSeverityBadge(finding.severity)
                              )}
                            >
                              {finding.severity}
                            </span>

                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10 shrink-0">
                              {finding.category}
                            </span>

                            <span className="text-xs font-semibold text-white truncate">
                              {finding.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* Estimated effort badge */}
                            <span
                              className={cn(
                                'text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1',
                                getEffortBadge(finding.estimatedEffort)
                              )}
                            >
                              <Clock className="w-3 h-3" />
                              Effort: {finding.estimatedEffort}
                            </span>

                            <span className="text-xs font-mono text-gray-400 hidden sm:inline truncate max-w-[150px]">
                              {finding.file}:{finding.line}
                            </span>

                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="p-5 border-t border-white/[0.06] bg-black/20 space-y-4 text-xs">
                            <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/5 flex-wrap gap-2">
                              <span className="font-mono text-gray-300 text-[11px]">
                                Location: <span className="text-indigo-400">{finding.file}</span> (Line {finding.line})
                              </span>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openExplain(finding.file, finding.codeSnippet || '');
                                }}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium cursor-pointer transition-all"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                Explain with AI
                              </button>
                            </div>

                            <p className="text-gray-200 leading-relaxed">{finding.description}</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                                <span className="text-[10px] font-mono uppercase text-gray-400 font-semibold">Impact</span>
                                <p className="text-gray-300">{finding.impact}</p>
                              </div>

                              <div className="p-3 rounded-xl bg-indigo-500/[0.02] border border-indigo-500/10 space-y-1">
                                <span className="text-[10px] font-mono uppercase text-indigo-400 font-semibold">Recommendation</span>
                                <p className="text-indigo-200/90">{finding.recommendation}</p>
                              </div>
                            </div>

                            {/* Code snippet if available */}
                            {finding.codeSnippet && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-mono uppercase text-gray-400">Code Snippet Reference</span>
                                <pre className="p-3 rounded-xl bg-black/60 border border-white/10 text-indigo-300 font-mono text-xs overflow-x-auto leading-relaxed">
                                  {finding.codeSnippet}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Deterministic Code Complexity Analysis View */
            <div className="space-y-6">
              {/* Complexity Hero Score */}
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Deterministic Cyclomatic Complexity Score
                  </span>
                  <h3 className="text-xl font-bold text-white">Repository Structural Density</h3>
                  <p className="text-xs text-gray-400 max-w-xl leading-relaxed">
                    Evaluates branch decision points, nesting boundaries, and parameter counts across{' '}
                    <span className="text-white font-mono">{complexity?.totalFilesAnalyzed ?? 0}</span> files and{' '}
                    <span className="text-white font-mono">{complexity?.totalFunctionsAnalyzed ?? 0}</span> functions.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center shrink-0">
                  <span className="text-3xl font-extrabold font-mono text-indigo-400">
                    {complexity?.complexityScore ?? 85}
                  </span>
                  <span className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                    Score / 100
                  </span>
                </div>
              </div>

              {/* Grid: Most Complex Files & Most Complex Functions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Most Complex Files */}
                <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-sm font-bold text-white">Most Complex Files</h4>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {complexity?.mostComplexFiles && complexity.mostComplexFiles.length > 0 ? (
                      complexity.mostComplexFiles.map((f, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-white font-semibold truncate">{f.path}</p>
                            <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
                              <span>{f.lines} lines</span>
                              <span>{f.functionsCount} functions</span>
                              <span>Max nesting: {f.maxNestingDepth}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 text-xs">
                              {f.complexityScore}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 py-6 text-center">No complex files detected.</p>
                    )}
                  </div>
                </div>

                {/* Most Complex Functions */}
                <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-purple-400" />
                      <h4 className="text-sm font-bold text-white">Most Complex Functions</h4>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {complexity?.mostComplexFunctions && complexity.mostComplexFunctions.length > 0 ? (
                      complexity.mostComplexFunctions.map((fn, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-white font-semibold truncate">{fn.name}()</p>
                            <p className="text-[11px] font-mono text-gray-400 truncate">
                              {fn.file} (Line {fn.line})
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
                              <span>{fn.linesCount} lines</span>
                              <span>{fn.parameterCount} params</span>
                              <span>Nesting: {fn.nestingDepth}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 text-xs">
                              Complexity: {fn.cyclomaticComplexity}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 py-6 text-center">No functions found.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Explain Code Modal */}
      <ExplainCodeModal
        isOpen={explainModalOpen}
        onClose={() => setExplainModalOpen(false)}
        filePath={explainFile}
        initialSnippet={explainSnippet}
        repositoryId={`${selectedOwner}/${selectedRepo}`}
      />
    </div>
  );
};

export default TechnicalDebt;
