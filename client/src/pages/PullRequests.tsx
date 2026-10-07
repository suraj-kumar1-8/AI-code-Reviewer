import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';
import type { PRReview } from '../types';
import { EngineeringInsightsPanel } from '../components/pr/EngineeringInsightsPanel';
import {
  GitPullRequest,
  Search,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  X,
  Menu,
  ChevronRight,
  Sparkles,
  GitCommit,
  User,
  Filter,
  Play,
} from 'lucide-react';

export const PullRequests: React.FC = () => {
  const [reviews, setReviews] = useState<PRReview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedReview, setSelectedReview] = useState<PRReview | null>(null);

  // Manual Trigger Modal state
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState<boolean>(false);
  const [triggerOwner, setTriggerOwner] = useState<string>('developit');
  const [triggerRepo, setTriggerRepo] = useState<string>('mitt');
  const [triggerPRNumber, setTriggerPRNumber] = useState<string>('215');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const fetchReviews = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const data = await api.getPRReviews();
      setReviews(data.reviews || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pull request reviews.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleManualAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerOwner || !triggerRepo || !triggerPRNumber) return;

    setIsAnalyzing(true);
    setTriggerError(null);

    try {
      const res = await api.triggerPRReview({
        owner: triggerOwner.trim(),
        repo: triggerRepo.trim(),
        prNumber: Number(triggerPRNumber),
        force: true,
      });

      setIsTriggerModalOpen(false);
      await fetchReviews(true);
      if (res.review) {
        setSelectedReview(res.review);
      }
    } catch (err: any) {
      setTriggerError(err.message || 'Failed to trigger PR review.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      const matchesSearch =
        r.pr_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.repo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.pr_author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(r.pr_number).includes(searchQuery);

      const matchesRisk =
        riskFilter === 'ALL' || r.risk_level.toUpperCase() === riskFilter.toUpperCase();

      return matchesSearch && matchesRisk;
    });
  }, [reviews, searchQuery, riskFilter]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = reviews.length;
    const highRisk = reviews.filter((r) => r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL').length;
    const avgScore = total > 0 ? Math.round(reviews.reduce((acc, r) => acc + (r.score || 0), 0) / total) : 0;
    const cleanPRs = reviews.filter((r) => (!r.issues || r.issues.length === 0)).length;
    return { total, highRisk, avgScore, cleanPRs };
  }, [reviews]);

  const getRiskBadge = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-3.5 h-3.5" /> CRITICAL RISK
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <ShieldAlert className="w-3.5 h-3.5" /> HIGH RISK
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
            <AlertCircle className="w-3.5 h-3.5" /> MEDIUM RISK
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" /> LOW RISK
          </span>
        );
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 70) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  return (
    <div className="flex min-h-screen bg-[#050914] text-white">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform md:relative md:translate-x-0 transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar onClose={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#070D18]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <GitPullRequest className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  Pull Request AI Reviews
                  <span className="text-[10px] font-mono uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                    Day 6 Webhooks
                  </span>
                </h1>
                <p className="text-xs text-gray-400">
                  Automated webhook code reviews, diff inspection, and security analysis
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchReviews(true)}
              disabled={isRefreshing}
              className="text-gray-300 border-white/10 hover:bg-white/5"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setIsTriggerModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20"
            >
              <Play className="w-4 h-4 mr-1.5" />
              Analyze PR
            </Button>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Stats KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-[#0B132B]/60 border-white/[0.08]">
              <div className="text-xs text-gray-400 font-medium">Total Reviews</div>
              <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
              <div className="text-[11px] text-gray-500 mt-1">Processed from webhooks</div>
            </Card>
            <Card className="p-4 bg-[#0B132B]/60 border-white/[0.08]">
              <div className="text-xs text-gray-400 font-medium">High / Critical Risk</div>
              <div className={`text-2xl font-bold mt-1 ${stats.highRisk > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {stats.highRisk}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Requires security review</div>
            </Card>
            <Card className="p-4 bg-[#0B132B]/60 border-white/[0.08]">
              <div className="text-xs text-gray-400 font-medium">Avg Health Score</div>
              <div className="text-2xl font-bold text-indigo-400 mt-1">{stats.avgScore}/100</div>
              <div className="text-[11px] text-gray-500 mt-1">Across analyzed PR diffs</div>
            </Card>
            <Card className="p-4 bg-[#0B132B]/60 border-white/[0.08]">
              <div className="text-xs text-gray-400 font-medium">Clean PRs</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.cleanPRs}</div>
              <div className="text-[11px] text-gray-500 mt-1">Zero issues detected</div>
            </Card>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0B132B]/50 p-3 rounded-2xl border border-white/[0.08]">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search PR title, repository, author, or #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Filter className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((risk) => (
                <button
                  key={risk}
                  onClick={() => setRiskFilter(risk)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    riskFilter === risk
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {risk}
                </button>
              ))}
            </div>
          </div>

          {/* Loading Skeletons */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-white/[0.03] animate-pulse border border-white/5" />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <Card className="p-8 text-center bg-rose-500/5 border-rose-500/20">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">Failed to load PR reviews</h3>
              <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">{error}</p>
              <Button onClick={() => fetchReviews()} size="sm" className="mt-4">
                Retry Loading
              </Button>
            </Card>
          )}

          {/* Empty State */}
          {!loading && !error && filteredReviews.length === 0 && (
            <Card className="p-12 text-center bg-[#0B132B]/40 border-white/[0.08]">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4 text-purple-400">
                <GitPullRequest className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-white">No pull request reviews found</h3>
              <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
                {searchQuery || riskFilter !== 'ALL'
                  ? 'No reviews match your current filter criteria.'
                  : 'Configure the GitHub Webhook URL in your repository settings or analyze any public pull request directly.'}
              </p>
              <Button
                onClick={() => setIsTriggerModalOpen(true)}
                size="sm"
                className="mt-5 bg-purple-600 hover:bg-purple-500"
              >
                <Play className="w-4 h-4 mr-1.5" />
                Analyze a Pull Request Now
              </Button>
            </Card>
          )}

          {/* Review List */}
          {!loading && !error && filteredReviews.length > 0 && (
            <div className="space-y-3.5">
              {filteredReviews.map((review) => (
                <div
                  key={review.id}
                  onClick={() => setSelectedReview(review)}
                  className="group p-5 rounded-2xl bg-[#0B132B]/60 hover:bg-[#0E1838] border border-white/[0.08] hover:border-purple-500/30 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-purple-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                        {review.owner}/{review.repo}
                      </span>
                      <span className="font-mono text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">
                        #{review.pr_number}
                      </span>
                      {getRiskBadge(review.risk_level)}
                    </div>

                    <h3 className="text-base font-semibold text-white group-hover:text-purple-300 transition-colors truncate">
                      {review.pr_title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                        @{review.pr_author}
                      </span>
                      <span className="flex items-center gap-1.5 font-mono text-gray-500">
                        <GitCommit className="w-3.5 h-3.5" />
                        {review.commit_sha?.slice(0, 7)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                      {review.issues && (
                        <span className="text-gray-300 font-medium">
                          {review.issues.length} {review.issues.length === 1 ? 'issue' : 'issues'} detected
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                    <div className={`px-3 py-1.5 rounded-xl border text-center font-mono font-bold text-sm ${getScoreColor(review.score)}`}>
                      {review.score}/100
                    </div>

                    <button
                      className="p-2 rounded-xl text-gray-400 group-hover:text-white group-hover:bg-purple-500/20 transition-all"
                      aria-label="View Review Details"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Review Details Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div
            className="bg-[#090F20] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-white/[0.08] flex items-start justify-between bg-[#0B132B]/80">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                    {selectedReview.owner}/{selectedReview.repo}
                  </span>
                  <span className="font-mono text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">
                    #{selectedReview.pr_number}
                  </span>
                  {getRiskBadge(selectedReview.risk_level)}
                </div>
                <h2 className="text-lg font-bold text-white mt-1">{selectedReview.pr_title}</h2>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>Author: @{selectedReview.pr_author}</span>
                  <span>Commit: <code className="font-mono text-gray-300">{selectedReview.commit_sha?.slice(0, 7)}</code></span>
                </div>
              </div>

              <button
                onClick={() => setSelectedReview(null)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Unified Engineering Insights Panel */}
              <EngineeringInsightsPanel
                owner={selectedReview.owner}
                repo={selectedReview.repo}
                prNumber={selectedReview.pr_number}
              />

              {/* Executive Summary */}
              <div>
                <h4 className="text-xs uppercase font-semibold text-gray-400 tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Executive Review Summary
                </h4>
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                  {selectedReview.summary}
                </div>
              </div>

              {/* Issues List */}
              <div>
                <h4 className="text-xs uppercase font-semibold text-gray-400 tracking-wider mb-3">
                  Detected Observations & Defects ({selectedReview.issues?.length || 0})
                </h4>

                {(!selectedReview.issues || selectedReview.issues.length === 0) ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>No vulnerabilities or issues were detected in this pull request diff. Code is clean!</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedReview.issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                issue.severity === 'CRITICAL'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : issue.severity === 'HIGH'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : issue.severity === 'MEDIUM'
                                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {issue.severity}
                            </span>
                            <span className="text-[10px] font-medium text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                              {issue.category || 'Quality'}
                            </span>
                            <span className="text-xs font-semibold text-white">{issue.title}</span>
                          </div>
                          <span className="font-mono text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                            {issue.file}{issue.line ? `:${issue.line}` : ''}
                          </span>
                        </div>

                        <p className="text-xs text-gray-300 leading-relaxed">{issue.description}</p>

                        {issue.recommendation && (
                          <div className="text-xs text-purple-300 bg-purple-500/10 p-2.5 rounded-lg border border-purple-500/20">
                            <strong>Recommendation:</strong> {issue.recommendation}
                          </div>
                        )}

                        {(issue.suggestedFix || (issue as any).suggested_fix) && (
                          <div className="text-xs bg-black/60 p-2.5 rounded-lg border border-emerald-500/20 font-mono text-emerald-300">
                            <div className="text-[10px] uppercase font-bold text-emerald-400 mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Suggested Fix:
                            </div>
                            <pre className="overflow-x-auto whitespace-pre-wrap">{issue.suggestedFix || (issue as any).suggested_fix}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/[0.08] bg-[#0B132B]/60 flex items-center justify-between">
              <div className="text-xs text-gray-400">
                Score: <span className="font-bold text-white">{selectedReview.score}/100</span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`https://github.com/${selectedReview.owner}/${selectedReview.repo}/pull/${selectedReview.pr_number}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 underline"
                >
                  Open PR on GitHub <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <Button size="sm" onClick={() => setSelectedReview(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual PR Trigger Modal */}
      {isTriggerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div
            className="bg-[#090F20] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-purple-400" />
                Analyze GitHub Pull Request
              </h3>
              <button
                onClick={() => setIsTriggerModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Fetch changed diffs, execute Gemini code analysis, and view security & bug findings directly.
            </p>

            <form onSubmit={handleManualAnalyze} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Owner / Organization</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. developit or suraj-kumar1-8"
                  value={triggerOwner}
                  onChange={(e) => setTriggerOwner(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Repository Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. mitt"
                  value={triggerRepo}
                  onChange={(e) => setTriggerRepo(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Pull Request Number</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 215"
                  value={triggerPRNumber}
                  onChange={(e) => setTriggerPRNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {triggerError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {triggerError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTriggerModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isAnalyzing}
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing Diff...
                    </>
                  ) : (
                    'Start Review'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PullRequests;
