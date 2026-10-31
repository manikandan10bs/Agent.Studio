import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { StudioLayout } from '../layouts/StudioLayout';
import { AgentForm } from '../features/agents/AgentForm';
import { LivePreviewChat } from '../features/chat/LivePreviewChat';
import { ToolsMarketplace } from '../features/tools/ToolsMarketplace';
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
  Play,
  Trash2
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

  // Double verification delete state
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAgents = async () => {
    try {
      const list = await api.getAgents();
      setAgents(list);
      const drafts = list.filter((a) => a.status !== 'published');
      if (list.length > 0) {
        if (!selectedAgent) {
          setSelectedAgent(drafts[0] || list[0]);
        } else {
          const fresh = list.find((a) => a.id === selectedAgent.id);
          if (fresh) setSelectedAgent(fresh);
          else setSelectedAgent(drafts[0] || list[0]);
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

  const handleConfirmDeleteAgent = async () => {
    if (!agentToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteAgent(agentToDelete.id);
      const updatedList = agents.filter((a) => a.id !== agentToDelete.id);
      setAgents(updatedList);
      if (selectedAgent?.id === agentToDelete.id) {
        const remainingDraft = updatedList.find((a) => a.status !== 'published');
        setSelectedAgent(remainingDraft || updatedList[0] || null);
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
            This action is permanent and cannot be undone. All versions, documents, and chat history for <strong className="text-slate-900">{agentToDelete.name}</strong> will be permanently removed.
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

  // 0. TOOLS VIEW: Tools Marketplace & Sandbox Testing
  if (currentView === 'tools') {
    return (
      <StudioLayout>
        <ToolsMarketplace />
      </StudioLayout>
    );
  }

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
        {renderDeleteModal()}
      </StudioLayout>
    );
  }

  // 1.5 DRAFTS VIEW: Shows only draft (not published) agents with "+ Create a new Agent"
  const draftAgents = agents.filter((a) => a.status !== 'published');

  if (currentView === 'drafts') {
    return (
      <StudioLayout>
        <div className="flex flex-col h-full w-full overflow-y-auto pr-1">
          {/* Drafts Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                Draft Agents
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                  {draftAgents.length} Drafts
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Your unpublished work-in-progress agents. Published agents are accessible from the Dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateNewAgent}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Create a new Agent
            </button>
          </div>

          {/* Drafts Grid */}
          {draftAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-center my-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No Draft Agents</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mb-4">
                All your created agents have either been published or none have been started yet.
              </p>
              <button
                type="button"
                onClick={handleCreateNewAgent}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create a new Agent
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {draftAgents.map((ag) => (
                <div
                  key={ag.id}
                  className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Bot className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200">
                        Draft (v{ag.current_version})
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
                          setSelectedAgent(ag);
                          setSearchParams({ view: 'editor' });
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-xs"
                      >
                        <span>Edit Draft</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
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

  // 2. EDITOR VIEW: 3-Column Agent Configuration + Live Preview
  if (!selectedAgent) {
    return (
      <StudioLayout>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-sm text-slate-500 mb-4">No agent selected.</p>
          <button
            type="button"
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
            type="button"
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
            type="button"
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
              draftAgents={draftAgents}
              onSelectAgent={(ag) => setSelectedAgent(ag)}
              onCreateNewAgent={handleCreateNewAgent}
              onAgentChange={(updated) => {
                setSelectedAgent(updated);
                setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
              }}
              onRefreshAgent={loadAgents}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              onBackToList={() => setSearchParams({ view: 'drafts' })}
              onQuickTest={() => {
                setMobileTab('preview');
                setIsPreviewExpanded(false);
              }}
              onAgentPublished={async () => {
                await loadAgents();
                await handleCreateNewAgent();
              }}
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
      {renderDeleteModal()}
    </StudioLayout>
  );
};
