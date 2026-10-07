import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { api } from '../services/api';
import type { DatabaseRiskFinding, DatabaseRiskCheckResult, GitHubRepo } from '../types';
import {
  Database,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Flame,
  Layout,
  Globe,
  Menu,
  Clock,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Server,
} from 'lucide-react';

export const DatabaseRisk: React.FC = () => {
  const { owner: routeOwner, repo: routeRepo } = useParams<{ owner?: string; repo?: string }>();
  const navigate = useNavigate();

  // Navigation & Repos
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>(routeOwner || localStorage.getItem('lastViewedRepoOwner') || 'developit');
  const [selectedRepo, setSelectedRepo] = useState<string>(routeRepo || localStorage.getItem('lastViewedRepoName') || 'mitt');

  // Input states
  const [migrationFile, setMigrationFile] = useState<string>('migrations/20261007_drop_email.sql');
  const [migrationSql, setMigrationSql] = useState<string>(
    'ALTER TABLE users DROP COLUMN email;\nALTER TABLE accounts DROP COLUMN balance;'
  );

  // Results & state
  const [result, setResult] = useState<DatabaseRiskCheckResult | null>(null);
  const [history, setHistory] = useState<DatabaseRiskFinding[]>([]);
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
      const data = await api.getDatabaseRiskFindings(o, r);
      setHistory(data.findings || []);
    } catch (err: any) {
      console.warn('Failed to fetch DB risk history:', err.message);
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
      navigate(`/database-risk/${o}/${r}`);
      loadHistory(o, r);
    }
  };

  const handleAnalyzeRisk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedOwner || !selectedRepo) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api.analyzeDatabaseRisk({
        owner: selectedOwner.trim(),
        repo: selectedRepo.trim(),
        migrationFile: migrationFile.trim() || undefined,
        migrationSql: migrationSql.trim() || undefined,
      });

      if (data.success) {
        setResult(data);
        loadHistory(selectedOwner, selectedRepo);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze database migration risk.');
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (type: string) => {
    if (type === 'drop_column') {
      setMigrationFile('migrations/20261007_drop_column.sql');
      setMigrationSql('ALTER TABLE users DROP COLUMN email;\nALTER TABLE accounts DROP COLUMN balance;');
    } else if (type === 'drop_table') {
      setMigrationFile('migrations/20261007_drop_table.sql');
      setMigrationSql('DROP TABLE user_sessions;\nDROP TABLE orders CASCADE;');
    } else if (type === 'not_null') {
      setMigrationFile('migrations/20261007_add_not_null.sql');
      setMigrationSql('ALTER TABLE users ALTER COLUMN phone SET NOT NULL;');
    }
  };

  const getRiskBadge = (level: string) => {
    const l = (level || 'LOW').toUpperCase();
    if (l === 'CRITICAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
          <Flame className="w-3.5 h-3.5" /> CRITICAL DB RISK
        </span>
      );
    }
    if (l === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
          <AlertTriangle className="w-3.5 h-3.5 text-purple-400" /> HIGH RISK
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
        <CheckCircle2 className="w-3.5 h-3.5" /> LOW RISK
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
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-wide">
                  Database Migration Risk Analyzer
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  FEATURE 4
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Detect destructive DDL operations and trace active code references before migration
              </p>
            </div>
          </div>

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
          {/* Security & Non-Execution Banner */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>
              <strong>Zero-Execution Static Guarantee:</strong> Antigravity only analyzes migration DDL syntax and code references. Migrations are NEVER executed automatically and your database is never altered.
            </span>
          </div>

          {/* Migration Input Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0B132B]/80 to-[#0A1024] border border-white/[0.08] shadow-lg">
            <form onSubmit={handleAnalyzeRisk} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Migration File Path
                </label>
                <input
                  type="text"
                  value={migrationFile}
                  onChange={(e) => setMigrationFile(e.target.value)}
                  placeholder="e.g. migrations/20261007_drop_email.sql"
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Migration SQL Statements <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={migrationSql}
                  onChange={(e) => setMigrationSql(e.target.value)}
                  placeholder="ALTER TABLE users DROP COLUMN email;"
                  className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors font-mono resize-none"
                  required
                />
              </div>

              {/* Presets & Submit */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Presets:</span>
                  <button
                    type="button"
                    onClick={() => loadPreset('drop_column')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 border border-white/10 transition-colors font-mono text-[11px]"
                  >
                    DROP COLUMN
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('drop_table')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 border border-white/10 transition-colors font-mono text-[11px]"
                  >
                    DROP TABLE
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('not_null')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 border border-white/10 transition-colors font-mono text-[11px]"
                  >
                    ADD NOT NULL
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || !migrationSql.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing Migration Risk...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      Analyze Migration Risk
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
              {/* Scorecard */}
              <div className="p-6 rounded-2xl bg-[#090F20] border border-white/10 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Migration Blast Radius Report
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Scanned DDL syntax for destructive schema operations
                    </p>
                  </div>
                  <div>{getRiskBadge(result.overallRisk)}</div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-xs text-gray-400">Operations Analyzed</div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {result.totalOperationsAnalyzed}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-xs text-gray-400">Destructive DDL Statements</div>
                    <div className={`text-2xl font-bold mt-1 ${
                      result.destructiveOperationsCount > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {result.destructiveOperationsCount}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-xs text-gray-400">High / Critical Operations</div>
                    <div className="text-2xl font-bold text-purple-300 mt-1">
                      {result.highRiskCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Findings */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-purple-400" />
                  Migration Findings ({result.findings.length})
                </h3>

                {result.findings.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-2xl bg-[#090F20] border border-white/10 shadow-lg space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {f.operationType}
                        </span>
                        <span className="font-mono text-sm font-bold text-white">
                          {f.targetTable}{f.targetColumn ? `.${f.targetColumn}` : ''}
                        </span>
                      </div>

                      <div>{getRiskBadge(f.riskLevel)}</div>
                    </div>

                    {/* Raw SQL */}
                    {f.rawSql && (
                      <pre className="p-3 rounded-xl bg-black/50 border border-white/5 font-mono text-xs text-gray-300 overflow-x-auto">
                        {f.rawSql}
                      </pre>
                    )}

                    {/* Detected References */}
                    {f.detectedReferences && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                          <span className="text-[11px] font-sans font-semibold text-gray-400 flex items-center gap-1">
                            <Server className="w-3 h-3 text-indigo-400" /> Backend References ({f.detectedReferences.backend.length})
                          </span>
                          <div className="text-gray-300 truncate">
                            {f.detectedReferences.backend.length > 0
                              ? f.detectedReferences.backend.join(', ')
                              : 'None detected'}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                          <span className="text-[11px] font-sans font-semibold text-gray-400 flex items-center gap-1">
                            <Layout className="w-3 h-3 text-purple-400" /> Frontend References ({f.detectedReferences.frontend.length})
                          </span>
                          <div className="text-gray-300 truncate">
                            {f.detectedReferences.frontend.length > 0
                              ? f.detectedReferences.frontend.join(', ')
                              : 'None detected'}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                          <span className="text-[11px] font-sans font-semibold text-gray-400 flex items-center gap-1">
                            <Globe className="w-3 h-3 text-blue-400" /> API Route References ({f.detectedReferences.apis.length})
                          </span>
                          <div className="text-gray-300 truncate">
                            {f.detectedReferences.apis.length > 0
                              ? f.detectedReferences.apis.join(', ')
                              : 'None detected'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Potential Impact */}
                    <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/20 text-xs text-rose-200">
                      <strong>Potential Impact:</strong> {f.potentialImpact}
                    </div>

                    {/* Recommended Safe Action */}
                    <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-gray-300 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-purple-300">Recommended Safe Action (Expand & Contract):</strong>{' '}
                        {f.recommendedAction}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="pt-6 border-t border-white/[0.08] space-y-3">
              <h3 className="text-xs uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                Previous Database Risk Findings for {selectedOwner}/{selectedRepo}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {history.slice(0, 6).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-white">
                        {item.targetTable}{item.targetColumn ? `.${item.targetColumn}` : ''}
                      </span>
                      {getRiskBadge(item.riskLevel)}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {item.operationType}
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

export default DatabaseRisk;
