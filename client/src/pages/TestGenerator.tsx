import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { api } from '../services/api';
import type { GeneratedTestResult, GitHubRepo } from '../types';
import {
  TestTube2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Menu,
  ShieldCheck,
  FileCode,
  Info,
} from 'lucide-react';

export const TestGenerator: React.FC = () => {
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
  const [testType, setTestType] = useState<'unit' | 'edge_cases' | 'security' | 'regression'>('regression');
  const [findingContext, setFindingContext] = useState<string>('');
  const [codeSnippet, setCodeSnippet] = useState<string>(`export default function mitt(all) {
  all = all || new Map();
  return {
    all,
    on(type, handler) {
      let handlers = all.get(type);
      if (handlers) {
        handlers.push(handler);
      } else {
        all.set(type, [handler]);
      }
    },
    emit(type, evt) {
      let handlers = all.get(type);
      if (handlers) {
        handlers.slice().map((handler) => { handler(evt); });
      }
    }
  };
}`);

  // Results & state
  const [result, setResult] = useState<GeneratedTestResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

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

  const handleRepoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const [o, r] = val.split('/');
    if (o && r) {
      setSelectedOwner(o);
      setSelectedRepo(r);
      localStorage.setItem('lastViewedRepoOwner', o);
      localStorage.setItem('lastViewedRepoName', r);
      navigate(`/test-generator/${o}/${r}`);
    }
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedOwner || !selectedRepo) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api.generateTests({
        owner: selectedOwner.trim(),
        repo: selectedRepo.trim(),
        targetFile: targetFile.trim() || undefined,
        targetSymbol: targetSymbol.trim() || undefined,
        codeSnippet: codeSnippet.trim() || undefined,
        findingContext: findingContext.trim() || undefined,
        testType,
      });

      if (data.success) {
        const testRes = data.test || {
          repositoryId: `${selectedOwner}/${selectedRepo}`,
          targetFile,
          targetSymbol,
          framework: data.framework || 'Vitest',
          testType,
          testCode: data.testCode || '',
          explanation: data.explanation || '',
          testCases: data.testCases || [],
          createdAt: new Date().toISOString(),
        };
        setResult(testRes);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate tests.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTest = () => {
    if (!result?.testCode) return;
    navigator.clipboard.writeText(result.testCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadPreset = (preset: string) => {
    if (preset === 'mitt') {
      setTargetFile('src/index.ts');
      setTargetSymbol('mitt');
      setTestType('regression');
      setFindingContext('');
      setCodeSnippet(`export default function mitt(all) {
  all = all || new Map();
  return {
    all,
    on(type, handler) {
      let handlers = all.get(type);
      if (handlers) {
        handlers.push(handler);
      } else {
        all.set(type, [handler]);
      }
    },
    emit(type, evt) {
      let handlers = all.get(type);
      if (handlers) {
        handlers.slice().map((handler) => { handler(evt); });
      }
    }
  };
}`);
    } else if (preset === 'sqli') {
      setTargetFile('src/services/userService.js');
      setTargetSymbol('findUserByEmail');
      setTestType('security');
      setFindingContext('SQL Injection vulnerability: Raw query concatenation allows authentication bypass.');
      setCodeSnippet(`async function findUserByEmail(email) {
  const query = "SELECT * FROM users WHERE email = '" + email + "'";
  return await db.query(query);
}`);
    } else if (preset === 'token') {
      setTargetFile('src/middleware/authMiddleware.js');
      setTargetSymbol('verifyToken');
      setTestType('edge_cases');
      setFindingContext('Malformed Authorization header causes unhandled TypeError: split on undefined.');
      setCodeSnippet(`function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;
  next();
}`);
    }
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
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <TestTube2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-wide">
                  AI Test & Regression Test Generator
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  FEATURE 5
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Auto-detects framework (Vitest, Jest, Mocha, PyTest, JUnit) & generates unit, edge-case, and security tests
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={`${selectedOwner}/${selectedRepo}`}
              onChange={handleRepoChange}
              className="px-3 py-1.5 bg-[#0B132B] border border-white/10 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-indigo-500 transition-colors"
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
          {/* Generator Input Form */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0B132B]/80 to-[#0A1024] border border-white/[0.08] shadow-lg">
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Target File Path
                  </label>
                  <input
                    type="text"
                    value={targetFile}
                    onChange={(e) => setTargetFile(e.target.value)}
                    placeholder="src/index.ts"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Target Function / Symbol
                  </label>
                  <input
                    type="text"
                    value={targetSymbol}
                    onChange={(e) => setTargetSymbol(e.target.value)}
                    placeholder="mitt"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Test Category Focus
                  </label>
                  <select
                    value={testType}
                    onChange={(e) => setTestType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="regression">Regression Suite</option>
                    <option value="security">Security & Injection Boundaries</option>
                    <option value="edge_cases">Edge Cases & Null Boundaries</option>
                    <option value="unit">Standard Unit Test (Happy Path)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Code Snippet to Test
                </label>
                <textarea
                  rows={6}
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  placeholder="Paste function code here..."
                  className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Finding Context / Bug Description (Optional)
                </label>
                <input
                  type="text"
                  value={findingContext}
                  onChange={(e) => setFindingContext(e.target.value)}
                  placeholder="e.g. SQL Injection vulnerability or null pointer dereference on empty input"
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Presets & Submit */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Presets:</span>
                  <button
                    type="button"
                    onClick={() => loadPreset('mitt')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-indigo-300 border border-white/10 transition-colors font-mono text-[11px]"
                  >
                    Event Emitter (mitt)
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('sqli')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-indigo-300 border border-white/10 transition-colors font-mono text-[11px]"
                  >
                    SQL Injection Bug
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('token')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-indigo-300 border border-white/10 transition-colors font-mono text-[11px]"
                  >
                    Token Verification
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Synthesizing Test Suite...
                    </>
                  ) : (
                    <>
                      <TestTube2 className="w-4 h-4" />
                      Generate Test Suite
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

          {/* Generated Test Viewer */}
          {result && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-[#090F20] border border-white/10 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {result.framework} Test Suite
                      </span>
                      {result.targetSymbol && (
                        <span className="font-mono text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                          {result.targetSymbol}()
                        </span>
                      )}
                      <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-white/5 text-gray-300">
                        {result.testType}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Auto-detected project testing framework from repository manifests
                    </p>
                  </div>

                  {/* 3 Explicit Action Buttons: Copy, Regenerate, Explain */}
                  <div className="flex items-center gap-2 self-start md:self-auto">
                    <button
                      onClick={handleCopyTest}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy Test'}
                    </button>

                    <button
                      onClick={() => handleGenerate()}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      Regenerate
                    </button>

                    <button
                      onClick={() => setShowExplanation(!showExplanation)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 text-xs border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5" />
                      {showExplanation ? 'Hide Explanation' : 'Explain Test'}
                    </button>
                  </div>
                </div>

                {/* Explanation Card (Toggled) */}
                {showExplanation && (
                  <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-gray-300 leading-relaxed space-y-2">
                    <div className="font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" /> Test Methodology & Assertions
                    </div>
                    <p>{result.explanation}</p>
                    {result.testCases && result.testCases.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                        {result.testCases.map((tc, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-[11px]">
                            <strong className="text-white">{tc.name}</strong> ({tc.type}): {tc.description}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Read-Only Code Viewer */}
                <div className="rounded-xl border border-white/10 overflow-hidden bg-black/60 shadow-inner">
                  <div className="px-4 py-2 bg-white/5 border-b border-white/5 flex items-center justify-between text-xs text-gray-400">
                    <span className="font-mono flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                      {result.targetFile ? `${result.targetFile}.test.ts` : 'generated.test.ts'}
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                      Read-Only Editor (Suggestion)
                    </span>
                  </div>
                  <pre className="p-4 text-xs font-mono text-indigo-200 overflow-x-auto leading-relaxed">
                    {result.testCode}
                  </pre>
                </div>
              </div>

              {/* Safety Disclaimer */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-gray-400 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>
                  Generated tests are treated strictly as suggestions. Antigravity does not automatically execute test runners or alter repository files. Developers should review and save test suites manually.
                </span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default TestGenerator;
