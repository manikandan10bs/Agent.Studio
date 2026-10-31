import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Logo } from '../components/common/Logo';
import {
  LayoutDashboard,
  Bot,
  BookOpen,
  Cpu,
  BarChart3,
  Search,
  LogOut,
  ShieldCheck,
  Compass,
  Menu,
  X,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  Wrench
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
  const isEditor = location.pathname === '/studio' && !isDashboard && !isTools;

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/studio?view=dashboard', active: isDashboard },
    { label: 'Agent', icon: Bot, path: '/studio?view=editor', active: isEditor },
    { label: 'Tools', icon: Wrench, path: '/studio?view=tools', active: isTools },
    ...(user?.role === 'admin' ? [{ label: 'Providers & Models', icon: Cpu, path: '/admin?tab=providers', active: location.pathname === '/admin' }] : []),
    { label: 'Public Gallery', icon: Compass, path: '/explore', active: location.pathname === '/explore' },
  ];

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
    <div className="flex h-screen w-screen overflow-hidden bg-[#F4F7FB] text-slate-800 p-2 sm:p-3">
      {/* Outer Application Frame */}
      <div className="flex flex-1 h-full w-full rounded-2xl border border-slate-200/90 bg-[#F4F7FB] shadow-sm overflow-hidden relative">
        
        {/* Mobile Header Toggle */}
        <div className="md:hidden absolute top-3 left-3 z-30">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-sm"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* 1. Left Sidebar (Navy strip matching screenshot style) */}
        <aside
          className={`fixed md:relative inset-y-0 left-0 z-20 flex flex-col w-60 bg-[#0B1320] text-slate-200 p-3.5 transition-transform duration-200 ease-in-out md:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          {/* Top Brand Logo */}
          <div className="px-2 py-2 mb-3">
            <Logo size="md" theme="dark" />
          </div>

          {/* Search Box */}
          <div className="relative mb-4 px-1">
            <div className="flex items-center rounded-xl bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 text-xs text-slate-300 focus-within:border-blue-400">
              <Search className="w-3.5 h-3.5 mr-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-white placeholder-slate-400 focus:outline-none text-xs"
              />
              <kbd className="hidden sm:inline-block px-1 py-0.2 rounded bg-slate-700 text-[10px] text-slate-400 font-mono">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 space-y-1 px-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.active || location.pathname === item.path;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    navigate(item.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Bottom Settings & User Profile */}
          <div className="pt-3 border-t border-slate-800 px-1 space-y-1">
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Admin Console</span>
              </button>
            )}

            <button
              onClick={() => alert('AGENT.STUDIO — Enterprise Precision AI Agent Builder')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>Help & FAQ</span>
            </button>

            {/* Current User Card */}
            <div className="relative pt-2">
              <div
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-750 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
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
                <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl bg-[#111A2B] border border-slate-700 shadow-2xl p-1 z-30 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 border-b border-slate-750 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Role: <span className="text-blue-400">{user?.role}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* 2 & 3. Main Center + Live Preview Area */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-[#F4F7FB]">
          <div className="flex-1 flex min-h-0 min-w-0 p-3 sm:p-4 overflow-hidden">
            {children}
          </div>
          {/* Bottom Copyright & FAQ Footer matching reference design */}
          <footer className="h-7 border-t border-slate-200/70 bg-white/70 px-5 flex items-center justify-between text-[11px] text-slate-500 flex-shrink-0 select-none">
            <div
              onClick={() => alert('Agent.Studio FAQ & Documentation')}
              className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors font-medium text-slate-600"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>FAQ</span>
            </div>
            <div className="text-center font-normal text-slate-400 tracking-wide">
              Copyright © 2026 eClerx. All right reserved.
            </div>
            <div className="w-12"></div>
          </footer>
        </main>
      </div>
    </div>
  );
};
