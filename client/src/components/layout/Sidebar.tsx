import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { ComingSoonModal } from '../ui/ComingSoonModal';
import {
  LayoutDashboard,
  FolderGit2,
  FileCode2,
  Settings,
  LogOut,
  ExternalLink,
  X,
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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Determine active item
  const isDashboardActive = location.pathname === '/dashboard';
  const isReviewActive = location.pathname.startsWith('/review');

  const handleNavClick = (key: 'dashboard' | 'repositories' | 'reviews' | 'settings') => {
    if (onClose) onClose();

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
          // Navigate to sample/fallback review workspace
          navigate('/review/cloudshare');
        }
        break;
      }

      case 'settings':
        setIsSettingsOpen(true);
        break;
    }
  };

  return (
    <>
      <aside
        className={cn(
          'w-64 border-r border-white/[0.08] bg-[#070D18] flex flex-col justify-between shrink-0 h-screen sticky top-0 z-30 select-none',
          className
        )}
      >
        {/* Top Brand & Close (mobile) */}
        <div>
          <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
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

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5" aria-label="Main Navigation">
            {/* Dashboard */}
            <button
              onClick={() => handleNavClick('dashboard')}
              title="Dashboard: Overview & Code Health Metrics"
              className={cn(
                'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer text-left',
                isDashboardActive
                  ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border border-indigo-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <LayoutDashboard className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="flex-1">Dashboard</span>
            </button>

            {/* Repositories */}
            <button
              onClick={() => handleNavClick('repositories')}
              title="Repositories: Search, Filter & Inspect GitHub Repos"
              className={cn(
                'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer text-left',
                isDashboardActive
                  ? 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <FolderGit2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="flex-1">Repositories</span>
            </button>

            {/* Reviews */}
            <button
              onClick={() => handleNavClick('reviews')}
              title="Reviews: AI Code Review Workspace & Issue Diagnosis"
              className={cn(
                'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer text-left',
                isReviewActive
                  ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border border-indigo-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <FileCode2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="flex-1">Reviews</span>
              {isReviewActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            {/* Settings */}
            <button
              onClick={() => handleNavClick('settings')}
              title="Settings: Manage AI Rules, API Keys & Preferences (Coming Soon)"
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 border border-transparent transition-all duration-150 cursor-pointer text-left group"
            >
              <Settings className="w-4 h-4 text-indigo-400 shrink-0 group-hover:rotate-45 transition-transform duration-200" />
              <span className="flex-1">Settings</span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                Soon
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom User Profile Section */}
        <div className="p-4 border-t border-white/[0.08]">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5">
            {/* Clickable Profile Info linking to user's GitHub */}
            <a
              href={user?.html_url || `https://github.com/${user?.login || ''}`}
              target="_blank"
              rel="noreferrer"
              title="View GitHub profile in new tab"
              className="flex items-center gap-3 min-w-0 group cursor-pointer flex-1"
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-9 h-9 rounded-full object-cover border border-indigo-400/40 shrink-0 group-hover:border-indigo-400 transition-colors"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {user?.login?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors flex items-center gap-1">
                  <span className="truncate">{user?.name || user?.login || 'Developer'}</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 shrink-0" />
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  @{user?.login || 'github'}
                </p>
              </div>
            </a>

            {/* Logout Button */}
            <button
              onClick={() => logout()}
              title="Sign out of AI Code Reviewer"
              aria-label="Sign out"
              className="p-1.5 text-gray-400 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Settings Coming Soon Modal */}
      <ComingSoonModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Settings & Analysis Preferences"
        description="Personalize your GitHub integration, configure AI analysis parameters, and customize code review severity thresholds."
        feature="Settings Workspace"
        upcomingHighlights={[
          `Connected as @${user?.login || 'github'} with secure OAuth`,
          'Custom severity filters (Security, Bugs, Performance, Maintainability)',
          'AI Model Provider selection (Claude 3.7, GPT-4o, Gemini 2.0)',
          'Automated PR review webhook configuration',
        ]}
      />
    </>
  );
};

export default Sidebar;
