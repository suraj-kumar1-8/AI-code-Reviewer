import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { DiffViewer } from '../components/security/DiffViewer';
import { api } from '../services/api';
import type { SecurityScan, SecurityFinding, GitHubRepo } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCode2,
  Lock,
} from 'lucide-react';
import { cn } from '../utils/cn';

export const Security: React.FC = () => {
  const { owner: routeOwner, repo: routeRepo } = useParams<{ owner?: string; repo?: string }>();
  const navigate = useNavigate();

  // State
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>(routeOwner || 'developit');
  const [selectedRepo, setSelectedRepo] = useState<string>(routeRepo || 'mitt');
  const [scan, setScan] = useState<SecurityScan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [fileFilter, setFileFilter] = useState<string>('ALL');

  // Fix Generation State
  const [expandedFixes, setExpandedFixes] = useState<Record<string | number, boolean>>({});
  const [generatingFixId, setGeneratingFixId] = useState<string | number | null>(null);
  const [fixErrors, setFixErrors] = useState<Record<string | number, string>>({});

  // 1. Fetch user repositories for dropdown
  useEffect(() => {
    let isMounted = true;
    api
      .getRepos()
      .then((res) => {
        if (isMounted && res.repositories && res.repositories.length > 0) {
          setRepos(res.repositories);
          // If no route params, select first repository
          if (!routeOwner || !routeRepo) {
            setSelectedOwner(res.repositories[0].owner);
            setSelectedRepo(res.repositories[0].name);
          }
        }
      })
      .catch((err) => {
        console.warn('[Security] Failed to fetch repos:', err.message);
      });
    return () => {
      isMounted = false;
    };
  }, [routeOwner, routeRepo]);

  // Sync route params when changed
  useEffect(() => {
    if (routeOwner && routeRepo) {
      setSelectedOwner(routeOwner);
      setSelectedRepo(routeRepo);
    }
  }, [routeOwner, routeRepo]);

  // 2. Fetch existing security scan for selected repository
  const loadScan = useCallback(async (owner: string, repo: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSecurityScan(owner, repo);
      setScan(res.scan);
    } catch (err: any) {
      console.warn('[Security] Load scan error:', err.message);
      setError(err.message || 'Failed to load security scan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOwner && selectedRepo) {
      loadScan(selectedOwner, selectedRepo);
    }
  }, [selectedOwner, selectedRepo, loadScan]);

  // 3. Trigger new or forced scan
  const handleTriggerScan = async (force: boolean = false) => {
    if (!selectedOwner || !selectedRepo) return;
    setScanning(true);
    setError(null);

    try {
      const res = await api.runSecurityScan({
        owner: selectedOwner,
        repo: selectedRepo,
        force,
      });

      if (res.scan) {
        setScan(res.scan);
      }
    } catch (err: any) {
      console.error('[Security] Trigger scan error:', err);
      setError(err.message || 'Security scan failed.');
    } finally {
      setScanning(false);
    }
  };

  // 4. Handle generating or toggling AI Fix
  const handleToggleFix = async (finding: SecurityFinding) => {
    const findingId = finding.id;

    // If fix is already present or loaded, simply toggle expansion
    if (finding.fix || expandedFixes[findingId]) {
      setExpandedFixes((prev) => ({ ...prev, [findingId]: !prev[findingId] }));
      return;
    }

    // Generate fix via API
    setGeneratingFixId(findingId);
    setFixErrors((prev) => ({ ...prev, [findingId]: '' }));

    try {
      const res = await api.generateFindingFix(findingId);
      if (res.fix) {
        // Update local finding object
        setScan((prevScan) => {
          if (!prevScan || !prevScan.findings) return prevScan;
          return {
            ...prevScan,
            findings: prevScan.findings.map((f) =>
              f.id === findingId ? { ...f, hasFix: true, fix: res.fix } : f
            ),
          };
        });
        setExpandedFixes((prev) => ({ ...prev, [findingId]: true }));
      }
    } catch (err: any) {
      console.error('[Security] AI Fix error:', err);
      setFixErrors((prev) => ({ ...prev, [findingId]: err.message || 'Failed to generate fix.' }));
    } finally {
      setGeneratingFixId(null);
    }
  };

  // Switch repo handler
  const handleRepoChange = (fullRepoName: string) => {
    const [owner, name] = fullRepoName.split('/');
    if (owner && name) {
      setSelectedOwner(owner);
      setSelectedRepo(name);
      navigate(`/security/${owner}/${name}`);
    }
  };

  // 5. Unique categories & files for filter dropdowns
  const availableCategories = useMemo(() => {
    if (!scan?.findings) return [];
    return Array.from(new Set(scan.findings.map((f) => f.category))).sort();
  }, [scan]);

  const availableFiles = useMemo(() => {
    if (!scan?.findings) return [];
    return Array.from(new Set(scan.findings.map((f) => f.file))).sort();
  }, [scan]);

  // 6. Filtered findings based on user controls
  const filteredFindings = useMemo(() => {
    if (!scan?.findings) return [];

    return scan.findings.filter((finding) => {
      // Severity Filter
      if (severityFilter !== 'ALL' && finding.severity !== severityFilter) {
        return false;
      }

      // Category Filter
      if (categoryFilter !== 'ALL' && finding.category !== categoryFilter) {
        return false;
      }

      // File Filter
      if (fileFilter !== 'ALL' && finding.file !== fileFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = finding.title.toLowerCase().includes(q);
        const matchesDesc = finding.description.toLowerCase().includes(q);
        const matchesFile = finding.file.toLowerCase().includes(q);
        const matchesCode = finding.codeSnippet.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesFile && !matchesCode) {
          return false;
        }
      }

      return true;
    });
  }, [scan, severityFilter, categoryFilter, fileFilter, searchQuery]);

  // Score health badge
  const scoreBadge = useMemo(() => {
    const score = scan?.score ?? 100;
    if (score >= 90) {
      return { text: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    }
    if (score >= 75) {
      return { text: 'Good', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' };
    }
    if (score >= 50) {
      return { text: 'Moderate Risk', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
    }
    return { text: 'Critical Risk', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' };
  }, [scan?.score]);

  return (
    <div className="flex h-screen bg-[#030712] text-white overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#030712]/80 border-b border-white/[0.08] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600/20 to-indigo-600/30 border border-purple-500/30 text-purple-400 shadow-sm">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">Pro Security Scanner</h1>
                <span className="text-[10px] font-mono font-semibold tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  PRO AUDIT
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Static code vulnerability analysis, masked secret detection & AI remediation suggestions
              </p>
            </div>
          </div>

          {/* Repo selector & Scan actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Repo Dropdown */}
            <div className="relative">
              <select
                aria-label="Select repository"
                value={`${selectedOwner}/${selectedRepo}`}
                onChange={(e) => handleRepoChange(e.target.value)}
                className="bg-[#0A101D] border border-white/[0.12] rounded-xl px-3.5 py-2 text-xs font-medium text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer pr-8"
              >
                {repos.length > 0 ? (
                  repos.map((r) => (
                    <option key={r.id} value={`${r.owner}/${r.name}`}>
                      {r.owner}/{r.name}
                    </option>
                  ))
                ) : (
                  <option value={`${selectedOwner}/${selectedRepo}`}>
                    {selectedOwner}/{selectedRepo}
                  </option>
                )}
              </select>
            </div>

            {/* Force Re-Scan */}
            <button
              onClick={() => handleTriggerScan(true)}
              disabled={scanning}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                scanning
                  ? 'bg-white/5 border-white/10 text-gray-400 cursor-not-allowed'
                  : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/[0.08]'
              )}
              title="Force full re-scan bypassing cached results"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', scanning && 'animate-spin')} />
              <span>{scanning ? 'Scanning...' : 'Re-Scan'}</span>
            </button>

            {/* Run Security Scan Button */}
            <button
              onClick={() => handleTriggerScan(false)}
              disabled={scanning}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-lg',
                scanning
                  ? 'bg-purple-600/50 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/20'
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{scanning ? 'Auditing Codebase...' : 'Scan Repository'}</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-rose-400 hover:text-rose-200 text-xs underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-white/[0.03] border border-white/[0.05]" />
                ))}
              </div>
              <div className="h-96 rounded-xl bg-white/[0.03] border border-white/[0.05]" />
            </div>
          ) : !scan ? (
            /* No Scan Found Empty State */
            <div className="text-center py-20 px-4 rounded-2xl bg-[#070D18] border border-white/[0.08] shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">No Security Scans Found</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto mb-6">
                Repository <strong>{selectedOwner}/{selectedRepo}</strong> has not been audited yet. Run a scan to inspect for SQL injection, XSS, exposed tokens, and insecure configurations.
              </p>
              <button
                onClick={() => handleTriggerScan(false)}
                disabled={scanning}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{scanning ? 'Running Audit...' : 'Run Security Scan Now'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Top Security Overview & Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {/* Security Score Card */}
                <div className="col-span-2 sm:col-span-1 rounded-xl border border-white/[0.08] bg-[#070D18] p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Security Score</span>
                    <ShieldCheck className={cn('w-4 h-4', scoreBadge.color)} />
                  </div>
                  <div className="my-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
                      {scan.score}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">/ 100</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', scoreBadge.bg, scoreBadge.color)}>
                      {scoreBadge.text}
                    </span>
                    <span className="text-[10px] text-gray-500">{scan.filesScanned} files</span>
                  </div>
                </div>

                {/* Critical Card */}
                <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-4 flex flex-col justify-between shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider">Critical</span>
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-bold font-mono text-rose-200">
                      {scan.stats?.critical ?? 0}
                    </span>
                  </div>
                  <span className="text-[10px] text-rose-400/80">Immediate exploit risk</span>
                </div>

                {/* High Card */}
                <div className="rounded-xl border border-orange-500/20 bg-orange-950/10 p-4 flex flex-col justify-between shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-orange-300 uppercase tracking-wider">High</span>
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-bold font-mono text-orange-200">
                      {scan.stats?.high ?? 0}
                    </span>
                  </div>
                  <span className="text-[10px] text-orange-400/80">Severe vulnerabilities</span>
                </div>

                {/* Medium Card */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 flex flex-col justify-between shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">Medium</span>
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-bold font-mono text-amber-200">
                      {scan.stats?.medium ?? 0}
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-400/80">Moderate security flaws</span>
                </div>

                {/* Low Card */}
                <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-4 flex flex-col justify-between shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">Low</span>
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-bold font-mono text-blue-200">
                      {scan.stats?.low ?? 0}
                    </span>
                  </div>
                  <span className="text-[10px] text-blue-400/80">Minor hardening points</span>
                </div>

                {/* Secrets Detected Card */}
                <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-4 flex flex-col justify-between shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">Secrets</span>
                    <KeyRound className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-bold font-mono text-purple-200">
                      {scan.stats?.secrets ?? 0}
                    </span>
                  </div>
                  <span className="text-[10px] text-purple-400/80">Masked tokens & keys</span>
                </div>
              </div>

              {/* Scan Meta Bar */}
              <div className="p-4 rounded-xl bg-[#070D18] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
                <div className="flex items-center gap-3">
                  <span>
                    Commit: <strong className="text-gray-200 font-mono">{scan.commitSha ? scan.commitSha.slice(0, 7) : 'HEAD'}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Audited: <strong className="text-gray-200">{scan.filesScanned} source files</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Status: <strong className="text-emerald-400 capitalize">{scan.status}</strong>
                  </span>
                  {scan.cached && (
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      Cached SHA
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500">
                  Last scanned: {new Date(scan.createdAt).toLocaleString()}
                </div>
              </div>

              {/* Executive Threat Summary */}
              {scan.summary && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/20 to-indigo-950/20 border border-purple-500/20 text-xs text-gray-300 leading-relaxed">
                  <strong className="text-purple-300 font-semibold mr-1.5">Executive Threat Assessment:</strong>
                  {scan.summary}
                </div>
              )}

              {/* Filters & Search Bar */}
              <div className="p-4 rounded-xl bg-[#070D18] border border-white/[0.08] space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search vulnerabilities, files, code lines..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#030712] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                    />
                  </div>

                  {/* Severity Filter */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-gray-500" />
                    <select
                      aria-label="Filter by severity"
                      value={severityFilter}
                      onChange={(e) => setSeverityFilter(e.target.value)}
                      className="bg-[#030712] border border-white/[0.08] rounded-lg px-2.5 py-2 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50 cursor-pointer"
                    >
                      <option value="ALL">All Severities</option>
                      <option value="CRITICAL">Critical Only</option>
                      <option value="HIGH">High Only</option>
                      <option value="MEDIUM">Medium Only</option>
                      <option value="LOW">Low Only</option>
                    </select>
                  </div>

                  {/* Category Filter */}
                  {availableCategories.length > 0 && (
                    <select
                      aria-label="Filter by vulnerability category"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-[#030712] border border-white/[0.08] rounded-lg px-2.5 py-2 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50 cursor-pointer"
                    >
                      <option value="ALL">All Categories</option>
                      {availableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* File Filter */}
                  {availableFiles.length > 0 && (
                    <select
                      aria-label="Filter by file"
                      value={fileFilter}
                      onChange={(e) => setFileFilter(e.target.value)}
                      className="bg-[#030712] border border-white/[0.08] rounded-lg px-2.5 py-2 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50 cursor-pointer max-w-[200px] truncate"
                    >
                      <option value="ALL">All Files</option>
                      {availableFiles.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Clear Filters */}
                  {(severityFilter !== 'ALL' || categoryFilter !== 'ALL' || fileFilter !== 'ALL' || searchQuery) && (
                    <button
                      onClick={() => {
                        setSeverityFilter('ALL');
                        setCategoryFilter('ALL');
                        setFileFilter('ALL');
                        setSearchQuery('');
                      }}
                      className="text-xs text-purple-400 hover:text-purple-300 underline cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-white/[0.04]">
                  <span>Showing {filteredFindings.length} of {scan.findings?.length || 0} security findings</span>
                  <span>Grounding rule: findings include verified code evidence</span>
                </div>
              </div>

              {/* Findings List */}
              <div className="space-y-4">
                {filteredFindings.length === 0 ? (
                  <div className="text-center py-16 px-4 rounded-xl bg-[#070D18] border border-white/[0.08]">
                    <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2.5" />
                    <h4 className="text-sm font-bold text-white mb-1">
                      {scan.findings?.length === 0 ? 'No Security Vulnerabilities Detected' : 'No Findings Match Filters'}
                    </h4>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                      {scan.findings?.length === 0
                        ? 'All inspected files are cleanly compliant with security baselines.'
                        : 'Adjust your search query or filters to inspect other findings.'}
                    </p>
                  </div>
                ) : (
                  filteredFindings.map((finding) => {
                    const isExpanded = !!expandedFixes[finding.id];
                    const isGenerating = generatingFixId === finding.id;
                    const fixError = fixErrors[finding.id];

                    return (
                      <div
                        key={finding.id}
                        className={cn(
                          'rounded-xl border transition-all duration-200 overflow-hidden shadow-lg',
                          finding.severity === 'CRITICAL'
                            ? 'bg-[#0A0D18] border-rose-500/30'
                            : finding.severity === 'HIGH'
                            ? 'bg-[#0A0D18] border-orange-500/25'
                            : finding.severity === 'MEDIUM'
                            ? 'bg-[#0A0D18] border-amber-500/20'
                            : 'bg-[#0A0D18] border-white/[0.08]'
                        )}
                      >
                        {/* Finding Card Header */}
                        <div className="p-4 sm:p-5 border-b border-white/[0.06] flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1 min-w-[260px]">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Severity Badge */}
                              <span
                                className={cn(
                                  'text-[10px] font-bold px-2 py-0.5 rounded border uppercase font-mono tracking-wider',
                                  finding.severity === 'CRITICAL'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                    : finding.severity === 'HIGH'
                                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                                    : finding.severity === 'MEDIUM'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                )}
                              >
                                {finding.severity}
                              </span>

                              {/* Category Pill */}
                              <span className="text-[10px] font-medium text-gray-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                {finding.category}
                              </span>

                              {/* Secret Indicator */}
                              {finding.isSecret && (
                                <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">
                                  <Lock className="w-3 h-3 text-purple-400" />
                                  <span>Masked Secret</span>
                                </span>
                              )}

                              {/* Confidence */}
                              <span className="text-[10px] text-gray-500 font-mono">
                                Confidence: {finding.confidence}
                              </span>
                            </div>

                            {/* Title */}
                            <h3 className="text-sm font-bold text-white pt-1">
                              {finding.title}
                            </h3>

                            {/* File and Line */}
                            <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                              <FileCode2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="text-indigo-300 font-semibold">{finding.file}</span>
                              <span className="text-gray-500">:line {finding.line}</span>
                            </div>
                          </div>

                          {/* AI Fix Trigger Action */}
                          <div>
                            <button
                              onClick={() => handleToggleFix(finding)}
                              disabled={isGenerating}
                              className={cn(
                                'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer',
                                isExpanded
                                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                  : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                              )}
                              title="Generate or view AI remediation diff"
                            >
                              <Sparkles className={cn('w-3.5 h-3.5', isGenerating && 'animate-spin')} />
                              <span>
                                {isGenerating
                                  ? 'Generating Fix...'
                                  : isExpanded
                                  ? 'Hide Fix'
                                  : finding.hasFix || finding.fix
                                  ? 'View AI Fix'
                                  : 'Generate AI Fix'}
                              </span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>

                        {/* Finding Body */}
                        <div className="p-4 sm:p-5 space-y-4 text-xs">
                          {/* Description */}
                          <div>
                            <span className="font-semibold text-gray-300 block mb-1">Vulnerability Description</span>
                            <p className="text-gray-400 leading-relaxed">{finding.description}</p>
                          </div>

                          {/* Impact & Recommendation Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                              <span className="font-semibold text-rose-300 block mb-1">Exploit Impact</span>
                              <p className="text-gray-400 leading-relaxed text-[11px]">{finding.impact}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                              <span className="font-semibold text-emerald-300 block mb-1">Remediation Guidance</span>
                              <p className="text-gray-400 leading-relaxed text-[11px]">{finding.recommendation}</p>
                            </div>
                          </div>

                          {/* Code Evidence Snippet */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5 text-[11px] text-gray-400 font-mono">
                              <span>Code Evidence (line {finding.line}):</span>
                              {finding.isSecret && (
                                <span className="text-purple-400 text-[10px]">
                                  Secret masked: <strong>{finding.maskedSecret}</strong>
                                </span>
                              )}
                            </div>
                            <div className="p-3 rounded-lg bg-[#040812] border border-white/[0.06] font-mono text-xs text-gray-200 overflow-x-auto">
                              <pre className="whitespace-pre">{finding.codeSnippet}</pre>
                            </div>
                          </div>

                          {/* Fix Error Banner if any */}
                          {fixError && (
                            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                              {fixError}
                            </div>
                          )}

                          {/* Expanded AI Fix Diff Viewer */}
                          {isExpanded && finding.fix && (
                            <div className="pt-2">
                              <DiffViewer
                                beforeCode={finding.fix.beforeCode}
                                afterCode={finding.fix.afterCode}
                                diff={finding.fix.diff}
                                explanation={finding.fix.explanation}
                                recommendedFix={finding.fix.recommendedFix}
                                confidence={finding.fix.confidence}
                                model={finding.fix.model}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Security;
