import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Logo } from '../components/common/Logo';
import {
  LayoutDashboard,
  Bot,
  Wrench,
  Cpu,
  Compass,
  Menu,
  X,
  ChevronRight,
  HelpCircle,
  ShieldCheck,
  LogOut,
  Search,
  Sparkles,
  ExternalLink,
  Zap,
  Activity
} from 'lucide-react';

interface StudioLayoutProps {
  children: React.ReactNode;
}

export const StudioLayout: React.FC<StudioLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isDashboard = location.pathname === '/studio' && location.search.includes('view=dashboard');
  const isTools = (location.pathname === '/studio' && location.search.includes('view=tools')) || location.pathname === '/tools';
  const isAgent = location.pathname === '/studio' && !isDashboard && !isTools;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'AS';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0D14] text-slate-100 p-1 sm:p-2.5 font-sans">
      {/* Outer Sleek Container Frame */}
      <div className="flex flex-1 h-full w-full rounded-2xl border border-slate-800/80 bg-[#0F1420] shadow-2xl overflow-hidden relative">
        
        {/* Mobile Header Toggle */}
        <div className="md:hidden absolute top-3 left-3 z-30">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 shadow-md"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* 1. Left Sidebar: Modern Obsidian Studio Panel */}
        <aside
          className={`fixed md:relative inset-y-0 left-0 z-20 flex flex-col w-64 bg-[#0A0E17] border-r border-slate-800/80 text-slate-300 p-4 transition-transform duration-200 ease-in-out md:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          {/* Top Brand Logo */}
          <div className="px-2 py-2 mb-4">
            <Logo size="md" theme="dark" />
          </div>

          {/* Quick Search / Command Pill */}
          <div className="relative mb-5 px-1">
            <div className="flex items-center rounded-xl bg-slate-900/90 border border-slate-800 px-3 py-2 text-xs text-slate-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all shadow-inner">
              <Search className="w-3.5 h-3.5 mr-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search studio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none text-xs"
              />
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono border border-slate-700/60">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Navigation Groups */}
          <div className="flex-1 space-y-5 overflow-y-auto pr-1">
            {/* Group 1: Workspace */}
            <div className="space-y-1">
              <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Workspace
              </span>
              <button
                onClick={() => {
                  navigate('/studio?view=agents');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isAgent
                    ? 'bg-gradient-to-r from-indigo-600/25 to-violet-600/10 text-white border-l-2 border-indigo-500 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Bot className={`w-4 h-4 ${isAgent ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>Agent Studio</span>
              </button>

              <button
                onClick={() => {
                  navigate('/studio?view=tools');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isTools
                    ? 'bg-gradient-to-r from-indigo-600/25 to-violet-600/10 text-white border-l-2 border-indigo-500 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Wrench className={`w-4 h-4 ${isTools ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>Tools Catalog</span>
              </button>

              <button
                onClick={() => {
                  navigate('/studio?view=dashboard');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isDashboard
                    ? 'bg-gradient-to-r from-indigo-600/25 to-violet-600/10 text-white border-l-2 border-indigo-500 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${isDashboard ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>Agent Fleet</span>
              </button>
            </div>

            {/* Group 2: Discovery */}
            <div className="space-y-1">
              <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Discovery
              </span>
              <button
                onClick={() => {
                  navigate('/explore');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  location.pathname === '/explore'
                    ? 'bg-gradient-to-r from-indigo-600/25 to-violet-600/10 text-white border-l-2 border-indigo-500 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Compass className={`w-4 h-4 ${location.pathname === '/explore' ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>Public Gallery</span>
              </button>
            </div>

            {/* Group 3: Administration (if admin) */}
            {user?.role === 'admin' && (
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Platform
                </span>
                <button
                  onClick={() => {
                    navigate('/admin?tab=providers');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    location.pathname === '/admin'
                      ? 'bg-gradient-to-r from-indigo-600/25 to-violet-600/10 text-white border-l-2 border-indigo-500 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>LLM Gateway</span>
                </button>

                <button
                  onClick={() => {
                    navigate('/admin?tab=users');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Admin Console</span>
                </button>
              </div>
            )}
          </div>

          {/* Bottom Settings & User Card */}
          <div className="pt-3 border-t border-slate-800/80 px-1 space-y-2">
            <div className="relative">
              <div
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {user?.full_name || 'Creator'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {user?.email || 'user@agent.studio'}
                    </p>
                  </div>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    userDropdownOpen ? 'rotate-90' : ''
                  }`}
                />
              </div>

              {/* User Dropdown */}
              {userDropdownOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl bg-[#0D121F] border border-slate-700 shadow-2xl p-1.5 z-30 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center justify-between">
                    <span>Role</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      user?.role === 'admin' ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/20 text-indigo-300'
                    }`}>
                      {user?.role}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* 2 & 3. Main Studio Workspace Area */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-[#F8FAFD]">
          <div className="flex-1 flex min-h-0 min-w-0 p-3 sm:p-4 overflow-hidden">
            {children}
          </div>

          {/* Proprietary Agent.Studio Modern Status & Copyright Footer */}
          <footer className="h-8 border-t border-slate-200 bg-white/90 px-5 flex items-center justify-between text-[11px] text-slate-500 flex-shrink-0 select-none shadow-xs">
            <div className="flex items-center gap-2 text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-slate-700">Agent.Studio Engine</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">v2.4</span>
            </div>

            <div className="text-center font-medium text-slate-600 tracking-wide">
              Copyright © 2026 Agent.Studio. All rights reserved.
            </div>

            <div className="flex items-center gap-3 text-slate-500">
              <a
                href="#docs"
                onClick={(e) => { e.preventDefault(); alert('Agent.Studio Documentation & API Reference'); }}
                className="hover:text-indigo-600 transition-colors"
              >
                Docs
              </a>
              <span>•</span>
              <a
                href="#faq"
                onClick={(e) => { e.preventDefault(); alert('Agent.Studio FAQ & Support'); }}
                className="hover:text-indigo-600 transition-colors"
              >
                FAQ
              </a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};
