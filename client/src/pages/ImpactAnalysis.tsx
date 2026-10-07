import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { api } from '../services/api';
import type { ImpactAnalysisResult, GitHubRepo } from '../types';
import {
  Flame,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Layers,
  FileCode,
  Globe,
  Layout,
  TestTube2,
  CheckSquare,
  Sparkles,
  Menu,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '../utils/cn';

export const ImpactAnalysis: React.FC = () => {
  const { owner: routeOwner, repo: routeRepo } = useParams<{ owner?: string; repo?: string }>();
  const navigate = useNavigate();

  // Navigation & Repos
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>(routeOwner || localStorage.getItem('lastViewedRepoOwner') || 'developit');
  const [selectedRepo, setSelectedRepo] = useState<string>(routeRepo || localStorage.getItem('lastViewedRepoName') || 'mitt');

  // Input states
  const [targetFile, setTargetFile] = useState<string>('src/index.ts');
  const [targetSymbol, setTargetSymbol] = useState<string>('mitt');
  const [branch, setBranch] = useState<string>('');

  // Analysis result & state
  const [analysis, setAnalysis] = useState<ImpactAnalysisResult | null>(null);
  const [previousAnalyses, setPreviousAnalyses] = useState<ImpactAnalysisResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedChecks, setCheckedChecks] = useState<Record<number, boolean>>({});

  // 1. Fetch Repositories
  useEffect(() => {
    api
      .getRepos()
      .then((res) => {
        if (res.repositories && res.repositories.length > 0) {
          setRepos(res.repositories);
        }
      })
      .catch((err) => console.warn('Failed to load repos:', err.message));
  }, []);

  // 2. Fetch Previous Impact Analyses
  const loadHistory = async (o = selectedOwner, r = selectedRepo) => {
    if (!o || !r) return;
    try {
      const data = await api.getImpactAnalyses(o, r);
      setPreviousAnalyses(data.analyses || []);
      if (!analysis && data.analyses && data.analyses.length > 0) {
        setAnalysis(data.analyses[0]);
      }
    } catch (err: any) {
      console.warn('Failed to fetch impact history:', err.message);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [selectedOwner, selectedRepo]);

  const handleRepoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const [o, r] = val.split('/');
    if (o && r) {
      setSelectedOwner(o);
      setSelectedRepo(r);
      localStorage.setItem('lastViewedRepoOwner', o);
      localStorage.setItem('lastViewedRepoName', r);
      navigate(`/impact/${o}/${r}`);
      loadHistory(o, r);
    }
  };

  const handleAnalyze = async (e?: React.FormEvent, force = true) => {
    if (e) e.preventDefault();
    if (!selectedOwner || !selectedRepo || !targetFile.trim()) return;

    setLoading(true);
    setError(null);
    setCheckedChecks({});

    try {
      const res = await api.analyzeImpact({
        owner: selectedOwner.trim(),
        repo: selectedRepo.trim(),
        targetFile: targetFile.trim(),
        targetSymbol: targetSymbol.trim() || undefined,
        branch: branch.trim() || undefined,
        force,
      });

      if (res.success && res.analysis) {
        setAnalysis(res.analysis);
        loadHistory(selectedOwner, selectedRepo);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze change impact.');
    } finally {
      setLoading(false);
    }
  };

  const loadSample = (file: string, symbol: string) => {
    setTargetFile(file);
    setTargetSymbol(symbol);
  };

  const toggleCheck = (idx: number) => {
    setCheckedChecks((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getImpactBadge = (level: string) => {
    const l = (level || 'LOW').toUpperCase();
    if (l === 'CRITICAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
          <Flame className="w-3.5 h-3.5" /> CRITICAL BLAST RADIUS
        </span>
      );
    }
    if (l === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
          <AlertTriangle className="w-3.5 h-3.5 text-purple-400" /> HIGH IMPACT
        </span>
      );
    }
    if (l === 'MEDIUM') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
          <AlertTriangle className="w-3.5 h-3.5" /> MEDIUM IMPACT
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
        <CheckCircle2 className="w-3.5 h-3.5" /> LOW IMPACT
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-[#070D18] text-gray-200 overflow-hidden font-sans">
      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-50 w-64 bg-[#070D18] h-full shadow-2xl">
            <Sidebar onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-[#070D18]/90 backdrop-blur-md border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white md:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-wide">
                  Change Impact & Blast Radius Analysis
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  FEATURE 1
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Deterministic dependency graph & caller tracing — know what could break before you commit
              </p>
            </div>
          </div>

          {/* Repo Selector */}
          <div className="flex items-center gap-3">
            <select
              value={`${selectedOwner}/${selectedRepo}`}
              onChange={handleRepoChange}
              className="px-3 py-1.5 bg-[#0B132B] border border-white/10 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-purple-500 transition-colors"
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
        </header>

        {/* Content Body */}
        <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Analysis Form Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0B132B]/80 to-[#0A1024] border border-white/[0.08] shadow-lg">
            <form onSubmit={handleAnalyze} className="space-y-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Target File Path <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <FileCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={targetFile}
                      onChange={(e) => setTargetFile(e.target.value)}
                      placeholder="e.g. src/index.ts or src/services/authService.js"
                      className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Target Function / Class / Symbol (Optional)
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={targetSymbol}
                      onChange={(e) => setTargetSymbol(e.target.value)}
                      placeholder="e.g. mitt, verifyToken, handleLogin"
                      className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="w-full md:w-44">
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Branch (Optional)
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Sample Presets & Submit */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Presets:</span>
                  <button
                    type="button"
                    onClick={() => loadSample('src/index.ts', 'mitt')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 border border-white/10 transition-colors font-mono text-[11px]"
                  >
                    src/index.ts (mitt)
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample('src/server.js', 'authMiddleware')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 border border-white/10 transition-colors font-mono text-[11px]"
                  >
                    src/server.js (authMiddleware)
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || !targetFile.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing Blast Radius...
                    </>
                  ) : (
                    <>
                      <Flame className="w-4 h-4" />
                      Calculate Blast Radius
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Analysis Results View */}
          {analysis && (
            <div className="space-y-6">
              {/* Header Card with Risk & Summary */}
              <div className="p-6 rounded-2xl bg-[#090F20] border border-white/10 shadow-xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-sm text-white font-bold bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                        {analysis.targetFile}
                      </span>
                      {analysis.targetSymbol && (
                        <span className="font-mono text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                          symbol: {analysis.targetSymbol}()
                        </span>
                      )}
                      {getImpactBadge(analysis.impactLevel)}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Analyzed at {new Date(analysis.createdAt).toLocaleString()} against deterministic static graph & Gemini reasoning
                    </p>
                  </div>

                  <button
                    onClick={() => handleAnalyze(undefined, true)}
                    className="self-start md:self-auto px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Re-analyze
                  </button>
                </div>

                {/* Scorecards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-5">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <FileCode className="w-3.5 h-3.5 text-purple-400" /> Affected Files
                    </div>
                    <div className="text-2xl font-bold text-white mt-1.5">
                      {analysis.affectedFiles?.length || 0}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" /> Direct Callers
                    </div>
                    <div className="text-2xl font-bold text-white mt-1.5">
                      {analysis.directCallers?.length || 0}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Globe className="w-3.5 h-3.5 text-blue-400" /> API Endpoints
                    </div>
                    <div className="text-2xl font-bold text-white mt-1.5">
                      {analysis.affectedEndpoints?.length || 0}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Layout className="w-3.5 h-3.5 text-emerald-400" /> Components
                    </div>
                    <div className="text-2xl font-bold text-white mt-1.5">
                      {analysis.affectedComponents?.length || 0}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <TestTube2 className="w-3.5 h-3.5 text-amber-400" /> Test Suites
                    </div>
                    <div className="text-2xl font-bold text-white mt-1.5">
                      {analysis.affectedTests?.length || 0}
                    </div>
                  </div>
                </div>

                {/* AI Reasoning Section */}
                {analysis.reasoning && (
                  <div className="mt-5 p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 text-sm text-gray-300 leading-relaxed">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-400 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Blast Radius Assessment
                    </div>
                    {analysis.reasoning}
                  </div>
                )}
              </div>

              {/* Two Column Section: Callers & Affected Entities */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Direct Callers */}
                <div className="p-5 rounded-2xl bg-[#090F20] border border-white/10 shadow-lg space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
                    <span>Direct Callers & Call Sites ({analysis.directCallers?.length || 0})</span>
                  </h3>

                  {(!analysis.directCallers || analysis.directCallers.length === 0) ? (
                    <div className="p-6 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-gray-500">
                      No direct inward function callers found. Symbol may be an entry point or top-level exporter.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                      {analysis.directCallers.map((caller, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 space-y-1.5 font-mono text-xs transition-colors"
                        >
                          <div className="flex items-center justify-between text-gray-400">
                            <span className="text-purple-300 font-semibold">{caller.file}</span>
                            <span className="text-gray-500">Line {caller.line}</span>
                          </div>
                          <div className="text-gray-300 text-[11px] truncate">
                            Function: <span className="text-indigo-400">{caller.callerFunction}</span>
                          </div>
                          {caller.snippet && (
                            <pre className="p-2 rounded bg-black/50 text-[11px] text-gray-400 overflow-x-auto border border-white/5">
                              {caller.snippet}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dependent Files & Tests */}
                <div className="p-5 rounded-2xl bg-[#090F20] border border-white/10 shadow-lg space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2.5">
                      Dependent Source Files ({analysis.affectedFiles?.length || 0})
                    </h3>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {analysis.affectedFiles?.map((file, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 font-mono text-xs text-gray-300 flex items-center justify-between"
                        >
                          <span className="truncate">{file}</span>
                          <span className="text-[10px] text-purple-400 uppercase bg-purple-500/10 px-1.5 py-0.5 rounded">
                            Dependent
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Affected Tests */}
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2.5">
                      Affected Test Suites ({analysis.affectedTests?.length || 0})
                    </h3>
                    {analysis.affectedTests?.length > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {analysis.affectedTests.map((test, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20 font-mono text-xs text-amber-300 flex items-center justify-between"
                          >
                            <span className="truncate">{test}</span>
                            <span className="text-[10px] text-amber-400 uppercase font-semibold">
                              Must Re-Run
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-white/[0.02] text-xs text-gray-500 text-center">
                        No direct test files found referencing this symbol.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recommended Verification Checklist */}
              {analysis.recommendedChecks && analysis.recommendedChecks.length > 0 && (
                <div className="p-5 rounded-2xl bg-[#090F20] border border-white/10 shadow-lg space-y-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    Recommended Verification Checks Before Merge
                  </h3>
                  <div className="space-y-2">
                    {analysis.recommendedChecks.map((check, idx) => (
                      <div
                        key={idx}
                        onClick={() => toggleCheck(idx)}
                        className={cn(
                          'p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors text-xs',
                          checkedChecks[idx]
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-gray-400 line-through'
                            : 'bg-white/[0.02] border-white/5 text-gray-300 hover:bg-white/[0.04]'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(checkedChecks[idx])}
                          onChange={() => toggleCheck(idx)}
                          className="mt-0.5 rounded border-gray-600 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                        <span className="flex-1 leading-relaxed">{check}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Previous Analyses History */}
          {previousAnalyses.length > 0 && (
            <div className="pt-6 border-t border-white/[0.08] space-y-3">
              <h3 className="text-xs uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                Previous Impact Analyses for {selectedOwner}/{selectedRepo}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {previousAnalyses.slice(0, 6).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => setAnalysis(item)}
                    className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-purple-500/30 cursor-pointer transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-white truncate max-w-[180px]">
                        {item.targetFile}
                      </span>
                      {getImpactBadge(item.impactLevel)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{item.targetSymbol ? `symbol: ${item.targetSymbol}` : 'full file'}</span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ImpactAnalysis;
