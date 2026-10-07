import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { api } from '../services/api';
import type { DebugSession, GitHubRepo } from '../types';
import {
  Bug,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  FileCode,
  Sparkles,
  Menu,
  Clock,
  ShieldCheck,
  Code2,
  Terminal,
} from 'lucide-react';

export const AiDebugger: React.FC = () => {
  const { owner: routeOwner, repo: routeRepo } = useParams<{ owner?: string; repo?: string }>();
  const navigate = useNavigate();

  // Navigation & Repos
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>(routeOwner || localStorage.getItem('lastViewedRepoOwner') || 'developit');
  const [selectedRepo, setSelectedRepo] = useState<string>(routeRepo || localStorage.getItem('lastViewedRepoName') || 'mitt');

  // Input states
  const [errorMessage, setErrorMessage] = useState<string>("TypeError: Cannot read properties of undefined (reading 'emit')");
  const [stackTrace, setStackTrace] = useState<string>(
    `TypeError: Cannot read properties of undefined (reading 'emit')\n    at Object.handler (/app/src/index.ts:32:15)\n    at runTest (/app/test/index.test.ts:45:8)`
  );
  const [failingFile, setFailingFile] = useState<string>('src/index.ts');
  const [logs, setLogs] = useState<string>('');

  // Results & state
  const [session, setSession] = useState<DebugSession | null>(null);
  const [history, setHistory] = useState<DebugSession[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedFix, setCopiedFix] = useState<boolean>(false);
  const [copiedTest, setCopiedTest] = useState<boolean>(false);

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

  const loadHistory = async (o = selectedOwner, r = selectedRepo) => {
    if (!o || !r) return;
    try {
      const data = await api.getDebugSessions(o, r);
      setHistory(data.sessions || []);
      if (!session && data.sessions && data.sessions.length > 0) {
        setSession(data.sessions[0]);
      }
    } catch (err: any) {
      console.warn('Failed to fetch debug history:', err.message);
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
      navigate(`/debugger/${o}/${r}`);
      loadHistory(o, r);
    }
  };

  const handleDebug = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedOwner || !selectedRepo || !errorMessage.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.debugError({
        owner: selectedOwner.trim(),
        repo: selectedRepo.trim(),
        errorMessage: errorMessage.trim(),
        stackTrace: stackTrace.trim() || undefined,
        failingFile: failingFile.trim() || undefined,
        logs: logs.trim() || undefined,
      });

      if (res.success) {
        const s = res.session || {
          owner: selectedOwner,
          repo: selectedRepo,
          errorMessage,
          rootCause: res.rootCause || '',
          evidence: res.evidence || [],
          affectedFiles: res.affectedFiles || [],
          recommendedFix: res.recommendedFix || '',
          confidence: res.confidence || 'MEDIUM',
          regressionTests: res.regressionTests || '',
          createdAt: new Date().toISOString(),
        };
        setSession(s);
        loadHistory(selectedOwner, selectedRepo);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to debug error.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFix = () => {
    if (!session?.recommendedFix) return;
    navigator.clipboard.writeText(session.recommendedFix);
    setCopiedFix(true);
    setTimeout(() => setCopiedFix(false), 2000);
  };

  const handleCopyTest = () => {
    if (!session?.regressionTests) return;
    navigator.clipboard.writeText(session.regressionTests);
    setCopiedTest(true);
    setTimeout(() => setCopiedTest(false), 2000);
  };

  const loadSample = (type: string) => {
    if (type === 'typeerror') {
      setErrorMessage("TypeError: Cannot read properties of undefined (reading 'emit')");
      setStackTrace("TypeError: Cannot read properties of undefined (reading 'emit')\n    at Object.handler (/app/src/index.ts:32:15)\n    at runTest (/app/test/index.test.ts:45:8)");
      setFailingFile('src/index.ts');
    } else if (type === 'undefined_user') {
      setErrorMessage("TypeError: Cannot read properties of undefined (reading 'name')");
      setStackTrace("TypeError: Cannot read properties of undefined (reading 'name')\n    at UserProfile (src/components/UserProfile.tsx:24:18)\n    at renderWithHooks (react-dom.development.js:15486)");
      setFailingFile('src/components/UserProfile.tsx');
    }
  };

  const getConfidenceBadge = (confidence?: string) => {
    const c = (confidence || 'MEDIUM').toUpperCase();
    if (c === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" /> HIGH CONFIDENCE
        </span>
      );
    }
    if (c === 'LOW') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
          <AlertTriangle className="w-3.5 h-3.5" /> LOW CONFIDENCE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
        <AlertTriangle className="w-3.5 h-3.5" /> MEDIUM CONFIDENCE
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
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-wide">
                  AI Root Cause Debugger
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  FEATURE 2
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Grounded pgvector semantic retrieval & static caller tracing for runtime errors
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={`${selectedOwner}/${selectedRepo}`}
              onChange={handleRepoChange}
              className="px-3 py-1.5 bg-[#0B132B] border border-white/10 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-rose-500 transition-colors"
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
          {/* Debug Input Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0B132B]/80 to-[#0A1024] border border-white/[0.08] shadow-lg">
            <form onSubmit={handleDebug} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Error Message <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={errorMessage}
                  onChange={(e) => setErrorMessage(e.target.value)}
                  placeholder="e.g. TypeError: Cannot read properties of undefined (reading 'emit')"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 transition-colors font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Stack Trace (Optional)
                  </label>
                  <textarea
                    rows={4}
                    value={stackTrace}
                    onChange={(e) => setStackTrace(e.target.value)}
                    placeholder="Paste stack trace lines here..."
                    className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-rose-500 transition-colors font-mono resize-none"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                      Failing File / Component (Optional)
                    </label>
                    <input
                      type="text"
                      value={failingFile}
                      onChange={(e) => setFailingFile(e.target.value)}
                      placeholder="e.g. src/index.ts or UserProfile.tsx"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                      Runtime Logs (Optional)
                    </label>
                    <input
                      type="text"
                      value={logs}
                      onChange={(e) => setLogs(e.target.value)}
                      placeholder="e.g. [API] GET /api/user 404 Not Found"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Presets & Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Presets:</span>
                  <button
                    type="button"
                    onClick={() => loadSample('typeerror')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-rose-300 border border-white/10 transition-colors font-mono text-[11px]"
                  >
                    TypeError: emit
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample('undefined_user')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-rose-300 border border-white/10 transition-colors font-mono text-[11px]"
                  >
                    UserProfile: undefined
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || !errorMessage.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white shadow-lg shadow-rose-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing Repository Root Cause...
                    </>
                  ) : (
                    <>
                      <Bug className="w-4 h-4" />
                      Diagnose Root Cause
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Results View */}
          {session && (
            <div className="space-y-6">
              {/* Root Cause Assessment Card */}
              <div className="p-6 rounded-2xl bg-[#090F20] border border-white/10 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                      Error Classification
                    </span>
                    <h2 className="text-base font-bold text-white font-mono mt-0.5">
                      {session.errorMessage}
                    </h2>
                  </div>
                  <div>{getConfidenceBadge(session.confidence)}</div>
                </div>

                {/* Root Cause Explanation */}
                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 text-sm text-gray-200 leading-relaxed">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-400 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Root Cause Diagnosis
                  </div>
                  {session.rootCause}
                </div>

                {/* Affected Files */}
                {session.affectedFiles && session.affectedFiles.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                      Affected Repository Files ({session.affectedFiles.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {session.affectedFiles.map((f, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-purple-300 flex items-center gap-1.5"
                        >
                          <FileCode className="w-3 h-3 text-gray-400" />
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Grounded Repository Evidence (pgvector) */}
              {session.evidence && session.evidence.length > 0 && (
                <div className="p-6 rounded-2xl bg-[#090F20] border border-white/10 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Repository Evidence & Semantic Context
                  </h3>
                  <div className="space-y-3">
                    {session.evidence.map((ev, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-black/40 border border-white/5 font-mono text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-gray-400">
                          <span className="text-purple-300 font-semibold">{ev.file}</span>
                          <span className="text-gray-500">Lines {ev.lines}</span>
                        </div>
                        <pre className="p-2 rounded bg-black/60 text-gray-300 overflow-x-auto text-[11px] border border-white/5">
                          {ev.snippet}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Fix */}
              {session.recommendedFix && (
                <div className="p-6 rounded-2xl bg-[#090F20] border border-white/10 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-indigo-400" />
                      Recommended Code Fix
                    </h3>
                    <button
                      onClick={handleCopyFix}
                      className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedFix ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedFix ? 'Copied' : 'Copy Fix'}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-black/60 border border-white/10 text-xs text-emerald-300 font-mono overflow-x-auto">
                    {session.recommendedFix}
                  </pre>
                </div>
              )}

              {/* Suggested Regression Tests */}
              {session.regressionTests && (
                <div className="p-6 rounded-2xl bg-[#090F20] border border-white/10 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-amber-400" />
                      Suggested Regression Test
                    </h3>
                    <button
                      onClick={handleCopyTest}
                      className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedTest ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedTest ? 'Copied' : 'Copy Test'}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-black/60 border border-white/10 text-xs text-amber-300 font-mono overflow-x-auto">
                    {session.regressionTests}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Recent Debug Sessions History */}
          {history.length > 0 && (
            <div className="pt-6 border-t border-white/[0.08] space-y-3">
              <h3 className="text-xs uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                Previous Debug Sessions for {selectedOwner}/{selectedRepo}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {history.slice(0, 6).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => setSession(item)}
                    className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-rose-500/30 cursor-pointer transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-white truncate max-w-[180px]">
                        {item.errorMessage}
                      </span>
                      {getConfidenceBadge(item.confidence)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{item.failingFile || 'repo'}</span>
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

export default AiDebugger;
