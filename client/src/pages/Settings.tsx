import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { GithubIcon } from '../components/ui/GithubIcon';
import {
  Settings as SettingsIcon,
  Sparkles,
  GitPullRequest,
  Shield,
  Database,
  Bell,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  LogOut,
  ExternalLink,
  Lock,
  Menu,
  RotateCcw,
  Save,
  Check,
  X,
  Trash2,
  Sliders,
  Cpu,
} from 'lucide-react';

type SettingsTab = 'github' | 'ai' | 'pr' | 'security' | 'rag' | 'notifications' | 'danger';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>('github');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = useState({
    aiAnalysis: {
      severityThreshold: 'LOW',
      securityAnalysis: true,
      bugDetection: true,
      performanceAnalysis: true,
      maintainabilityAnalysis: true,
    },
    prReview: {
      autoReview: true,
      reviewOpened: true,
      reviewSynchronize: true,
      reviewReopened: true,
    },
    notifications: {
      reviewCompleted: true,
      criticalSecurityDetected: true,
      highRiskPRDetected: true,
    },
  });

  // Server metadata state
  const [systemInfo, setSystemInfo] = useState({
    ai: {
      provider: 'Google Gemini',
      model: 'gemini-3.1-flash-lite',
      status: 'Server managed',
      apiKeyConfigured: true,
    },
    rag: {
      vectorDatabase: 'PostgreSQL 16 + pgvector',
      embeddingProvider: 'gemini-embedding-001',
      embeddingDimension: 768,
      indexType: 'HNSW Cosine Distance (vector_cosine_ops)',
    },
    security: {
      webhookVerification: true,
      codeExecution: false,
      secretProtection: true,
      apiKeyProtection: true,
    },
  });

  // Danger Zone Modals
  const [confirmClearIndexOpen, setConfirmClearIndexOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [isClearingIndex, setIsClearingIndex] = useState(false);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);

  // Fetch settings from server
  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSettings();
      if (data.settings) {
        setSettings(data.settings);
      }
      if (data.systemInfo) {
        setSystemInfo(data.systemInfo);
      }
      if (data.updatedAt) {
        setLastSavedTime(new Date(data.updatedAt).toLocaleTimeString());
      }
    } catch (err: any) {
      console.error('[Settings] Load failed:', err.message);
      setError(err.message || 'Failed to load settings from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Save settings to PostgreSQL backend
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await api.updateSettings(settings);
      if (res.success) {
        setSaveSuccess(true);
        if (res.updatedAt) {
          setLastSavedTime(new Date(res.updatedAt).toLocaleTimeString());
        }
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
        throw new Error(res.message || 'Failed to save settings.');
      }
    } catch (err: any) {
      setError(err.message || 'Error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  // Reset settings
  const handleReset = async () => {
    setIsResetting(true);
    setError(null);
    try {
      const res = await api.resetSettings();
      if (res.settings) {
        setSettings(res.settings);
        setSaveSuccess(true);
        setLastSavedTime(new Date().toLocaleTimeString());
        setTimeout(() => setSaveSuccess(false), 3500);
      }
      setConfirmResetOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to reset settings.');
    } finally {
      setIsResetting(false);
    }
  };

  // Clear indexed RAG data
  const handleClearIndex = async () => {
    if (clearConfirmText !== 'CLEAR') return;
    setIsClearingIndex(true);
    setError(null);

    try {
      await api.clearIndexedData();
      setConfirmClearIndexOpen(false);
      setClearConfirmText('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to clear index data.');
    } finally {
      setIsClearingIndex(false);
    }
  };

  // Disconnect GitHub
  const handleDisconnect = async () => {
    setConfirmDisconnectOpen(false);
    await logout();
    navigate('/login');
  };

  // Reconnect GitHub OAuth
  const handleReconnect = () => {
    window.location.href = api.getGitHubLoginUrl();
  };

  return (
    <div className="min-h-screen bg-[#080F1A] text-white flex">
      {/* Desktop Sidebar Navigation */}
      <Sidebar className="hidden md:flex" />

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/80 backdrop-blur-sm flex">
          <Sidebar className="w-72" onClose={() => setMobileMenuOpen(false)} />
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="border-b border-white/[0.08] px-4 sm:px-8 py-4 sm:py-5 bg-[#080F1A]/90 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="p-2 sm:p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                <SettingsIcon className="w-6 h-6" />
              </div>

              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                  <span>Settings & Preferences</span>
                  <Badge variant="primary" className="text-[10px] uppercase font-mono px-2 py-0.5">
                    Live Workspace
                  </Badge>
                </h1>
                <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
                  Configure GitHub integration, AI analysis severity, PR webhooks, and security guardrails
                </p>
              </div>
            </div>

            {/* Save / Status Controls */}
            <div className="flex items-center gap-3">
              {lastSavedTime && (
                <span className="text-xs text-gray-400 hidden lg:inline-block">
                  Last saved at {lastSavedTime}
                </span>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={saving || loading}
                leftIcon={saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </header>

        {/* Workspace Body */}
        <main className="p-4 sm:p-8 space-y-6 flex-1 overflow-y-auto max-w-6xl w-full mx-auto">
          {/* Notification Banners */}
          {saveSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 text-xs sm:text-sm animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Settings successfully persisted to PostgreSQL database!</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 text-rose-300 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Tab Navigation Chips */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-4">
            <button
              onClick={() => setActiveTab('github')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'github'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <GithubIcon className="w-4 h-4" />
              <span>GitHub Account</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Analysis</span>
            </button>

            <button
              onClick={() => setActiveTab('pr')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'pr'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <GitPullRequest className="w-4 h-4" />
              <span>PR Reviews</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Security</span>
            </button>

            <button
              onClick={() => setActiveTab('rag')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'rag'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Codebase / RAG</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
            </button>

            <button
              onClick={() => setActiveTab('danger')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ml-auto ${
                activeTab === 'danger'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-rose-400 hover:text-white hover:bg-rose-500/10'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Danger Zone</span>
            </button>
          </div>

          {/* TAB 1: GITHUB CONNECTION */}
          {activeTab === 'github' && (
            <div className="space-y-6">
              <Card className="p-6 border-white/[0.08] bg-[#0E1626]/80 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <GithubIcon className="w-5 h-5 text-indigo-400" />
                    <span>Connected GitHub Account</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Manage your linked GitHub identity and OAuth authorizations
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.login}
                        className="w-14 h-14 rounded-2xl border-2 border-indigo-500/40 object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-xl">
                        {user?.login?.charAt(0).toUpperCase() || 'G'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white">{user?.name || user?.login}</h4>
                        <Badge variant="success" size="sm" className="flex items-center gap-1 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Connected
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">@{user?.login}</p>
                      {user?.bio && <p className="text-xs text-gray-300 mt-1 max-w-md">{user.bio}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReconnect}
                      title="Refresh GitHub token authorizations"
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      Reconnect
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDisconnectOpen(true)}
                      className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                      leftIcon={<LogOut className="w-3.5 h-3.5" />}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>

                {/* Token Security Notice */}
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-200/90 flex items-start gap-3">
                  <Lock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-indigo-300">Sealed Token Architecture</p>
                    <p className="text-gray-400 leading-relaxed">
                      GitHub OAuth tokens are encrypted inside HTTP-only session cookies and never exposed to the browser or JavaScript context. Scopes granted: <code className="text-indigo-300">read:user</code>, <code className="text-indigo-300">user:email</code>, and <code className="text-indigo-300">repo</code>.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: AI ANALYSIS PREFERENCES */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              {/* Severity Threshold */}
              <Card className="p-6 border-white/[0.08] bg-[#0E1626]/80 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-indigo-400" />
                    <span>Review Severity Threshold</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Choose the minimum severity level required to trigger review alerts and warnings
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    { level: 'LOW', label: 'Low (All Observations)', desc: 'Surface all style, quality, bug, and security notes.' },
                    { level: 'MEDIUM', label: 'Medium & Above', desc: 'Ignore minor stylistic notes; surface bugs and security.' },
                    { level: 'HIGH', label: 'High & Critical Only', desc: 'Focus strictly on severe bugs and high security risks.' },
                    { level: 'CRITICAL', label: 'Critical Only', desc: 'Only alert on catastrophic exploits and fatal crashes.' },
                  ].map((item) => (
                    <div
                      key={item.level}
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          aiAnalysis: { ...prev.aiAnalysis, severityThreshold: item.level as any },
                        }))
                      }
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        settings.aiAnalysis.severityThreshold === item.level
                          ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                          : 'bg-black/30 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-white">{item.level}</span>
                        {settings.aiAnalysis.severityThreshold === item.level && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-300">{item.label}</p>
                      <p className="text-[11px] text-gray-400 mt-1 leading-snug">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Analysis Dimensions Toggles */}
              <Card className="p-6 border-white/[0.08] bg-[#0E1626]/80 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span>Active Inspection Dimensions</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Toggle individual AI analysis engines across code inspection workflows
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      key: 'securityAnalysis',
                      title: 'Security Vulnerability Analysis',
                      desc: 'Scan for SQL/Command injection, hardcoded secrets, XSS, and broken authentication.',
                    },
                    {
                      key: 'bugDetection',
                      title: 'Bug & Logical Error Detection',
                      desc: 'Identify race conditions, null dereferences, off-by-one errors, and unhandled exceptions.',
                    },
                    {
                      key: 'performanceAnalysis',
                      title: 'Performance & Complexity Auditing',
                      desc: 'Detect blocking async loops, quadratic algorithmic complexity, and memory leaks.',
                    },
                    {
                      key: 'maintainabilityAnalysis',
                      title: 'Maintainability & Quality Standards',
                      desc: 'Evaluate coupling, bad practices, deprecated API usage, and dead code.',
                    },
                  ].map((dim) => {
                    const isChecked = (settings.aiAnalysis as any)[dim.key];
                    return (
                      <div
                        key={dim.key}
                        className="flex items-center justify-between p-4 rounded-xl bg-black/30 border border-white/5"
                      >
                        <div className="space-y-0.5 pr-4">
                          <p className="text-xs font-bold text-white">{dim.title}</p>
                          <p className="text-xs text-gray-400">{dim.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              aiAnalysis: {
                                ...prev.aiAnalysis,
                                [dim.key]: !isChecked,
                              },
                            }))
                          }
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                            isChecked ? 'bg-indigo-600' : 'bg-gray-700'
                          }`}
                        >
                          <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                              isChecked ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* AI Model Information (Requirement 3: Read-only server managed) */}
              <Card className="p-6 border-white/[0.08] bg-[#0E1626]/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-indigo-400" />
                      <span>Configured AI Model & Provider</span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Model parameters managed securely by server environment configuration
                    </p>
                  </div>
                  <Badge variant="neutral" size="sm" className="text-xs text-gray-300 font-mono">
                    Managed by server configuration
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5">
                    <p className="text-[11px] text-gray-400">AI Provider</p>
                    <p className="text-sm font-bold text-white mt-1">{systemInfo.ai.provider}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5">
                    <p className="text-[11px] text-gray-400">Active Model</p>
                    <p className="text-sm font-bold text-indigo-300 font-mono mt-1">{systemInfo.ai.model}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5">
                    <p className="text-[11px] text-gray-400">API Key Status</p>
                    <p className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> Configured & Sealed
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 3: PR REVIEW SETTINGS */}
          {activeTab === 'pr' && (
            <div className="space-y-6">
              <Card className="p-6 border-white/[0.08] bg-[#0E1626]/80 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <GitPullRequest className="w-5 h-5 text-purple-400" />
                    <span>Pull Request Webhook Processing</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Functional toggles that govern which GitHub webhook actions trigger automated reviews
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      key: 'autoReview',
                      title: 'Automatic Pull Request Review',
                      desc: 'Master toggle to enable or suspend all incoming webhook-driven PR reviews.',
                    },
                    {
                      key: 'reviewOpened',
                      title: 'Review Newly Opened PRs (`pull_request.opened`)',
                      desc: 'Automatically run AI code inspection when a developer opens a new pull request.',
                    },
                    {
                      key: 'reviewSynchronize',
                      title: 'Review Updated PRs (`pull_request.synchronize`)',
                      desc: 'Re-analyze pull requests whenever new commits are pushed to the head branch.',
                    },
                    {
                      key: 'reviewReopened',
                      title: 'Review Reopened PRs (`pull_request.reopened`)',
                      desc: 'Run an updated inspection when a previously closed pull request is reopened.',
                    },
                  ].map((item) => {
                    const isChecked = (settings.prReview as any)[item.key];
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-4 rounded-xl bg-black/30 border border-white/5"
                      >
                        <div className="space-y-0.5 pr-4">
                          <p className="text-xs font-bold text-white">{item.title}</p>
                          <p className="text-xs text-gray-400">{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              prReview: {
                                ...prev.prReview,
                                [item.key]: !isChecked,
                              },
                            }))
                          }
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                            isChecked ? 'bg-purple-600' : 'bg-gray-700'
                          }`}
                        >
                          <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                              isChecked ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 4: SECURITY SETTINGS */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <Card className="p-6 border-white/[0.08] bg-[#0E1626]/80 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <span>Security & Isolation Status</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    System security guardrails enforced by server architecture
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Webhook HMAC Verification</span>
                      <Badge variant="success" size="sm">
                        {systemInfo.security.webhookVerification ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      All incoming webhooks require timing-safe HMAC SHA-256 signature verification (<code className="text-gray-300">x-hub-signature-256</code>).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Repository Code Execution</span>
                      <Badge variant="danger" size="sm">
                        Always Disabled
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Code is strictly analyzed as static text. The server never executes, evaluates, compiles, or runs repository code.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Secret Protection</span>
                      <Badge variant="success" size="sm">
                        Active & Sealed
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Tokens, JWT secrets, and database credentials remain strictly backend-only. Passwords in logs are masked with <code className="text-gray-300">:***@</code>.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">API Key Protection</span>
                      <Badge variant="success" size="sm">
                        Zero Leakage
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Gemini and GitHub keys are never bundled into client JavaScript or stored in client <code className="text-gray-300">localStorage</code>.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 5: CODEBASE / RAG SETTINGS */}
          {activeTab === 'rag' && (
            <div className="space-y-6">
              <Card className="p-6 border-white/[0.08] bg-[#0E1626]/80 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-400" />
                    <span>Vector Database & Embeddings Configuration</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Semantic indexing infrastructure powering "Ask Your Codebase"
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                    <p className="text-xs text-gray-400">Vector Database</p>
                    <p className="text-sm font-bold text-white mt-1">{systemInfo.rag.vectorDatabase}</p>
                  </div>

                  <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                    <p className="text-xs text-gray-400">Embedding Model</p>
                    <p className="text-sm font-bold text-indigo-300 font-mono mt-1">
                      {systemInfo.rag.embeddingProvider} ({systemInfo.rag.embeddingDimension} dims)
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-black/30 border border-white/5 sm:col-span-2">
                    <p className="text-xs text-gray-400">Vector Index Specification</p>
                    <p className="text-xs font-bold text-gray-300 font-mono mt-1">{systemInfo.rag.indexType}</p>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/ask')}
                    leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  >
                    Open "Ask Your Codebase" Workspace
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 6: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <Card className="p-6 border-white/[0.08] bg-[#0E1626]/80 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Bell className="w-5 h-5 text-amber-400" />
                    <span>Notification & Feedback Preferences</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Configure notifications posted to GitHub PR comments upon review completion
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      key: 'reviewCompleted',
                      title: 'Pull Request Review Completed',
                      desc: 'Post an executive summary comment to the GitHub PR when AI analysis finishes.',
                    },
                    {
                      key: 'criticalSecurityDetected',
                      title: 'Critical Security Vulnerabilities Detected',
                      desc: 'Highlight critical security findings prominently in top-level PR feedback.',
                    },
                    {
                      key: 'highRiskPRDetected',
                      title: 'High-Risk PR Warning',
                      desc: 'Attach a high-risk indicator badge if regression score falls below 60/100.',
                    },
                  ].map((item) => {
                    const isChecked = (settings.notifications as any)[item.key];
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-4 rounded-xl bg-black/30 border border-white/5"
                      >
                        <div className="space-y-0.5 pr-4">
                          <p className="text-xs font-bold text-white">{item.title}</p>
                          <p className="text-xs text-gray-400">{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              notifications: {
                                ...prev.notifications,
                                [item.key]: !isChecked,
                              },
                            }))
                          }
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                            isChecked ? 'bg-amber-600' : 'bg-gray-700'
                          }`}
                        >
                          <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                              isChecked ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 7: DANGER ZONE */}
          {activeTab === 'danger' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    <span>Danger Zone</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Irreversible actions that modify authentication status and database records
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Reset Preferences */}
                  <div className="p-4 rounded-xl bg-black/40 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-white">Reset Analysis Preferences</h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Restores all review severity thresholds and PR toggles to standard system defaults.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmResetOpen(true)}
                      className="border-rose-500/40 text-rose-200 hover:bg-rose-500/10 shrink-0"
                      leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                    >
                      Reset Defaults
                    </Button>
                  </div>

                  {/* Clear Indexed Data */}
                  <div className="p-4 rounded-xl bg-black/40 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-white">Clear Indexed Repository Data</h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Deletes all stored code chunks and embeddings from the pgvector database.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmClearIndexOpen(true)}
                      className="border-rose-500/40 text-rose-200 hover:bg-rose-500/10 shrink-0"
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      Clear Database Chunks
                    </Button>
                  </div>

                  {/* Disconnect GitHub */}
                  <div className="p-4 rounded-xl bg-black/40 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-white">Disconnect GitHub OAuth Session</h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Clears your session cookies and disconnects live GitHub account access.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDisconnectOpen(true)}
                      className="border-rose-500/40 text-rose-200 hover:bg-rose-500/10 shrink-0"
                      leftIcon={<LogOut className="w-3.5 h-3.5" />}
                    >
                      Disconnect Account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Confirmation Modal: Clear Indexed Data */}
      {confirmClearIndexOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div
            className="bg-[#090F20] border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Clear Indexed Codebase Data?</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              This action will permanently delete all vector embeddings and code chunks in PostgreSQL. You will need to re-index repositories before running RAG Q&A again.
            </p>
            <p className="text-xs text-gray-400">
              Type <strong className="text-rose-400 font-mono">CLEAR</strong> to confirm:
            </p>
            <input
              type="text"
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              placeholder="Type CLEAR"
              className="w-full bg-black/50 border border-rose-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setConfirmClearIndexOpen(false);
                  setClearConfirmText('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={clearConfirmText !== 'CLEAR' || isClearingIndex}
                onClick={handleClearIndex}
                className="bg-rose-600 hover:bg-rose-500"
              >
                {isClearingIndex ? 'Clearing...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Reset Preferences */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div
            className="bg-[#090F20] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-amber-400">
              <RotateCcw className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Reset Preferences to Default?</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to revert all inspection filters and pull request settings to standard defaults?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmResetOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isResetting}
                onClick={handleReset}
                className="bg-amber-600 hover:bg-amber-500"
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Disconnect GitHub */}
      {confirmDisconnectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div
            className="bg-[#090F20] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <LogOut className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Disconnect GitHub Account?</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              This will terminate your current session and sign you out of AI Code Reviewer.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDisconnectOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDisconnect}
                className="bg-rose-600 hover:bg-rose-500"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
