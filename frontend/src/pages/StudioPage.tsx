import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { StudioLayout } from '../layouts/StudioLayout';
import { AgentForm } from '../features/agents/AgentForm';
import { LivePreviewChat } from '../features/chat/LivePreviewChat';
import { ToolsMarketplace } from '../features/tools/ToolsMarketplace';
import { Agent, Model } from '../types';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';
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
  Play,
  Trash2,
  RotateCcw,
  Info,
  Edit3,
  Copy,
  MoreVertical,
  ArrowLeft
} from 'lucide-react';

export const StudioPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentView = searchParams.get('view') || 'agents';

  const [agents, setAgents] = useState<Agent[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [isQuickTestOpen, setIsQuickTestOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fleet view search & filters
  const [activeTab, setActiveTab] = useState<'created' | 'shared'>('created');
  const [draftSearchQuery, setDraftSearchQuery] = useState('');

  // Dashboard view state
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'tested'>('all');

  // Double verification delete state
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAgents = async () => {
    try {
      const [list, modelsList] = await Promise.all([
        api.getAgents().catch(() => []),
        api.getEnabledModels().catch(() => [])
      ]);
      setAgents(list);
      setModels(modelsList);

      // Keep editingAgent in sync if currently editing an existing agent
      if (editingAgent && editingAgent.id > 0) {
        const fresh = list.find((a) => a.id === editingAgent.id);
        if (fresh) setEditingAgent(fresh);
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

  const formatAgentDate = (dateStr?: string) => {
    if (!dateStr) return '03 Sep 2026, 06:24 AM';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${day}, ${time}`;
  };

  // Start fresh agent draft in memory
  const handleStartNewDraft = () => {
    const blankAgent: Agent = {
      id: 0,
      creator_id: user?.id || 1,
      name: '',
      slug: 'new-agent',
      is_public: false,
      description: '',
      system_instructions:
        'You are a helpful and accurate precision AI assistant.\n- Answer questions clearly and concisely using verified documentation.\n- If documents do not contain the answer, explicitly state that.',
      conversation_starters: [
        'What is your name and purpose?',
        'Summarize key insights from the attached documents.',
      ],
      base_model_id: models[0]?.id,
      base_model_name: models[0]?.display_name || 'Gemini 2.5 Flash',
      provider_name: models[0]?.provider_name || 'gemini',
      capability_rag: true,
      capability_memory: true,
      capability_streaming: true,
      enabled_tools: [],
      tools_config: {},
      status: 'draft',
      current_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setEditingAgent(blankAgent);
    setIsDraftSaved(false);
    setIsQuickTestOpen(false);
  };

  const handleDuplicateAgent = async (ag: Agent) => {
    try {
      const clone = await api.createAgent({
        name: `${ag.name} (Copy)`,
        description: ag.description,
        base_model_id: ag.base_model_id,
        system_instructions: ag.system_instructions,
        conversation_starters: ag.conversation_starters,
        capability_rag: ag.capability_rag,
        capability_memory: ag.capability_memory,
        capability_streaming: ag.capability_streaming,
        enabled_tools: ag.enabled_tools,
        tools_config: ag.tools_config,
      });
      setAgents((prev) => [clone, ...prev]);
    } catch (err: any) {
      alert(`Could not duplicate agent: ${err.message}`);
    }
  };

  const handleConfirmDeleteAgent = async () => {
    if (!agentToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteAgent(agentToDelete.id);
      const updatedList = agents.filter((a) => a.id !== agentToDelete.id);
      setAgents(updatedList);
      if (editingAgent?.id === agentToDelete.id) {
        setEditingAgent(null);
      }
      setAgentToDelete(null);
      setDeleteConfirmText('');
    } catch (err: any) {
      alert(`Failed to delete agent: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderDeleteModal = () => {
    if (!agentToDelete) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
          <div className="flex items-center gap-3 text-rose-600 mb-3">
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Agent</h3>
              <p className="text-xs text-slate-500">Double verification required</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            This action is permanent and cannot be undone. All versions, documents, and chat history for{' '}
            <strong className="text-slate-900">{agentToDelete.name}</strong> will be permanently removed.
          </p>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 mb-4">
            <label className="text-[11px] font-semibold text-slate-700 block mb-1.5">
              Type the exact agent name <span className="font-mono text-rose-600 font-bold select-all">"{agentToDelete.name}"</span> to confirm:
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={agentToDelete.name}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-medium"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                setAgentToDelete(null);
                setDeleteConfirmText('');
              }}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteAgent}
              disabled={deleteConfirmText.trim() !== agentToDelete.name.trim() || isDeleting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Permanently Delete
            </button>
          </div>
        </div>
      </div>
    );
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

  // 0. TOOLS VIEW
  if (currentView === 'tools') {
    return (
      <StudioLayout>
        <ToolsMarketplace />
      </StudioLayout>
    );
  }

  // 1. DASHBOARD VIEW: Shows all created models and agents
  if (currentView === 'dashboard') {
    const filteredAgents = agents.filter((ag) => {
      const matchesSearch =
        ag.name.toLowerCase().includes(dashboardSearchQuery.toLowerCase()) ||
        (ag.description && ag.description.toLowerCase().includes(dashboardSearchQuery.toLowerCase())) ||
        (ag.base_model_name && ag.base_model_name.toLowerCase().includes(dashboardSearchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || ag.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    const publishedCount = agents.filter((a) => a.status === 'published').length;
    const draftCount = agents.filter((a) => a.status !== 'published').length;

    return (
      <StudioLayout>
        <div className="flex flex-col h-full w-full overflow-y-auto pr-1">
          {/* Dashboard Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                Agent Dashboard
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                  {agents.length} Total
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Overview of all your AI agents, assigned base models, and deployment states.
              </p>
            </div>
            <button
              onClick={() => {
                setSearchParams({ view: 'agents' });
                handleStartNewDraft();
              }}
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
              <span className="text-xs font-medium text-slate-500 block">Draft Agents</span>
              <span className="text-2xl font-bold text-amber-600 mt-1 block">{draftCount}</span>
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
                value={dashboardSearchQuery}
                onChange={(e) => setDashboardSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-white border border-slate-200 pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-xs self-start sm:self-auto">
              {(['all', 'published', 'draft'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
                    statusFilter === st ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
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
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAgentToDelete(ag);
                        setDeleteConfirmText('');
                      }}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Agent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingAgent(ag);
                        setIsDraftSaved(ag.status !== 'published');
                        setIsQuickTestOpen(false);
                        setSearchParams({ view: 'agents' });
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
        {renderDeleteModal()}
      </StudioLayout>
    );
  }

  // 2. AGENT SECTION: Shows Agent Studio Fleet Workspace or Agent Studio Editor
  const [fleetFilter, setFleetFilter] = useState<'all' | 'published' | 'draft'>('all');
  const filteredAgentsList = agents.filter((ag) => {
    const matchesSearch =
      ag.name.toLowerCase().includes(draftSearchQuery.toLowerCase()) ||
      (ag.description && ag.description.toLowerCase().includes(draftSearchQuery.toLowerCase())) ||
      (ag.base_model_name && ag.base_model_name.toLowerCase().includes(draftSearchQuery.toLowerCase()));
    const matchesFilter =
      fleetFilter === 'all' ||
      (fleetFilter === 'published' && ag.status === 'published') ||
      (fleetFilter === 'draft' && ag.status !== 'published');
    return matchesSearch && matchesFilter;
  });

  const publishedAgentsCount = agents.filter((a) => a.status === 'published').length;
  const draftAgentsCount = agents.filter((a) => a.status !== 'published').length;

  // 2A. FLEET WORKSPACE VIEW: When no agent is actively being edited
  if (!editingAgent) {
    return (
      <StudioLayout>
        <div className="flex flex-col h-full w-full overflow-y-auto pr-1 space-y-6">
          {/* Top Hero Header with Agent Creation Lobby Emblem */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 p-0.5 shadow-md shadow-indigo-500/20 flex-shrink-0">
                <div className="w-full h-full rounded-[14px] bg-[#0A0E17] flex items-center justify-center p-1.5">
                  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                    <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="url(#lobby-prism-grad)" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M12 8L16 12L12 16L8 12L12 8Z" fill="url(#lobby-prism-grad)" fillOpacity="0.8" />
                    <circle cx="12" cy="12" r="1.5" fill="#FFFFFF" />
                    <defs>
                      <linearGradient id="lobby-prism-grad" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#6366F1" />
                        <stop offset="0.5" stopColor="#8B5CF6" />
                        <stop offset="1" stopColor="#06B6D4" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                    Agent Creation Lobby
                  </span>
                  <span className="text-[10px] font-medium text-slate-500">
                    {agents.length} active agent{agents.length === 1 ? '' : 's'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Agent Studio Fleet
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Design, ground with vector document intelligence, and deploy autonomous agents.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={loadAgents}
                title="Refresh fleet"
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleStartNewDraft}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.01]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Create New Agent</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFleetFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  fleetFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Agents ({agents.length})
              </button>
              <button
                type="button"
                onClick={() => setFleetFilter('published')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  fleetFilter === 'published'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live &amp; Published ({publishedAgentsCount})
              </button>
              <button
                type="button"
                onClick={() => setFleetFilter('draft')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  fleetFilter === 'draft'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                In Development ({draftAgentsCount})
              </button>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name, model, specialty..."
                value={draftSearchQuery}
                onChange={(e) => setDraftSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-white border border-slate-200 hover:border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-xs transition-colors"
              />
            </div>
          </div>

          {/* Cards Grid */}
          {filteredAgentsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-14 bg-white rounded-2xl border border-slate-200 text-center my-6 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-3.5 shadow-inner">
                <Bot className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No agents match your filter</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mb-5 leading-relaxed">
                Create a new autonomous agent powered by Gemini, Groq, OpenRouter, or Mistral with document RAG.
              </p>
              <button
                type="button"
                onClick={handleStartNewDraft}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Build First Agent</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
              {filteredAgentsList.map((ag) => (
                <div
                  key={ag.id}
                  className="rounded-2xl border border-slate-200 bg-white hover:border-indigo-400 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all relative flex flex-col justify-between group"
                >
                  <div>
                    {/* Card Top Row: Avatar + Status + Menu */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 p-0.5 shadow-xs">
                          <div className="w-full h-full rounded-[10px] bg-slate-900 flex items-center justify-center text-white">
                            <Bot className="w-5 h-5 text-indigo-300" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                                ag.status === 'published'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {ag.status === 'published' ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Live
                                </>
                              ) : (
                                'Draft'
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              v{ag.current_version || 1}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateAgent(ag)}
                          title="Duplicate Agent"
                          className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAgentToDelete(ag);
                            setDeleteConfirmText('');
                          }}
                          title="Delete Agent"
                          className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-slate-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Agent Name & Description */}
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight">
                      {ag.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {ag.description || 'Autonomous assistant built with Agent.Studio.'}
                    </p>

                    {/* Model & Capabilities Pills */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-medium">
                        {ag.base_model_name || 'Standard Model'}
                      </span>
                      {ag.capability_rag && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 font-semibold">
                          RAG
                        </span>
                      )}
                      {ag.capability_streaming && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
                          Stream
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAgent(ag);
                        setIsDraftSaved(ag.status !== 'published');
                        setIsQuickTestOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Test Chat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingAgent(ag);
                        setIsDraftSaved(ag.status !== 'published');
                        setIsQuickTestOpen(false);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-xs"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Configure</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {renderDeleteModal()}
      </StudioLayout>
    );
  }

  // 2B. AGENT STUDIO WORKSPACE: Creation / Edit Canvas + Integrated Quick Playground
  return (
    <StudioLayout>
      <div className="flex flex-col w-full h-full min-h-0 min-w-0">
        <div className="flex flex-1 gap-4 overflow-hidden min-h-0 min-w-0">
          {/* Main Configuration Form Panel */}
          <div
            className={`h-full min-h-0 min-w-0 flex flex-col overflow-hidden transition-all duration-300 ${
              isQuickTestOpen ? 'w-full lg:w-[58%]' : 'w-full max-w-5xl mx-auto'
            }`}
          >
            <AgentForm
              agent={editingAgent}
              onAgentChange={(updated) => {
                setEditingAgent(updated);
                if (updated.id > 0) {
                  setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
                }
              }}
              onRefreshAgent={loadAgents}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              isDraftSaved={isDraftSaved}
              setIsDraftSaved={setIsDraftSaved}
              isQuickTestOpen={isQuickTestOpen}
              onQuickTest={() => setIsQuickTestOpen(true)}
              onBackToList={() => setEditingAgent(null)}
              onAgentPublished={async () => {
                await loadAgents();
                setEditingAgent(null);
                setIsDraftSaved(false);
                setIsQuickTestOpen(false);
              }}
            />
          </div>

          {/* Right Side Quick Playground: Only renders when isQuickTestOpen is true */}
          {isQuickTestOpen && (
            <div className="h-full flex flex-col overflow-hidden w-full lg:w-[42%] animate-in slide-in-from-right-3 duration-200">
              <LivePreviewChat
                agent={editingAgent}
                isExpanded={false}
                onClose={() => setIsQuickTestOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
      {renderDeleteModal()}
    </StudioLayout>
  );
};
