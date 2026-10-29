import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { StudioLayout } from '../layouts/StudioLayout';
import { AgentForm } from '../features/agents/AgentForm';
import { LivePreviewChat } from '../features/chat/LivePreviewChat';
import { Agent } from '../types';
import { api } from '../services/api';
import {
  Loader2,
  Plus,
  Sliders,
  MessageSquare,
  Bot,
  ArrowRight,
  Search,
  Cpu,
  Layers,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Play
} from 'lucide-react';

export const StudioPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentView = searchParams.get('view') || 'editor';

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState<'configure' | 'preview'>('configure');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'tested'>('all');

  const loadAgents = async () => {
    try {
      const list = await api.getAgents();
      setAgents(list);
      if (list.length > 0) {
        if (!selectedAgent) {
          setSelectedAgent(list[0]);
        } else {
          const fresh = list.find((a) => a.id === selectedAgent.id);
          if (fresh) setSelectedAgent(fresh);
        }
      } else {
        const newAgent = await api.createAgent({
          name: 'Precision Assistant',
          description: 'Autonomous precision-built AI agent tailored to business needs.',
          system_instructions:
            'You are Precision Assistant, an expert AI created with AGENT.STUDIO.\n- Answer questions clearly and concisely using verified documentation.\n- If documents do not contain the answer, explicitly state that.',
          conversation_starters: [
            'What is your name and purpose?',
            'Summarize key insights from the attached documents.',
          ],
          capability_rag: true,
          capability_memory: true,
          capability_streaming: true,
        });
        setAgents([newAgent]);
        setSelectedAgent(newAgent);
      }
    } catch (err: any) {
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleCreateNewAgent = async () => {
    setIsSaving(true);
    try {
      const newAgent = await api.createAgent({
        name: 'New Precision Agent',
        description: 'Custom AI agent built with AGENT.STUDIO.',
        system_instructions: 'You are a helpful and accurate precision AI assistant.',
        conversation_starters: ['What is your name and what do you do?'],
        capability_rag: true,
        capability_memory: true,
        capability_streaming: true,
      });
      setAgents((prev) => [newAgent, ...prev]);
      setSelectedAgent(newAgent);
      setSearchParams({ view: 'editor' });
    } catch (err: any) {
      alert(`Could not create new agent: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <StudioLayout>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-blue-600">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-semibold">Loading Agent Studio...</span>
          </div>
        </div>
      </StudioLayout>
    );
  }

  // Filter agents for Dashboard view
  const filteredAgents = agents.filter((ag) => {
    const matchesSearch =
      ag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ag.description && ag.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ag.base_model_name && ag.base_model_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || ag.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const publishedCount = agents.filter((a) => a.status === 'published').length;
  const testedCount = agents.filter((a) => a.status === 'tested').length;

  // 1. DASHBOARD VIEW: Shows all created models and agents
  if (currentView === 'dashboard') {
    return (
      <StudioLayout>
        <div className="flex flex-col h-full w-full overflow-y-auto pr-1">
          {/* Dashboard Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                Agent Dashboard
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                  {agents.length} Created
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Overview of your precision-built AI agents, assigned base models, and deployment states.
              </p>
            </div>
            <button
              onClick={handleCreateNewAgent}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Create New Agent
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Total Agents</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">{agents.length}</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Published Agents</span>
              <span className="text-2xl font-bold text-emerald-600 mt-1 block">{publishedCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">In Testing</span>
              <span className="text-2xl font-bold text-blue-600 mt-1 block">{testedCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Active Gateways</span>
              <span className="text-2xl font-bold text-purple-600 mt-1 block">4 Providers</span>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search agents by name, description, or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-white border border-slate-200 pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-xs self-start sm:self-auto">
              {(['all', 'published', 'tested', 'draft'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Agents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAgents.map((ag) => (
              <div
                key={ag.id}
                className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Bot className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                        ag.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : ag.status === 'tested'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {ag.status} (v{ag.current_version})
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 tracking-tight">{ag.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {ag.description || 'No description provided.'}
                  </p>

                  {/* Model & Provider Badge */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-medium">
                      [{ag.provider_name ? ag.provider_name.toUpperCase() : 'LLM'}] {ag.base_model_name || 'Standard Model'}
                    </span>
                    {ag.capability_rag && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
                        RAG
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Updated {new Date(ag.updated_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedAgent(ag);
                        setSearchParams({ view: 'editor' });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                    >
                      <span>Configure</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </StudioLayout>
    );
  }

  // 2. EDITOR VIEW: 3-Column Agent Configuration + Live Preview
  if (!selectedAgent) {
    return (
      <StudioLayout>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-sm text-slate-500 mb-4">No agent selected.</p>
          <button
            onClick={handleCreateNewAgent}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </button>
        </div>
      </StudioLayout>
    );
  }

  return (
    <StudioLayout>
      <div className="flex flex-col w-full h-full min-h-0 min-w-0">
        {/* Mobile Tab Toggle */}
        <div className="lg:hidden flex items-center justify-center p-1 bg-white rounded-xl border border-slate-200 mb-3 flex-shrink-0 shadow-xs">
          <button
            onClick={() => setMobileTab('configure')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mobileTab === 'configure'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Configure
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mobileTab === 'preview'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Live Preview
          </button>
        </div>

        {/* 3-Column Studio Layout */}
        <div className="flex flex-1 gap-4 overflow-hidden min-h-0 min-w-0">
          {/* Main Configuration Panel */}
          <div
            className={`h-full min-h-0 min-w-0 flex-col overflow-hidden transition-all duration-300 ${
              isPreviewExpanded
                ? 'hidden'
                : mobileTab === 'configure'
                ? 'flex flex-1 lg:w-[60%]'
                : 'hidden lg:flex lg:w-[60%]'
            }`}
          >
            <AgentForm
              agent={selectedAgent}
              onAgentChange={(updated) => {
                setSelectedAgent(updated);
                setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
              }}
              onRefreshAgent={loadAgents}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              onBackToList={() => setSearchParams({ view: 'dashboard' })}
            />
          </div>

          {/* Right Live Preview Chat */}
          <div
            className={`h-full flex-col overflow-hidden transition-all duration-300 ${
              isPreviewExpanded
                ? 'flex flex-1 w-full'
                : mobileTab === 'preview'
                ? 'flex flex-1 lg:w-[40%]'
                : 'hidden lg:flex lg:w-[40%]'
            }`}
          >
            <LivePreviewChat
              agent={selectedAgent}
              isExpanded={isPreviewExpanded}
              onToggleExpand={() => setIsPreviewExpanded(!isPreviewExpanded)}
            />
          </div>
        </div>
      </div>
    </StudioLayout>
  );
};
