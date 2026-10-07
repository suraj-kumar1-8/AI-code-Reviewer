import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { MermaidDiagram } from '../components/architecture/MermaidDiagram';
import { ExplainCodeModal } from '../components/codebase/ExplainCodeModal';
import { CodebaseSearchModal } from '../components/codebase/CodebaseSearchModal';
import { api } from '../services/api';
import type { ArchitectureScan, GitHubRepo } from '../types';
import {
  Network,
  RefreshCw,
  Search,
  Layers,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Cpu,
} from 'lucide-react';
import { cn } from '../utils/cn';

export const Architecture: React.FC = () => {
  const { owner: routeOwner, repo: routeRepo } = useParams<{ owner?: string; repo?: string }>();
  const navigate = useNavigate();

  // State
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>(routeOwner || 'developit');
  const [selectedRepo, setSelectedRepo] = useState<string>(routeRepo || 'mitt');
  const [scan, setScan] = useState<ArchitectureScan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [explainModalOpen, setExplainModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
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
        console.warn('[Architecture] Failed to fetch repos:', err.message);
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

  // 2. Load architecture scan
  const loadArchitecture = useCallback(async (owner: string, repo: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getArchitecture(owner, repo);
      if (res.needsScan) {
        setScan(null);
      } else {
        setScan(res);
      }
    } catch (err: any) {
      console.warn('[Architecture] Load error:', err.message);
      setError(err.message || 'Failed to load architecture scan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOwner && selectedRepo) {
      loadArchitecture(selectedOwner, selectedRepo);
    }
  }, [selectedOwner, selectedRepo, loadArchitecture]);

  // 3. Trigger architecture analysis
  const handleAnalyze = async (force: boolean = false) => {
    if (!selectedOwner || !selectedRepo) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await api.analyzeArchitecture({
        owner: selectedOwner,
        repo: selectedRepo,
        force,
      });
      setScan(res);
      localStorage.setItem('lastViewedRepoOwner', selectedOwner);
      localStorage.setItem('lastViewedRepoName', selectedRepo);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze architecture.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRepoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [o, r] = e.target.value.split('/');
    if (o && r) {
      setSelectedOwner(o);
      setSelectedRepo(r);
      navigate(`/architecture/${o}/${r}`);
    }
  };

  const openExplain = (file: string = '', snippet: string = '') => {
    setExplainFile(file);
    setExplainSnippet(snippet);
    setExplainModalOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-[#070D18] text-white">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#070D18]/90 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">Codebase Architecture</h1>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  TOPOLOGY & RISKS
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Automated architectural decomposition, data flow, component graphs, and design smells
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

            {/* Codebase Search Button */}
            <button
              onClick={() => setSearchModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              <span>Search Codebase</span>
            </button>

            {/* Explain with AI Button */}
            <button
              onClick={() => openExplain()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-xs font-medium text-indigo-300 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Explain Code</span>
            </button>

            {/* Analyze / Re-analyze Button */}
            <button
              onClick={() => handleAnalyze(true)}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', analyzing && 'animate-spin')} />
              <span>{analyzing ? 'Analyzing Architecture...' : scan ? 'Re-Analyze' : 'Analyze Architecture'}</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6 space-y-6 flex-1 max-w-7xl w-full mx-auto">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Architecture Analysis Notice</p>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-xs text-gray-400">Inspecting repository structure and architectural components...</p>
            </div>
          ) : !scan ? (
            <div className="p-12 text-center rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                <Network className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">No Architecture Analysis Found</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Run an architecture analysis scan to decompose {selectedOwner}/{selectedRepo} into components, detect tech stack, generate topology diagrams, and highlight architectural risks.
                </p>
              </div>
              <button
                onClick={() => handleAnalyze(false)}
                disabled={analyzing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Analyze Repository Architecture
              </button>
            </div>
          ) : (
            <>
              {/* Executive Architecture Summary Card */}
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-indigo-950/20 via-[#070D18] to-purple-950/20 shadow-xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                      Architecture Summary
                    </span>
                    {scan.isCached && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                        Cached Scan
                      </span>
                    )}
                  </div>
                  {scan.commitSha && (
                    <span className="text-[11px] font-mono text-gray-400">
                      Commit: <span className="text-indigo-300">{scan.commitSha.slice(0, 7)}</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-200 leading-relaxed font-sans">{scan.summary}</p>

                {/* Technology Stack Chips */}
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    Detected Technology Stack
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    {scan.techStack && scan.techStack.length > 0 ? (
                      scan.techStack.map((tech, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-mono px-3 py-1 rounded-xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1.5"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          {tech}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500 font-mono">Standard Modular JavaScript / TypeScript</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Visual Mermaid Architecture Diagram */}
              {scan.diagramMermaid && (
                <MermaidDiagram chart={scan.diagramMermaid} />
              )}

              {/* Grid: Major Components & Data Flow */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Major Components */}
                <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-sm font-bold text-white">Major Components</h3>
                    </div>
                    <span className="text-xs font-mono text-gray-400">
                      {scan.components?.length || 0} Detected
                    </span>
                  </div>

                  <div className="space-y-3">
                    {scan.components && scan.components.length > 0 ? (
                      scan.components.map((comp, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all space-y-2 group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">
                              {comp.name}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10">
                              {comp.type}
                            </span>
                          </div>

                          {comp.path && (
                            <p className="text-[11px] font-mono text-gray-400 truncate">
                              Path: {comp.path}
                            </p>
                          )}

                          <p className="text-xs text-gray-300 leading-normal">{comp.description}</p>

                          {comp.dependencies && comp.dependencies.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              <span className="text-[10px] text-gray-500 font-mono">Deps:</span>
                              {comp.dependencies.map((dep, dIdx) => (
                                <span
                                  key={dIdx}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-gray-400 border border-white/5"
                                >
                                  {dep}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-500 text-xs">
                        Components analyzed from directory hierarchy.
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Data Flow */}
                <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-bold text-white">System Data Flow</h3>
                    </div>
                    <span className="text-xs font-mono text-gray-400">
                      {scan.dataFlow?.length || 0} Stages
                    </span>
                  </div>

                  <div className="space-y-3">
                    {scan.dataFlow && scan.dataFlow.length > 0 ? (
                      scan.dataFlow.map((step, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-mono flex items-center justify-center font-bold">
                                {step.step}
                              </span>
                              <span className="text-xs font-semibold text-white">
                                {step.from} → {step.to}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                              {step.protocol}
                            </span>
                          </div>
                          <p className="text-xs text-gray-300 pl-7 leading-relaxed">{step.description}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-500 text-xs">
                        Standard request/response lifecycle.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Architectural Risks Section */}
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <h3 className="text-sm font-bold text-white">Architectural Risks & Anti-Patterns</h3>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    {scan.architecturalRisks?.length || 0} Risks Detected
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scan.architecturalRisks && scan.architecturalRisks.length > 0 ? (
                    scan.architecturalRisks.map((risk, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.02] space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{risk.title}</span>
                          </h4>
                          <span
                            className={cn(
                              'text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold',
                              risk.severity === 'HIGH'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            )}
                          >
                            {risk.severity}
                          </span>
                        </div>

                        {risk.file && (
                          <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 bg-black/40 px-2.5 py-1 rounded border border-white/5">
                            <span>{risk.file}</span>
                            <button
                              onClick={() => openExplain(risk.file, risk.evidence || '')}
                              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" />
                              Explain
                            </button>
                          </div>
                        )}

                        <p className="text-xs text-gray-300 leading-relaxed">{risk.description}</p>

                        <div className="pt-2 border-t border-white/[0.06] space-y-1">
                          <p className="text-[11px] text-gray-400">
                            <span className="text-gray-200 font-semibold">Impact:</span> {risk.impact}
                          </p>
                          <p className="text-[11px] text-indigo-300">
                            <span className="text-indigo-200 font-semibold">Recommendation:</span>{' '}
                            {risk.recommendation}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-6 text-gray-400 text-xs">
                      ✅ No severe architectural anti-patterns or route database coupling detected.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      <ExplainCodeModal
        isOpen={explainModalOpen}
        onClose={() => setExplainModalOpen(false)}
        filePath={explainFile}
        initialSnippet={explainSnippet}
        repositoryId={`${selectedOwner}/${selectedRepo}`}
      />

      <CodebaseSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        repositoryId={`${selectedOwner}/${selectedRepo}`}
        onExplainCode={(file, snippet) => openExplain(file, snippet)}
      />
    </div>
  );
};

export default Architecture;
