import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FolderGit2,
  FileCode2,
  Sparkles,
  GitPullRequest,
  ShieldAlert,
  Settings,
  LogOut,
  ExternalLink,
  X,
  Network,
  Activity,
  FileWarning,
  Flame,
  Bug,
  Zap,
  Database,
  TestTube2,
  ChevronDown,
  Cpu,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className, onClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [intelOpen, setIntelOpen] = useState(true);

  // Determine active item
  const isDashboardActive = location.pathname === '/dashboard';
  const isReviewActive = location.pathname.startsWith('/review');
  const isAskActive = location.pathname.startsWith('/ask');
  const isPRActive = location.pathname.startsWith('/pull-requests');
  const isSecurityActive = location.pathname.startsWith('/security');
  const isArchitectureActive = location.pathname.startsWith('/architecture');
  const isHealthActive = location.pathname.startsWith('/health');
  const isTechDebtActive = location.pathname.startsWith('/technical-debt');
  const isSettingsActive = location.pathname === '/settings';

  // 5 Pro Features Active State
  const isImpactActive = location.pathname.startsWith('/impact');
  const isDebugActive = location.pathname.startsWith('/debugger');
  const isApiGuardianActive = location.pathname.startsWith('/api-guardian');
  const isDbRiskActive = location.pathname.startsWith('/database-risk');
  const isTestGenActive = location.pathname.startsWith('/test-generator');

  const handleNavClick = (
    key:
      | 'dashboard'
      | 'repositories'
      | 'reviews'
      | 'ask'
      | 'pull-requests'
      | 'security'
      | 'architecture'
      | 'health'
      | 'technical-debt'
      | 'settings'
      | 'impact'
      | 'debugger'
      | 'api-guardian'
      | 'database-risk'
      | 'test-generator'
  ) => {
    if (onClose) onClose();

    const lastOwner = localStorage.getItem('lastViewedRepoOwner') || 'developit';
    const lastRepo = localStorage.getItem('lastViewedRepoName') || 'mitt';

    switch (key) {
      case 'dashboard':
        navigate('/dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;

      case 'repositories':
        if (location.pathname === '/dashboard') {
          const repoSection = document.getElementById('repositories-section');
          if (repoSection) {
            repoSection.scrollIntoView({ behavior: 'smooth' });
          } else {
            window.scrollTo({ top: 350, behavior: 'smooth' });
          }
        } else {
          navigate('/dashboard');
        }
        break;

      case 'reviews': {
        const lastViewedId = localStorage.getItem('lastViewedRepoId');
        if (lastViewedId) {
          navigate(`/review/${lastViewedId}`);
        } else {
          navigate('/review/cloudshare');
        }
        break;
      }

      case 'ask':
        navigate(`/ask/${lastOwner}/${lastRepo}`);
        break;

      case 'pull-requests':
        navigate('/pull-requests');
        break;

      case 'security':
        navigate(`/security/${lastOwner}/${lastRepo}`);
        break;

      case 'architecture':
        navigate(`/architecture/${lastOwner}/${lastRepo}`);
        break;

      case 'health':
        navigate(`/health/${lastOwner}/${lastRepo}`);
        break;

      case 'technical-debt':
        navigate(`/technical-debt/${lastOwner}/${lastRepo}`);
        break;

      case 'impact':
        navigate(`/impact/${lastOwner}/${lastRepo}`);
        break;

      case 'debugger':
        navigate(`/debugger/${lastOwner}/${lastRepo}`);
        break;

      case 'api-guardian':
        navigate(`/api-guardian/${lastOwner}/${lastRepo}`);
        break;

      case 'database-risk':
        navigate(`/database-risk/${lastOwner}/${lastRepo}`);
        break;

      case 'test-generator':
        navigate(`/test-generator/${lastOwner}/${lastRepo}`);
        break;

      case 'settings':
        navigate('/settings');
        break;
    }
  };

  return (
    <>
      <aside
        className={cn(
          'w-64 border-r border-white/[0.08] bg-[#070D18] flex flex-col justify-between shrink-0 h-screen sticky top-0 z-30 select-none overflow-hidden',
          className
        )}
      >
        {/* Top Brand */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <Logo size="md" />
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Links */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Main Workspace Navigation */}
          <nav className="space-y-1" aria-label="Main Navigation">
            <button
              onClick={() => handleNavClick('dashboard')}
              title="Dashboard: Overview & Code Health Metrics"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                isDashboardActive
                  ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border border-indigo-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <LayoutDashboard className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="flex-1">Dashboard</span>
            </button>

            <button
              onClick={() => handleNavClick('repositories')}
              title="Repositories: Search, Filter & Inspect GitHub Repos"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 border border-transparent transition-all duration-150 cursor-pointer text-left"
            >
              <FolderGit2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="flex-1">Repositories</span>
            </button>

            <button
              onClick={() => handleNavClick('reviews')}
              title="Reviews: AI Code Review Workspace & Issue Diagnosis"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                isReviewActive
                  ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border border-indigo-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <FileCode2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="flex-1">Reviews</span>
              {isReviewActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            </button>

            <button
              onClick={() => handleNavClick('ask')}
              title="Ask Your Codebase: RAG Semantic Vector Q&A"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                isAskActive
                  ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border border-indigo-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="flex-1">Ask Codebase</span>
              <span className="text-[9px] font-mono font-semibold text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded border border-indigo-500/20">
                RAG
              </span>
            </button>

            <button
              onClick={() => handleNavClick('pull-requests')}
              title="Pull Requests: Automated AI PR Reviews & Webhooks"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                isPRActive
                  ? 'bg-gradient-to-r from-purple-600/30 to-indigo-600/20 text-white border border-purple-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <GitPullRequest className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="flex-1">Pull Requests</span>
              <span className="text-[9px] font-mono font-semibold text-purple-400 bg-purple-500/10 px-1 py-0.5 rounded border border-purple-500/20">
                PR
              </span>
            </button>

            <button
              onClick={() => handleNavClick('security')}
              title="Security Scanner: Vulnerabilities, Secrets & AI Fixes"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                isSecurityActive
                  ? 'bg-gradient-to-r from-purple-600/30 to-rose-600/20 text-white border border-purple-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="flex-1">Security</span>
              <span className="text-[9px] font-mono font-semibold text-purple-400 bg-purple-500/10 px-1 py-0.5 rounded border border-purple-500/20">
                PRO
              </span>
            </button>

            <button
              onClick={() => handleNavClick('architecture')}
              title="Architecture: Deconstruct Modules, Data Flow & Topology"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                isArchitectureActive
                  ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border border-indigo-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <Network className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="flex-1">Architecture</span>
            </button>

            <button
              onClick={() => handleNavClick('health')}
              title="Codebase Health: Deterministic Multi-Dimensional Ratings"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                isHealthActive
                  ? 'bg-gradient-to-r from-emerald-600/30 to-indigo-600/20 text-white border border-emerald-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="flex-1">Code Health</span>
            </button>

            <button
              onClick={() => handleNavClick('technical-debt')}
              title="Technical Debt: Complexity, Duplication & Remediations"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                isTechDebtActive
                  ? 'bg-gradient-to-r from-purple-600/30 to-indigo-600/20 text-white border border-purple-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <FileWarning className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="flex-1">Technical Debt</span>
            </button>
          </nav>

          {/* Group: Engineering Intelligence */}
          <div className="pt-2 border-t border-white/[0.06]">
            <button
              onClick={() => setIntelOpen(!intelOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-gray-400 hover:text-gray-200 uppercase tracking-wider transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                Engineering Intelligence
              </span>
              <ChevronDown
                className={cn('w-3.5 h-3.5 transition-transform duration-200', intelOpen ? 'rotate-0' : '-rotate-90')}
              />
            </button>

            {intelOpen && (
              <div className="mt-1 space-y-1 pl-1">
                {/* Impact Analysis */}
                <button
                  onClick={() => handleNavClick('impact')}
                  title="Impact Analysis: Blast Radius & Dependency Tracing"
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                    isImpactActive
                      ? 'bg-gradient-to-r from-rose-600/30 to-purple-600/20 text-white border border-rose-500/30 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  )}
                >
                  <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="flex-1">Impact Analysis</span>
                </button>

                {/* AI Debugger */}
                <button
                  onClick={() => handleNavClick('debugger')}
                  title="AI Debugger: Root Cause Analysis & Grounded Evidence"
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                    isDebugActive
                      ? 'bg-gradient-to-r from-rose-600/30 to-purple-600/20 text-white border border-rose-500/30 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  )}
                >
                  <Bug className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="flex-1">AI Debugger</span>
                </button>

                {/* API Guardian */}
                <button
                  onClick={() => handleNavClick('api-guardian')}
                  title="API Guardian: Breaking Contract Detector"
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                    isApiGuardianActive
                      ? 'bg-gradient-to-r from-amber-600/30 to-purple-600/20 text-white border border-amber-500/30 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  )}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="flex-1">API Guardian</span>
                </button>

                {/* Database Risk */}
                <button
                  onClick={() => handleNavClick('database-risk')}
                  title="Database Risk: Destructive DDL & Schema Migration Analyzer"
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                    isDbRiskActive
                      ? 'bg-gradient-to-r from-purple-600/30 to-indigo-600/20 text-white border border-purple-500/30 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  )}
                >
                  <Database className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="flex-1">Database Risk</span>
                </button>

                {/* Test Generator */}
                <button
                  onClick={() => handleNavClick('test-generator')}
                  title="Test Generator: Auto-detect Framework & Synthesize Tests"
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                    isTestGenActive
                      ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border border-indigo-500/30 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  )}
                >
                  <TestTube2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="flex-1">Test Generator</span>
                </button>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="pt-2 border-t border-white/[0.06]">
            <button
              onClick={() => handleNavClick('settings')}
              title="Settings: Manage AI Rules, Preferences & Security"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left',
                isSettingsActive
                  ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border border-indigo-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <Settings className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="flex-1">Settings</span>
            </button>
          </div>
        </div>

        {/* Bottom User Profile Section */}
        <div className="p-3 border-t border-white/[0.08] shrink-0">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
            <a
              href={user?.html_url || `https://github.com/${user?.login || ''}`}
              target="_blank"
              rel="noreferrer"
              title="View GitHub profile in new tab"
              className="flex items-center gap-2.5 min-w-0 group cursor-pointer flex-1"
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-8 h-8 rounded-full object-cover border border-indigo-400/40 shrink-0 group-hover:border-indigo-400 transition-colors"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {user?.login?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors flex items-center gap-1">
                  <span className="truncate">{user?.name || user?.login || 'Developer'}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 shrink-0" />
                </p>
                <p className="text-[10px] text-gray-400 truncate">
                  @{user?.login || 'github'}
                </p>
              </div>
            </a>

            <button
              onClick={() => logout()}
              title="Sign out of AI Code Reviewer"
              aria-label="Sign out"
              className="p-1.5 text-gray-400 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
