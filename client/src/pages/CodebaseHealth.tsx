import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { api } from '../services/api';
import type { CodebaseHealthScores, ScoreExplanations, HealthTrends, GitHubRepo } from '../types';
import {
  Activity,
  Shield,
  Wrench,
  Zap,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../utils/cn';

export const CodebaseHealth: React.FC = () => {
  const { owner: routeOwner, repo: routeRepo } = useParams<{ owner?: string; repo?: string }>();
  const navigate = useNavigate();

  // State
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>(routeOwner || 'developit');
  const [selectedRepo, setSelectedRepo] = useState<string>(routeRepo || 'mitt');
  const [scores, setScores] = useState<CodebaseHealthScores | null>(null);
  const [scoreExplanations, setScoreExplanations] = useState<ScoreExplanations | null>(null);
  const [trends, setTrends] = useState<HealthTrends | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
        console.warn('[CodebaseHealth] Failed to fetch repos:', err.message);
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

  // 2. Load health scores
  const loadHealthScores = useCallback(async (owner: string, repo: string, force: boolean = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await api.getCodebaseHealth(owner, repo, force);
      setScores(res.scores);
      setScoreExplanations(res.scoreExplanations);
      setTrends(res.trends);
    } catch (err: any) {
      console.warn('[CodebaseHealth] Error loading scores:', err.message);
      setError(err.message || 'Failed to compute codebase health scores.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOwner && selectedRepo) {
      loadHealthScores(selectedOwner, selectedRepo, false);
    }
  }, [selectedOwner, selectedRepo, loadHealthScores]);

  const handleRepoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [o, r] = e.target.value.split('/');
    if (o && r) {
      setSelectedOwner(o);
      setSelectedRepo(r);
      navigate(`/health/${o}/${r}`);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 75) return 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10';
    if (score >= 60) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getGaugeStrokeColor = (score: number) => {
    if (score >= 90) return '#34D399'; // emerald-400
    if (score >= 75) return '#818CF8'; // indigo-400
    if (score >= 60) return '#FBBF24'; // amber-400
    return '#F87171'; // rose-400
  };

  return (
    <div className="flex min-h-screen bg-[#070D18] text-white">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#070D18]/90 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-indigo-500/20 border border-emerald-500/30 text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">Codebase Health</h1>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  DETERMINISTIC METRICS
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Ground-truth multi-dimensional code health derived from static audits, complexity, and security scans
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Repository Selector */}
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

            {/* Recalculate Button */}
            <button
              onClick={() => loadHealthScores(selectedOwner, selectedRepo, true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              <span>{refreshing ? 'Recalculating Health...' : 'Recalculate Health'}</span>
            </button>
          </div>
        </header>

        {/* Body Content */}
        <div className="p-6 space-y-6 flex-1 max-w-7xl w-full mx-auto">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Health Score Calculation Error</p>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-xs text-gray-400">Computing deterministic code health across 6 dimensions...</p>
            </div>
          ) : !scores ? (
            <div className="p-12 text-center rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              <p className="text-sm text-gray-400">No health scores available yet. Click Recalculate Health above.</p>
            </div>
          ) : (
            <>
              {/* Hero Overall Health Score Card */}
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#070D18] via-[#0B1528] to-[#070D18] shadow-2xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                  <div className="space-y-3 flex-1 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      Composite Code Health Rating
                    </div>

                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      {selectedOwner}/{selectedRepo}
                    </h2>

                    <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">
                      {scoreExplanations?.overallHealth}
                    </p>

                    <div className="flex items-center gap-4 pt-1 justify-center md:justify-start flex-wrap">
                      <div className="text-xs text-gray-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Security: {scores.security}/100
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                        Maintainability: {scores.maintainability}/100
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-400" />
                        Complexity: {scores.complexity}/100
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        Reliability: {scores.reliability}/100
                      </div>
                    </div>
                  </div>

                  {/* Circular Radial Gauge */}
                  <div className="relative flex items-center justify-center shrink-0">
                    <svg className="w-36 h-36 transform -rotate-90">
                      <circle
                        cx="72"
                        cy="72"
                        r="60"
                        stroke="rgba(255, 255, 255, 0.08)"
                        strokeWidth="10"
                        fill="transparent"
                      />
                      <circle
                        cx="72"
                        cy="72"
                        r="60"
                        stroke={getGaugeStrokeColor(scores.overallHealth)}
                        strokeWidth="10"
                        strokeDasharray={2 * Math.PI * 60}
                        strokeDashoffset={2 * Math.PI * 60 * (1 - scores.overallHealth / 100)}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-extrabold text-white font-mono">
                        {scores.overallHealth}
                      </span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                        / 100
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6 Dimensional Health Score Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Security */}
                <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        Security
                      </span>
                    </div>
                    <span className={cn('text-sm font-bold font-mono px-2.5 py-1 rounded-xl border', getScoreColor(scores.security))}>
                      {scores.security}/100
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed min-h-[48px]">
                    {scoreExplanations?.security}
                  </p>
                </div>

                {/* 2. Maintainability */}
                <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        Maintainability
                      </span>
                    </div>
                    <span className={cn('text-sm font-bold font-mono px-2.5 py-1 rounded-xl border', getScoreColor(scores.maintainability))}>
                      {scores.maintainability}/100
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed min-h-[48px]">
                    {scoreExplanations?.maintainability}
                  </p>
                </div>

                {/* 3. Complexity */}
                <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Layers className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        Complexity
                      </span>
                    </div>
                    <span className={cn('text-sm font-bold font-mono px-2.5 py-1 rounded-xl border', getScoreColor(scores.complexity))}>
                      {scores.complexity}/100
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed min-h-[48px]">
                    {scoreExplanations?.complexity}
                  </p>
                </div>

                {/* 4. Reliability */}
                <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        Reliability
                      </span>
                    </div>
                    <span className={cn('text-sm font-bold font-mono px-2.5 py-1 rounded-xl border', getScoreColor(scores.reliability))}>
                      {scores.reliability}/100
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed min-h-[48px]">
                    {scoreExplanations?.reliability}
                  </p>
                </div>

                {/* 5. Performance */}
                <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Zap className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        Performance
                      </span>
                    </div>
                    <span className={cn('text-sm font-bold font-mono px-2.5 py-1 rounded-xl border', getScoreColor(scores.performance))}>
                      {scores.performance}/100
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed min-h-[48px]">
                    {scoreExplanations?.performance}
                  </p>
                </div>

                {/* 6. Code Quality */}
                <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        Code Quality
                      </span>
                    </div>
                    <span className={cn('text-sm font-bold font-mono px-2.5 py-1 rounded-xl border', getScoreColor(scores.codeQuality))}>
                      {scores.codeQuality}/100
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed min-h-[48px]">
                    {scoreExplanations?.codeQuality}
                  </p>
                </div>
              </div>

              {/* Real Historical Health Trends Section */}
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#070D18] shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Historical Progression Trends</h3>
                  </div>
                  {trends?.hasTrends && (
                    <span className="text-xs font-mono text-gray-400">
                      {trends.totalHistoricalScans} Recorded Scans
                    </span>
                  )}
                </div>

                {trends?.hasTrends && trends.formattedTrends ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {/* Trend 1: Code Health */}
                    <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        Code Health Progression
                      </span>
                      <p className="text-base font-bold font-mono text-emerald-400">
                        {trends.formattedTrends.overallHealth}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Net Change: <span className="text-white font-mono">{trends.delta?.overall ?? 0 >= 0 ? `+${trends.delta?.overall}` : trends.delta?.overall}</span> pts
                      </p>
                    </div>

                    {/* Trend 2: Security */}
                    <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        Security Progression
                      </span>
                      <p className="text-base font-bold font-mono text-rose-400">
                        {trends.formattedTrends.security}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Net Change: <span className="text-white font-mono">{trends.delta?.security ?? 0 >= 0 ? `+${trends.delta?.security}` : trends.delta?.security}</span> pts
                      </p>
                    </div>

                    {/* Trend 3: Maintainability */}
                    <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        Maintainability Progression
                      </span>
                      <p className="text-base font-bold font-mono text-indigo-400">
                        {trends.formattedTrends.maintainability}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Net Change: <span className="text-white font-mono">{trends.delta?.maintainability ?? 0 >= 0 ? `+${trends.delta?.maintainability}` : trends.delta?.maintainability}</span> pts
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 rounded-xl border border-white/[0.06] bg-white/[0.01] text-center space-y-2">
                    <p className="text-xs text-gray-400 font-mono">
                      {trends?.message || 'Not enough historical data for trends.'}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Historical progression lines appear automatically once two or more scans are executed.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default CodebaseHealth;
