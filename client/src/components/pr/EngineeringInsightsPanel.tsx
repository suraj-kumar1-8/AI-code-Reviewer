import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { PrEngineeringInsights } from '../../types';
import {
  ShieldAlert,
  Flame,
  Zap,
  Database,
  TestTube2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Cpu,
} from 'lucide-react';

interface EngineeringInsightsPanelProps {
  owner: string;
  repo: string;
  prNumber: number;
}

export const EngineeringInsightsPanel: React.FC<EngineeringInsightsPanelProps> = ({
  owner,
  repo,
  prNumber,
}) => {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<PrEngineeringInsights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPrEngineeringInsights(owner, repo, prNumber);
      setInsights(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load engineering insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [owner, repo, prNumber]);

  const getRiskBadge = (risk: string) => {
    const r = (risk || 'LOW').toUpperCase();
    if (r === 'CRITICAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
          <Flame className="w-3.5 h-3.5" /> CRITICAL RISK
        </span>
      );
    }
    if (r === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
          <AlertTriangle className="w-3.5 h-3.5 text-purple-400" /> HIGH RISK
        </span>
      );
    }
    if (r === 'MEDIUM') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" /> MEDIUM RISK
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        <CheckCircle2 className="w-3.5 h-3.5" /> LOW RISK
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-5 rounded-2xl bg-[#070D1A]/80 border border-white/10 animate-pulse flex items-center justify-center gap-3 text-sm text-gray-400">
        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
        Synthesizing Engineering Intelligence across blast radius, API contracts & DB...
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs text-gray-400">
        <span>Engineering insights temporarily unavailable</span>
        <button
          onClick={fetchInsights}
          className="text-purple-400 hover:text-purple-300 underline font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0D152B] via-[#0A1024] to-[#120D26] border border-purple-500/30 p-5 shadow-xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                Unified Engineering Insights
              </h3>
              <span className="font-mono text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                PR #{prNumber}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Cross-cutting blast radius, contract guardian & migration telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getRiskBadge(insights.overallRisk)}
          <button
            onClick={fetchInsights}
            title="Refresh Insights"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 py-4 relative z-10">
        {/* Issues */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-gray-400">Issues</div>
          <div className="text-lg font-bold text-white mt-1">
            {insights.issuesCount}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Defects & findings</div>
        </div>

        {/* Change Impact */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
            <Flame className="w-3 h-3 text-rose-400" /> Blast Radius
          </div>
          <div className={`text-base font-bold mt-1 ${
            insights.changeImpact === 'CRITICAL' || insights.changeImpact === 'HIGH' ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {insights.changeImpact}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Impact level</div>
        </div>

        {/* API Contract */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" /> API Contract
          </div>
          <div className={`text-base font-bold mt-1 ${
            insights.apiContractBreakingChanges > 0 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {insights.apiContractBreakingChanges} breaking
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Endpoint changes</div>
        </div>

        {/* Database Risk */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
            <Database className="w-3 h-3 text-purple-400" /> Database
          </div>
          <div className={`text-base font-bold mt-1 ${
            insights.databaseRiskLevel === 'CRITICAL' || insights.databaseRiskLevel === 'HIGH' ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {insights.databaseRiskLevel}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Migration risk</div>
        </div>

        {/* Security */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-rose-400" /> Security
          </div>
          <div className={`text-base font-bold mt-1 ${
            insights.securityIssuesCount > 0 ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {insights.securityIssuesCount} issues
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Vulnerabilities</div>
        </div>

        {/* Suggested Tests */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
            <TestTube2 className="w-3 h-3 text-indigo-400" /> Tests & Fixes
          </div>
          <div className="text-base font-bold text-indigo-300 mt-1">
            {insights.suggestedTestsCount} tests
          </div>
          <div className="text-[10px] text-gray-500 mt-1">{insights.suggestedFixesCount} automated fixes</div>
        </div>
      </div>

      {/* Deep-Dive Links */}
      <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs relative z-10">
        <span className="text-gray-400">Launch deep intelligence workspace:</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate(`/impact/${owner}/${repo}?pr=${prNumber}`)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Flame className="w-3 h-3 text-rose-400" />
            Impact Analysis <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => navigate(`/api-guardian/${owner}/${repo}?pr=${prNumber}`)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            API Guardian <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => navigate(`/database-risk/${owner}/${repo}?pr=${prNumber}`)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Database className="w-3 h-3 text-purple-400" />
            Database Risk <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => navigate(`/test-generator/${owner}/${repo}`)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <TestTube2 className="w-3 h-3 text-indigo-400" />
            Test Generator <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EngineeringInsightsPanel;
