import React from 'react';
import { NavLink } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, FolderGit2, FileCode2, Settings, LogOut } from 'lucide-react';
import { cn } from '../../utils/cn';

interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Repositories', to: '/dashboard', icon: FolderGit2 },
    { label: 'Reviews', to: '/dashboard', icon: FileCode2 },
    { label: 'Settings', to: '/dashboard', icon: Settings },
  ];

  return (
    <aside
      className={cn(
        'w-64 border-r border-white/[0.08] bg-[#070D18] flex flex-col justify-between shrink-0 h-screen sticky top-0 z-30 select-none',
        className
      )}
    >
      {/* Top Brand */}
      <div>
        <div className="p-6 border-b border-white/[0.08]">
          <Logo size="md" />
        </div>

        {/* Navigation links */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                    isActive && item.label === 'Dashboard'
                      ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border border-indigo-500/30 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  )
                }
              >
                <Icon className="w-4 h-4 text-indigo-400" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Profile */}
      <div className="p-4 border-t border-white/[0.08]">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-9 h-9 rounded-full object-cover border border-indigo-400/40 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {user?.login?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {user?.name || user?.login || 'Developer'}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                @{user?.login || 'github'}
              </p>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 text-gray-400 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
