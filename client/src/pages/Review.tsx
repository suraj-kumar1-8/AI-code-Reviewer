import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SAMPLE_ISSUES, SAMPLE_REPOSITORIES } from '../constants';
import type { CodeIssue, GitHubRepo } from '../types';
import { api } from '../services/api';
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  FolderGit2,
  FileCode,
  CheckCircle,
  X,
  Code2
} from 'lucide-react';

export const Review: React.FC = () => {
  const { id, owner: ownerParam, repo: repoParam } = useParams<{ id?: string; owner?: string; repo?: string }>();
  const [realRepo, setRealRepo] = useState<GitHubRepo | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [inspectIssue, setInspectIssue] = useState<CodeIssue | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Load real repo details if available
  React.useEffect(() => {
    let isMounted = true;
    const fetchRepo = async () => {
      try {
        if (ownerParam && repoParam) {
          const res = await api.getRepo(ownerParam, repoParam);
          if (isMounted && res.success && res.repository) {
            setRealRepo(res.repository);
            return;
          }
        }
        if (id) {
          const res = await api.getRepos();
          if (isMounted && res.success && res.repositories) {
            const found = res.repositories.find(
              (r) => String(r.id) === id || r.name.toLowerCase() === id.toLowerCase()
            );
            if (found) {
              setRealRepo(found);
            }
          }
        }
      } catch (err) {
        console.warn('[Review] Could not fetch real repo details:', err);
      }
    };
    fetchRepo();
    return () => {
      isMounted = false;
    };
  }, [id, ownerParam, repoParam]);

  // Find repository or fallback to sample
  const sampleFallback =
    SAMPLE_REPOSITORIES.find((r) => r.id.toLowerCase() === id?.toLowerCase()) ||
    SAMPLE_REPOSITORIES[0];

  const repoDisplay = {
    name: realRepo?.name || sampleFallback.name,
    owner: realRepo?.owner || sampleFallback.owner,
    branch: realRepo?.default_branch || 'main',
    url: realRepo?.html_url || `https://github.com/${sampleFallback.owner}/${sampleFallback.name.toLowerCase()}`,
  };

  const handleReanalyze = () => {
    setIsReanalyzing(true);
    setTimeout(() => {
      setIsReanalyzing(false);
    }, 1500);
  };

  const filteredIssues = SAMPLE_ISSUES.filter((issue) => {
    if (activeCategory !== 'all' && issue.category !== activeCategory) {
      return false;
    }
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) {
      return false;
    }
    return true;
  });

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="min-h-screen bg-[#080F1A] text-white flex">
      <Sidebar className="hidden md:flex" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="border-b border-white/8 px-6 sm:px-8 py-5 bg-[#080F1A]/80 backdrop-blur-md sticky top-0 z-20">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Repositories</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  {repoDisplay.name}
                  <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Active
                  </span>
                </h1>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {repoDisplay.owner}/{repoDisplay.name.toLowerCase()} • Branch: {repoDisplay.branch}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={repoDisplay.url}
                target="_blank"
                rel="noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  View on GitHub
                </Button>
              </a>

              <Button
                variant="primary"
                size="sm"
                onClick={handleReanalyze}
                disabled={isReanalyzing}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isReanalyzing ? 'animate-spin' : ''}`} />}
              >
                {isReanalyzing ? 'Analyzing...' : 'Re-analyze'}
              </Button>
            </div>
          </div>

          {/* Navigation Category Tabs */}
          <div className="flex items-center gap-2 mt-6 overflow-x-auto scrollbar-none pt-2 border-t border-white/5">
            {[
              { id: 'all', label: 'Overview', count: null },
              { id: 'security', label: 'Security', count: 3 },
              { id: 'bugs', label: 'Bugs', count: 2 },
              { id: 'performance', label: 'Performance', count: 2 },
              { id: 'quality', label: 'Code Quality', count: 3 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  activeCategory === tab.id
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 text-gray-300">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        {/* Review Page Main Body */}
        <main className="p-6 sm:p-8 space-y-8 flex-1 overflow-y-auto">
          {/* Health Score Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Overall Score Card */}
            <Card className="lg:col-span-4 p-6 flex flex-col justify-center items-center text-center border-white/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                Overall Score
              </span>

              <div className="relative w-32 h-32 flex items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500/20 via-indigo-500/20 to-cyan-500/20 border-4 border-emerald-400/40 shadow-inner my-2">
                <div className="text-center">
                  <div className="text-4xl font-extrabold text-white">82</div>
                  <div className="text-xs text-gray-400">/ 100</div>
                </div>
              </div>

              <div className="mt-4">
                <span className="text-sm font-bold text-emerald-400">Good</span>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                  Your codebase is well structured, but there are some areas for improvement.
                </p>
              </div>
            </Card>

            {/* Sub-Metrics Cards Grid */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-5 border-white/10 flex flex-col justify-between">
                <span className="text-xs text-gray-400 font-medium">Code Quality</span>
                <div className="my-3">
                  <span className="text-2xl font-bold text-white">85</span>
                  <span className="text-xs text-gray-500 ml-1">/100</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-indigo-400 h-full rounded-full" style={{ width: '85%' }} />
                </div>
              </Card>

              <Card className="p-5 border-white/10 flex flex-col justify-between">
                <span className="text-xs text-gray-400 font-medium">Security</span>
                <div className="my-3">
                  <span className="text-2xl font-bold text-amber-400">74</span>
                  <span className="text-xs text-gray-500 ml-1">/100</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: '74%' }} />
                </div>
              </Card>

              <Card className="p-5 border-white/10 flex flex-col justify-between">
                <span className="text-xs text-gray-400 font-medium">Performance</span>
                <div className="my-3">
                  <span className="text-2xl font-bold text-cyan-400">81</span>
                  <span className="text-xs text-gray-500 ml-1">/100</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-cyan-400 h-full rounded-full" style={{ width: '81%' }} />
                </div>
              </Card>

              <Card className="p-5 border-white/10 flex flex-col justify-between">
                <span className="text-xs text-gray-400 font-medium">Maintainability</span>
                <div className="my-3">
                  <span className="text-2xl font-bold text-emerald-400">88</span>
                  <span className="text-xs text-gray-500 ml-1">/100</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: '88%' }} />
                </div>
              </Card>
            </div>
          </div>

          {/* Issues Found Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Issues Found</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                    {filteredIssues.length}
                  </span>
                </h2>
                <p className="text-xs text-gray-400">
                  Detailed inspection report with source file references and suggestions
                </p>
              </div>

              {/* Severity Filter Dropdown */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">Filter:</span>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="bg-[#111827] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Issues List */}
            <div className="space-y-3">
              {filteredIssues.map((issue) => (
                <Card
                  key={issue.id}
                  hoverEffect
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-white/10"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Badge variant={getSeverityBadgeVariant(issue.severity)} size="sm" className="mt-0.5 uppercase shrink-0">
                      {issue.severity}
                    </Badge>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {issue.title}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                        {issue.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-gray-500">
                        <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{issue.filePath}:{issue.lineNumber}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setInspectIssue(issue)}
                      leftIcon={<Code2 className="w-3.5 h-3.5 text-indigo-400" />}
                    >
                      View Code
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Code Inspection Modal */}
      {inspectIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-[#0F172A] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getSeverityBadgeVariant(inspectIssue.severity)} size="sm" className="uppercase">
                    {inspectIssue.severity}
                  </Badge>
                  <span className="text-xs font-mono text-gray-400">
                    {inspectIssue.filePath}:{inspectIssue.lineNumber}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  {inspectIssue.title}
                </h3>
              </div>
              <button
                onClick={() => setInspectIssue(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-400 font-semibold">Issue:</span>
                <p className="text-gray-200 mt-0.5">{inspectIssue.description}</p>
              </div>

              {inspectIssue.codeSnippet && (
                <div>
                  <span className="text-red-400 font-semibold">Detected Code:</span>
                  <pre className="mt-1 p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-red-200 font-mono text-xs overflow-x-auto">
                    {inspectIssue.codeSnippet}
                  </pre>
                </div>
              )}

              <div>
                <span className="text-emerald-400 font-semibold">Recommended Fix:</span>
                <p className="text-gray-200 mt-0.5">{inspectIssue.recommendation}</p>
              </div>

              {inspectIssue.fixedCodeSnippet && (
                <div>
                  <span className="text-emerald-400 font-semibold">Suggested Refactor:</span>
                  <pre className="mt-1 p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-200 font-mono text-xs overflow-x-auto">
                    {inspectIssue.fixedCodeSnippet}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setInspectIssue(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                onClick={() => {
                  alert('Automated PR fix patch will be implemented in Day 2+ GitHub integration.');
                  setInspectIssue(null);
                }}
              >
                Apply Fix Suggestion
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Review;
