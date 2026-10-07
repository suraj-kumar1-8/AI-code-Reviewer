import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { api } from '../services/api';
import type { ApiContractFinding, ApiContractCheckResult, GitHubRepo } from '../types';
import {
  Zap,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Globe,
  Layout,
  Menu,
  Clock,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

export const ApiGuardian: React.FC = () => {
  const { owner: routeOwner, repo: routeRepo } = useParams<{ owner?: string; repo?: string }>();
  const navigate = useNavigate();

  // Navigation & Repos
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>(routeOwner || localStorage.getItem('lastViewedRepoOwner') || 'developit');
  const [selectedRepo, setSelectedRepo] = useState<string>(routeRepo || localStorage.getItem('lastViewedRepoName') || 'mitt');

  // Input states
  const [prNumber, setPrNumber] = useState<string>('216');
  const [baseCommit, setBaseCommit] = useState<string>('main');
  const [headCommit, setHeadCommit] = useState<string>('feature/api-v2');

  // Results & state
  const [result, setResult] = useState<ApiContractCheckResult | null>(null);
  const [history, setHistory] = useState<ApiContractFinding[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
      const data = await api.getApiContractFindings(o, r);
      setHistory(data.findings || []);
    } catch (err: any) {
      console.warn('Failed to fetch API contract history:', err.message);
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
      navigate(`/api-guardian/${o}/${r}`);
      loadHistory(o, r);
    }
  };

  const handleCheckContracts = async (e?: React.FormEvent, customFiles?: any[]) => {
    if (e) e.preventDefault();
    if (!selectedOwner || !selectedRepo) return;

    setLoading(true);
    setError(null);

    const filesToSend = customFiles || [
      {
        filename: 'src/routes/userRoutes.js',
        status: 'modified',
        patch: `@@ -10,3 +10,3 @@\n- router.get('/api/users', (req, res) => res.json({ name: user.name }));\n+ router.get('/api/users', (req, res) => res.json({ username: user.name }));`,
      },
      {
        filename: 'src/components/UserProfile.tsx',
        status: 'modified',
        patch: `const res = await fetch('/api/users');\nconst data = await res.json();\nconsole.log(data.name);`,
      },
    ];

    try {
      const data = await api.checkApiContracts({
        owner: selectedOwner.trim(),
        repo: selectedRepo.trim(),
        prNumber: prNumber ? parseInt(prNumber, 10) : undefined,
        baseCommit: baseCommit.trim() || undefined,
        headCommit: headCommit.trim() || undefined,
        files: filesToSend,
      });

      if (data.success) {
        setResult(data);
        loadHistory(selectedOwner, selectedRepo);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check API contracts.');
    } finally {
      setLoading(false);
    }
  };

  const loadSamplePreset = (type: string) => {
    if (type === 'field_renamed') {
      handleCheckContracts(undefined, [
        {
          filename: 'src/routes/userRoutes.js',
          status: 'modified',
          patch: `@@ -10,3 +10,3 @@\n- router.get('/api/users', (req, res) => res.json({ name: user.name }));\n+ router.get('/api/users', (req, res) => res.json({ username: user.name }));`,
        },
        {
          filename: 'src/components/UserProfile.tsx',
          status: 'modified',
          patch: `const res = await fetch('/api/users');\nconst data = await res.json();\nconsole.log(data.name);`,
        },
      ]);
    } else if (type === 'auth_guard') {
      handleCheckContracts(undefined, [
        {
          filename: 'src/routes/productRoutes.js',
          status: 'modified',
          patch: `@@ -5,3 +5,3 @@\n- router.get('/api/products', getProducts);\n+ router.get('/api/products', authMiddleware, getProducts);`,
        },
        {
          filename: 'src/pages/Catalog.tsx',
          status: 'modified',
          patch: `fetch('/api/products')`,
        },
      ]);
    }
  };

  const getRiskBadge = (level: string) => {
    const l = (level || 'LOW').toUpperCase();
    if (l === 'CRITICAL' || l === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> HIGH CONTRACT RISK
        </span>
      );
    }
    if (l === 'MEDIUM') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" /> MEDIUM RISK
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        <CheckCircle2 className="w-3.5 h-3.5" /> SAFE CONTRACT
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
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-wide">
                  API Contract Guardian
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  FEATURE 3
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Detect breaking API modifications & identify impacted frontend/backend consumers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={`${selectedOwner}/${selectedRepo}`}
              onChange={handleRepoChange}
              className="px-3 py-1.5 bg-[#0B132B] border border-white/10 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-amber-500 transition-colors"
            >
              {repos.length > 0 ? (
                repos.map((r) => (
                  <option key={r.id} value={`${r.owner}/${r.name}`}>
                    {r.owner}/{r.name}
                  </option>
                ))
              ) : (
                <option value={`${selectedOwner}/${selectedRepo}`}>
                  {selectedOwner}/${selectedRepo}
                </option>
              )}
            </select>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Controls Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0B132B]/80 to-[#0A1024] border border-white/[0.08] shadow-lg">
            <form onSubmit={(e) => handleCheckContracts(e)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    PR Number (Optional)
                  </label>
                  <input
                    type="number"
                    value={prNumber}
                    onChange={(e) => setPrNumber(e.target.value)}
                    placeholder="e.g. 216"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Base Branch / Commit
                  </label>
                  <input
                    type="text"
                    value={baseCommit}
                    onChange={(e) => setBaseCommit(e.target.value)}
                    placeholder="main"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Head Branch / Commit
                  </label>
                  <input
                    type="text"
                    value={headCommit}
                    onChange={(e) => setHeadCommit(e.target.value)}
                    placeholder="feature/branch"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Presets & Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Presets:</span>
                  <button
                    type="button"
                    onClick={() => loadSamplePreset('field_renamed')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10 transition-colors font-mono text-[11px]"
                  >
                    Renamed Field: /api/users
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSamplePreset('auth_guard')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10 transition-colors font-mono text-[11px]"
                  >
                    Auth Guard Added: /api/products
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-600 to-purple-600 hover:from-amber-500 hover:to-purple-500 text-white shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing API Contracts...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Guard API Contracts
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

          {/* Results View */}
          {result && (
            <div className="space-y-6">
              {/* Summary Scorecard Card */}
              <div className="p-6 rounded-2xl bg-[#090F20] border border-white/10 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      API Contract Audit Report
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Analyzed route definitions, controllers, and frontend call sites
                    </p>
                  </div>
                  <div>{getRiskBadge(result.overallRisk)}</div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-xs text-gray-400">Total Endpoints Analyzed</div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {result.totalEndpointsAnalyzed}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-xs text-gray-400">Breaking Changes Detected</div>
                    <div className={`text-2xl font-bold mt-1 ${
                      result.breakingChangesCount > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {result.breakingChangesCount}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-xs text-gray-400">Overall Contract Risk</div>
                    <div className="text-2xl font-bold text-amber-300 mt-1">
                      {result.overallRisk}
                    </div>
                  </div>
                </div>
              </div>

              {/* Findings List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-400" />
                  Contract Findings ({result.findings.length})
                </h3>

                {result.findings.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-2">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
                    <h4 className="text-sm font-semibold text-white">
                      No Breaking API Contract Changes Detected
                    </h4>
                    <p className="text-xs text-gray-400 max-w-md mx-auto">
                      All endpoints preserve backward compatibility with existing frontend consumers.
                    </p>
                  </div>
                ) : (
                  result.findings.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-6 rounded-2xl bg-[#090F20] border border-white/10 shadow-lg space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {f.method}
                          </span>
                          <span className="font-mono text-sm font-bold text-white">
                            {f.endpoint}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {f.isBreaking && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              BREAKING
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                            {f.changeType}
                          </span>
                        </div>
                      </div>

                      {/* Side by side contract */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                          <span className="text-[11px] text-gray-500 uppercase font-sans font-bold">
                            Previous Contract
                          </span>
                          <pre className="text-gray-300 overflow-x-auto">
                            {JSON.stringify(f.previousContract || { note: 'Existing endpoint structure' }, null, 2)}
                          </pre>
                        </div>

                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                          <span className="text-[11px] text-gray-500 uppercase font-sans font-bold">
                            Current Contract
                          </span>
                          <pre className="text-rose-300 overflow-x-auto">
                            {JSON.stringify(f.currentContract || { note: 'Updated or removed schema' }, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {/* Consumers identified */}
                      {f.potentialConsumers && f.potentialConsumers.length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                            <Layout className="w-3.5 h-3.5 text-purple-400" />
                            Impacted Frontend / Backend Consumers ({f.potentialConsumers.length})
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {f.potentialConsumers.map((c, cIdx) => (
                              <span
                                key={cIdx}
                                className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-purple-300"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommendation */}
                      {f.recommendation && (
                        <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-gray-300 flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                          <span>{f.recommendation}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="pt-6 border-t border-white/[0.08] space-y-3">
              <h3 className="text-xs uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Previous Contract Findings for {selectedOwner}/{selectedRepo}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {history.slice(0, 6).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-white">
                        [{item.method}] {item.endpoint}
                      </span>
                      {item.isBreaking && (
                        <span className="text-[10px] text-rose-400 font-bold">BREAKING</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {item.changeType}
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

export default ApiGuardian;
