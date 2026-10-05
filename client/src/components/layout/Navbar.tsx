import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { NAV_LINKS } from '../../constants';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, Sun, LogOut, LayoutDashboard } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 w-full bg-[#080F1A]/95 border-b border-white/[0.08] backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Left: Brand Identity */}
          <div className="flex items-center">
            <Logo size="md" />
          </div>

          {/* Center: Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 lg:gap-10">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors duration-150"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="hidden md:flex items-center gap-3.5">
            {/* Theme Toggle Switch with Sun Icon */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="w-11 h-6 rounded-full bg-[#111827] border border-white/10 p-0.5 flex items-center transition-colors cursor-pointer hover:border-white/20"
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-200 ${
                    theme === 'dark'
                      ? 'translate-x-5 bg-indigo-500 text-white'
                      : 'translate-x-0 bg-gray-400 text-gray-900'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              </button>
              <Sun className="w-4 h-4 text-gray-400" />
            </div>

            {isAuthenticated && user ? (
              /* Authenticated User Profile Pill */
              <div className="relative">
                <div className="flex items-center gap-3">
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    <img
                      src={user.avatar_url}
                      alt={user.login}
                      className="w-7 h-7 rounded-full object-cover border border-indigo-400/40"
                    />
                    <span className="text-xs font-semibold text-white max-w-[120px] truncate">
                      {user.name || user.login}
                    </span>
                  </Link>

                  <button
                    onClick={() => navigate('/dashboard')}
                    title="Open Dashboard"
                    aria-label="Open Dashboard"
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <LayoutDashboard className="w-4 h-4 text-indigo-400" />
                  </button>

                  <button
                    onClick={() => logout()}
                    title="Sign Out"
                    className="p-2 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Guest Actions */
              <>
                <Link to="/login">
                  <button className="px-4 py-2 text-sm font-medium text-gray-200 bg-[#0E1626] hover:bg-[#152034] hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all cursor-pointer">
                    Sign In
                  </button>
                </Link>

                <button
                  onClick={() => navigate('/login')}
                  className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:from-[#1D4ED8] hover:to-[#2563EB] rounded-lg shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Get Started
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-3">
            {isAuthenticated && user && (
              <Link to="/dashboard">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-7 h-7 rounded-full border border-indigo-400/50"
                />
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-400 hover:text-white"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/[0.08] bg-[#080F1A] px-5 pt-3 pb-6 space-y-4">
          {isAuthenticated && user && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mb-2">
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-9 h-9 rounded-full border border-indigo-400/50"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user.name || user.login}</p>
                <p className="text-xs text-gray-400 truncate">@{user.login}</p>
              </div>
            </div>
          )}

          <nav className="flex flex-col space-y-2.5">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="pt-4 border-t border-white/[0.08] flex flex-col gap-2.5">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <button className="w-full py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg">
                    Go to Dashboard
                  </button>
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full py-2 text-sm font-medium text-rose-400 bg-white/5 border border-white/10 rounded-lg"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <button className="w-full py-2.5 text-sm font-medium text-gray-200 bg-[#0E1626] border border-white/10 rounded-lg">
                    Sign In
                  </button>
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#2563EB] to-[#3B82F6] rounded-lg"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
