import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Logo } from '../../components/common/Logo';
import { api } from '../../services/api';
import { PublicAgent } from '../../types';
import {
  Search,
  Bot,
  Sparkles,
  ArrowRight,
  BookOpen,
  Zap,
  LogIn,
  Loader2,
  Compass
} from 'lucide-react';

export const ExploreGallery: React.FC = () => {
  const [agents, setAgents] = useState<PublicAgent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const list = await api.getPublicAgents(search);
        setAgents(list);
      } catch (err) {
        console.error('Failed to load public agents:', err);
      } finally {
        setLoading(false);
      }
    };
    const debounce = setTimeout(fetchAgents, 250);
    return () => clearTimeout(debounce);
  }, [search]);

  return (
    <div className="min-h-screen bg-[#F4F7FB] bg-studio-dots text-slate-800 flex flex-col">
      {/* Top Public Navigation Bar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="md" />

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline-block">
              Public Visitor Gallery
            </span>
            <Link
              to="/login"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] shadow-xs transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              Creator Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-12 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Precision-Engineered Autonomous AI Agents</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          Explore Public Agents
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
          Discover, chat with, and test verified AI agents published on AGENT.STUDIO. Grounded with vector document intelligence and multi-provider models.
        </p>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto pt-3">
          <div className="relative flex items-center rounded-2xl bg-white border border-slate-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 p-2 shadow-sm transition-colors">
            <Search className="w-5 h-5 text-slate-400 ml-2 mr-3" />
            <input
              type="text"
              placeholder="Search agents by specialty, model, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-20 flex-1 w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-blue-600">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm font-semibold">Loading verified agents...</span>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20 max-w-sm mx-auto">
            <Bot className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">No published agents found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Sign in to Creator Studio to build and publish your first AI agent.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-2xl bg-white border border-slate-200 hover:border-blue-400 p-5 shadow-sm hover:shadow-md flex flex-col justify-between transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Bot className="w-5 h-5" />
                    </div>
                    {agent.model_name && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                        {agent.model_name}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-3 leading-relaxed">
                    {agent.description || 'Autonomous assistant built with precision intelligence.'}
                  </p>

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                    {agent.capability_rag && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        <BookOpen className="w-3 h-3" /> Vector RAG
                      </span>
                    )}
                    {agent.capability_streaming && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Zap className="w-3 h-3" /> Streaming
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3">
                  <button
                    onClick={() => navigate(`/chat/${agent.slug}`)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs"
                  >
                    <span>Chat With Agent</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
