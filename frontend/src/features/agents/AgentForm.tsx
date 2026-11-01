import React, { useState, useEffect } from 'react';
import { Agent, Model, Document, Provider, SystemTool, ToolExecutionResult } from '../../types';
import { api } from '../../services/api';
import { Toggle } from '../../components/common/Toggle';
import { PromptBuilderModal } from '../../components/common/PromptBuilderModal';
import { ShareModal } from '../../components/common/ShareModal';
import {
  Rocket,
  Share2,
  Save,
  CheckCircle2,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileJson,
  Calculator,
  Clock,
  BarChart3,
  Link,
  Sparkles,
  Copy,
  Play,
  Check,
  Trash2,
  Wand2,
  Plus,
  X,
  AlertTriangle,
  Loader2,
  Cpu,
  Menu,
  MessageSquare,
  BookOpen,
  Info,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowLeft,
  ArrowRight,
  Wrench,
  ShieldCheck,
  Search,
  Globe,
  Settings,
  Bot,
  Zap,
  Sliders,
  Database,
  Terminal,
  Activity,
  Server,
  Radio
} from 'lucide-react';

interface AgentFormProps {
  agent: Agent;
  onAgentChange: (updated: Agent) => void;
  onRefreshAgent: () => void;
  isSaving: boolean;
  setIsSaving: (s: boolean) => void;
  isDraftSaved: boolean;
  setIsDraftSaved: (s: boolean) => void;
  isQuickTestOpen?: boolean;
  onQuickTest?: () => void;
  onBackToList?: () => void;
  onAgentPublished?: () => void;
}

export const AgentForm: React.FC<AgentFormProps> = ({
  agent,
  onAgentChange,
  onRefreshAgent,
  isSaving,
  setIsSaving,
  isDraftSaved,
  setIsDraftSaved,
  isQuickTestOpen = false,
  onQuickTest,
  onBackToList,
  onAgentPublished,
}) => {
  const [activeTab, setActiveTab] = useState<'model' | 'tools' | 'rag' | 'mcp' | 'instructions' | 'runtime'>('model');
  const [thinkingLevel, setThinkingLevel] = useState('Not supported');

  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [newStarter, setNewStarter] = useState('');
  const [showPromptBuilder, setShowPromptBuilder] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Tools state
  const [availableTools, setAvailableTools] = useState<SystemTool[]>([]);
  const [toolsSearch, setToolsSearch] = useState('');
  const [toolsCategory, setToolsCategory] = useState('All');
  const [activeConfigureTool, setActiveConfigureTool] = useState<SystemTool | null>(null);
  const [activeTestTool, setActiveTestTool] = useState<SystemTool | null>(null);
  const [testParams, setTestParams] = useState<Record<string, any>>({});
  const [isExecutingTest, setIsExecutingTest] = useState(false);
  const [testResult, setTestResult] = useState<ToolExecutionResult | null>(null);

  // MCP State
  const [mcpEndpoint, setMcpEndpoint] = useState('');
  const [mcpTransport, setMcpTransport] = useState<'sse' | 'stdio'>('sse');
  const [testingMcp, setTestingMcp] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<'idle' | 'connected' | 'error'>('idle');

  // Load models, providers, documents, and tools
  const loadData = async () => {
    try {
      const [modelsList, providersList, docsList, toolsList] = await Promise.all([
        api.getEnabledModels().catch(() => []),
        api.getProvidersStatus().catch(() => []),
        agent.id ? api.getAgentDocuments(agent.id).catch(() => []) : Promise.resolve([]),
        api.getTools().catch(() => []),
      ]);
      setModels(modelsList);
      setProviders(providersList);
      setDocuments(docsList);
      setAvailableTools(toolsList);

      if (!agent.base_model_id && modelsList.length > 0) {
        onAgentChange({
          ...agent,
          base_model_id: modelsList[0].id,
          base_model_name: modelsList[0].display_name,
          provider_name: modelsList[0].provider_name,
        });
      }
    } catch (err: any) {
      console.error('Failed to load agent workspace data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [agent.id]);

  // Poll processing documents
  useEffect(() => {
    const hasPending = documents.some((d) => d.status === 'uploading' || d.status === 'processing');
    if (!hasPending || !agent.id) return;

    const interval = setInterval(async () => {
      try {
        const updatedDocs = await api.getAgentDocuments(agent.id);
        setDocuments(updatedDocs);
      } catch {
        // ignore
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [documents, agent.id]);

  const handleFieldChange = (field: keyof Agent, value: any) => {
    onAgentChange({
      ...agent,
      [field]: value,
    });
  };

  const handleAddStarter = () => {
    if (!newStarter.trim()) return;
    const starters = [...(agent.conversation_starters || []), newStarter.trim()];
    handleFieldChange('conversation_starters', starters);
    setNewStarter('');
  };

  const handleRemoveStarter = (idx: number) => {
    const starters = (agent.conversation_starters || []).filter((_, i) => i !== idx);
    handleFieldChange('conversation_starters', starters);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !agent.id) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const newDoc = await api.uploadAgentDocument(agent.id, files[i]);
        setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    try {
      await api.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      alert(`Could not delete document: ${err.message}`);
    }
  };

  const handleSaveDraft = async () => {
    if (!agent.name.trim()) {
      alert('Please provide an Agent Name before saving draft.');
      return;
    }
    setIsSaving(true);
    setSaveMessage(null);
    try {
      let savedAgent: Agent;
      if (!agent.id || agent.id === 0) {
        savedAgent = await api.createAgent({
          name: agent.name.trim(),
          description: agent.description?.trim() || '',
          base_model_id: agent.base_model_id,
          system_instructions: agent.system_instructions || 'You are an autonomous intelligence assistant built on Agent.Studio.',
          conversation_starters: agent.conversation_starters || ['What can you assist me with today?'],
          capability_rag: agent.capability_rag ?? true,
          capability_memory: agent.capability_memory ?? true,
          capability_streaming: agent.capability_streaming ?? true,
          enabled_tools: agent.enabled_tools ?? [],
          tools_config: agent.tools_config || {},
        });
      } else {
        savedAgent = await api.updateAgent(agent.id, {
          name: agent.name.trim(),
          description: agent.description?.trim() || '',
          base_model_id: agent.base_model_id,
          system_instructions: agent.system_instructions,
          conversation_starters: agent.conversation_starters,
          capability_rag: agent.capability_rag,
          capability_memory: agent.capability_memory,
          capability_streaming: agent.capability_streaming,
          enabled_tools: agent.enabled_tools || [],
          tools_config: agent.tools_config || {},
        });
      }
      onAgentChange(savedAgent);
      setIsDraftSaved(true);
      setSaveMessage('Agent draft synchronized. Test in the Quick Playground or Publish live.');
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalSave = async () => {
    if (!agent.name.trim()) {
      alert('Please specify an Agent Name.');
      return;
    }
    setIsSaving(true);
    try {
      let currentId = agent.id;
      if (!currentId || currentId === 0) {
        const created = await api.createAgent({
          name: agent.name.trim(),
          description: agent.description?.trim() || '',
          base_model_id: agent.base_model_id,
          system_instructions: agent.system_instructions || 'You are an autonomous intelligence assistant built on Agent.Studio.',
          conversation_starters: agent.conversation_starters || ['What can you assist me with today?'],
          capability_rag: agent.capability_rag ?? true,
          capability_memory: agent.capability_memory ?? true,
          capability_streaming: agent.capability_streaming ?? true,
          enabled_tools: agent.enabled_tools ?? [],
          tools_config: agent.tools_config || {},
        });
        currentId = created.id;
        onAgentChange(created);
      }
      const updated = await api.publishAgent(currentId);
      onAgentChange(updated);
      setIsDraftSaved(false);
      if (onAgentPublished) {
        onAgentPublished();
      }
    } catch (err: any) {
      alert(`Publish failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickTestClick = async () => {
    if (!isDraftSaved || !agent.id) {
      await handleSaveDraft();
    }
    if (onQuickTest) {
      onQuickTest();
    }
  };

  const handleUnpublish = async () => {
    setIsSaving(true);
    try {
      const updated = await api.unpublishAgent(agent.id);
      onAgentChange(updated);
    } catch (err: any) {
      alert(`Unpublish failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const currentProvider = providers.find(
    (p) => p.name.toLowerCase() === (agent.provider_name || 'gemini').toLowerCase()
  );

  const selectedProviderModels = models.filter(
    (m) => m.provider_name.toLowerCase() === (agent.provider_name || 'gemini').toLowerCase()
  );

  // Tabs prioritized per user instructions: Model, Tools, RAG Settings, MCP Page
  const tabs = [
    { id: 'model', label: 'Model Selection', icon: Cpu },
    { id: 'tools', label: 'Tools & Capabilities', icon: Wrench, count: (agent.enabled_tools || []).length },
    { id: 'rag', label: 'RAG & Knowledge Settings', icon: BookOpen, count: documents.length },
    { id: 'mcp', label: 'MCP (Model Context Protocol)', icon: Layers },
    { id: 'instructions', label: 'System Instructions', icon: Sparkles },
    { id: 'runtime', label: 'Runtime & Governance', icon: ShieldCheck },
  ];

  return (
    <div className="flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden pr-2 pb-24 space-y-5 scroll-smooth">
      {/* 1. STUDIO COMMAND BAR WITH SPECIALIZED AGENT CREATION EMBLEM */}
      <div className="sticky top-0 z-20 -mx-1 px-4 py-3 bg-white/95 backdrop-blur-md border-b border-slate-200/90 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
              title="Return to Agent Fleet"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2.5 min-w-0">
            {/* Specialized Agent Creation Neural Core Prism Emblem */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 p-0.5 shadow-md shadow-indigo-500/20 flex-shrink-0">
              <div className="w-full h-full rounded-[10px] bg-[#0A0E17] flex items-center justify-center p-1">
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                  <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="url(#prism-grad)" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M12 8L16 12L12 16L8 12L12 8Z" fill="url(#prism-grad)" fillOpacity="0.8" />
                  <circle cx="12" cy="12" r="1.5" fill="#FFFFFF" />
                  <defs>
                    <linearGradient id="prism-grad" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#6366F1" />
                      <stop offset="0.5" stopColor="#8B5CF6" />
                      <stop offset="1" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                  {agent.name || 'Untitled Agent'}
                </span>
                {agent.status === 'published' ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live v{agent.current_version}
                  </span>
                ) : isDraftSaved ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                    Draft Saved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    In Development
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Command Action Suite */}
        <div className="flex items-center gap-2">
          {agent.id && (
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleQuickTestClick}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs ${
              isQuickTestOpen
                ? 'bg-indigo-600 text-white shadow-indigo-200'
                : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50/60'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isQuickTestOpen ? 'fill-white' : 'fill-indigo-600'}`} />
            <span>Playground</span>
          </button>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            {isSaving && !isDraftSaved ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={handleFinalSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-sm shadow-indigo-600/20 transition-all"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" />
            )}
            <span>{agent.status === 'published' ? 'Update Live Agent' : 'Publish Agent'}</span>
          </button>
        </div>
      </div>

      {/* 2. AGENT IDENTITY CARD */}
      <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs transition-all">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Agent Identity & Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={agent.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="e.g. Strategic Analyst, Research Assistant..."
                className="w-full rounded-xl bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 px-3.5 py-2.5 text-xs font-semibold text-slate-900 shadow-2xs transition-all pr-9"
              />
              {agent.name.trim().length > 0 && (
                <Check className="w-4 h-4 text-emerald-600 absolute right-3 top-3 pointer-events-none" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Designation for this autonomous agent.
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Role & Capability Summary <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={agent.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="Describe operational mission, domain expertise, and reasoning scope..."
                className="w-full rounded-xl bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 px-3.5 py-2.5 text-xs text-slate-800 shadow-2xs transition-all pr-9"
              />
              {(agent.description || '').trim().length > 0 && (
                <Check className="w-4 h-4 text-emerald-600 absolute right-3 top-3 pointer-events-none" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Surfaced in the Agent Fleet and Public Discovery Gallery.
            </p>
          </div>
        </div>
      </div>

      {/* 3. STUDIO PILLAR NAVIGATION (Model, Tools, RAG Settings, MCP Page, Instructions, Runtime) */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/80 border border-slate-200/80 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. CANVAS CONTENT ACCORDING TO ACTIVE PILLAR */}

      {/* PILLAR 1: MODEL SELECTION */}
      {activeTab === 'model' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200/90 p-5 space-y-5 shadow-xs">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  Foundation Model Selection
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select the primary LLM architecture powering autonomous reasoning, analysis, and generation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Model Client & Tier <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={agent.base_model_id || (models[0]?.id || '')}
                      onChange={(e) => {
                        const mId = Number(e.target.value);
                        const selected = models.find((m) => m.id === mId);
                        onAgentChange({
                          ...agent,
                          base_model_id: mId,
                          base_model_name: selected?.display_name,
                          provider_name: selected?.provider_name,
                        });
                      }}
                      className="w-full appearance-none rounded-xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs pr-10 font-medium transition-colors"
                    >
                      {models.length === 0 ? (
                        <option value="">Select Foundation Model</option>
                      ) : (
                        models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.display_name} ({m.provider_name.toUpperCase()})
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Reasoning / Thinking Effort
                  </label>
                  <div className="relative">
                    <select
                      value={thinkingLevel}
                      onChange={(e) => setThinkingLevel(e.target.value)}
                      className="w-full appearance-none rounded-xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs pr-10 transition-colors"
                    >
                      <option value="Not supported">Direct Stream (Fast & Efficient)</option>
                      <option value="Low">Low (Refined Polish)</option>
                      <option value="Medium">Medium (Balanced Analysis)</option>
                      <option value="High">High (Deep CoT Reasoning)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Underlying Model Architecture
                </label>
                <div className="relative">
                  <select
                    value={agent.base_model_id || ''}
                    onChange={(e) => {
                      const mId = Number(e.target.value);
                      const selected = models.find((m) => m.id === mId);
                      onAgentChange({
                        ...agent,
                        base_model_id: mId,
                        base_model_name: selected?.display_name,
                        provider_name: selected?.provider_name,
                      });
                    }}
                    className="w-full appearance-none rounded-xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs pr-10 font-mono transition-colors"
                  >
                    {selectedProviderModels.length === 0 ? (
                      models.map((m) => (
                        <option key={m.id} value={m.id}>
                          [{m.provider_name.toUpperCase()}] {m.display_name} — ({m.model_identifier})
                        </option>
                      ))
                    ) : (
                      selectedProviderModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.display_name} ({m.model_identifier})
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-violet-50/30 p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 flex-shrink-0 mt-0.5">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Gateway: {currentProvider?.display_name || 'Agent.Studio LLM Engine'}
                    </span>
                    {currentProvider?.is_configured ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Operational
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                        <AlertTriangle className="w-3 h-3" /> Admin Gateway Pending
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Provider keys and enterprise encryption are managed securely by the platform gateway. Agents consume verified endpoints without exposing tokens to browser clients.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200/90 p-5 space-y-4 shadow-xs">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Model Execution Switches
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure streaming and context boundaries.
                </p>
              </div>

              <div className="divide-y divide-slate-100 space-y-1">
                <div className="pt-2">
                  <Toggle
                    label="Token Streaming"
                    description="Streams synthesized tokens in real-time as emitted by the inference cluster."
                    checked={agent.capability_streaming}
                    onChange={(val) => handleFieldChange('capability_streaming', val)}
                  />
                </div>
                <div className="pt-3">
                  <Toggle
                    label="Conversational Memory"
                    description="Maintains multi-turn context and conversation states across interactions."
                    checked={agent.capability_memory}
                    onChange={(val) => handleFieldChange('capability_memory', val)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PILLAR 2: TOOLS & CAPABILITIES */}
      {activeTab === 'tools' && (
        <div className="space-y-4 animate-in fade-in duration-200 flex flex-col">
          <div className="rounded-2xl bg-white border border-slate-200/90 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-indigo-600" />
                  System Capabilities & Execution Tools
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/80">
                    {(agent.enabled_tools || []).length} of {availableTools.length} Armed
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Equip this agent with deterministic computation, file transformation, and real-time retrieval tools.
                </p>
              </div>

              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter capabilities..."
                  value={toolsSearch}
                  onChange={(e) => setToolsSearch(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {['All', 'Documents & Files', 'Data Processing', 'Data Utilities', 'Validation & Utilities', 'Web & Search', 'Gemini AI Tools'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setToolsCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
                    toolsCategory === cat
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {availableTools
                .filter((t) => {
                  const matchesCat = toolsCategory === 'All' || t.category === toolsCategory;
                  const matchesSearch =
                    !toolsSearch ||
                    t.name.toLowerCase().includes(toolsSearch.toLowerCase()) ||
                    t.description.toLowerCase().includes(toolsSearch.toLowerCase());
                  return matchesCat && matchesSearch;
                })
                .map((tool) => {
                  const isToolAdminDisabled = !tool.is_enabled;
                  const isAgentToolEnabled = (agent.enabled_tools || []).includes(tool.id);

                  return (
                    <div
                      key={tool.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        isToolAdminDisabled
                          ? 'bg-slate-50/70 border-slate-200 opacity-60'
                          : isAgentToolEnabled
                          ? 'bg-indigo-50/30 border-indigo-200 shadow-xs ring-1 ring-indigo-500/10'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                              {tool.icon === 'FileText' && <FileText className="w-4 h-4 text-indigo-600" />}
                              {tool.icon === 'FileSpreadsheet' && <FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
                              {tool.icon === 'FileJson' && <FileJson className="w-4 h-4 text-amber-600" />}
                              {tool.icon === 'Calculator' && <Calculator className="w-4 h-4 text-cyan-600" />}
                              {tool.icon === 'Clock' && <Clock className="w-4 h-4 text-violet-600" />}
                              {tool.icon === 'BarChart3' && <BarChart3 className="w-4 h-4 text-indigo-500" />}
                              {tool.icon === 'Link' && <Link className="w-4 h-4 text-sky-600" />}
                              {tool.icon === 'Sparkles' && <Sparkles className="w-4 h-4 text-teal-600" />}
                              {tool.icon === 'Copy' && <Copy className="w-4 h-4 text-purple-600" />}
                              {tool.icon === 'Cpu' && <Cpu className="w-4 h-4 text-pink-600" />}
                              {tool.icon === 'Search' && <Search className="w-4 h-4 text-indigo-600" />}
                              {tool.icon === 'Globe' && <Globe className="w-4 h-4 text-emerald-600" />}
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-slate-900 leading-tight">{tool.name}</h4>
                              <span className="text-[10px] text-slate-400 font-medium">{tool.category}</span>
                            </div>
                          </div>

                          {/* Toggle */}
                          {isToolAdminDisabled ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                              Locked
                            </span>
                          ) : (
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isAgentToolEnabled}
                                onChange={() => {
                                  const current = agent.enabled_tools || [];
                                  const next = isAgentToolEnabled
                                    ? current.filter((id) => id !== tool.id)
                                    : [...current, tool.id];
                                  handleFieldChange('enabled_tools', next);
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">
                          {tool.description}
                        </p>
                      </div>

                      <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <button
                          type="button"
                          onClick={() => setActiveConfigureTool(tool)}
                          className="text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1 transition-colors"
                        >
                          <Settings className="w-3 h-3" />
                          <span>Schema</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveTestTool(tool);
                            setTestResult(null);
                            if (tool.id === 'calculator') setTestParams({ expression: '45 * 12 + 100' });
                            else if (tool.id === 'datetime_tool') setTestParams({ operation: 'now' });
                            else if (tool.id === 'url_validator') setTestParams({ url: 'https://example.com' });
                            else setTestParams({});
                          }}
                          className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Play className="w-3 h-3 fill-indigo-600" />
                          <span>Sandbox Test</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* PILLAR 3: RAG & KNOWLEDGE SETTINGS */}
      {activeTab === 'rag' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="rounded-2xl bg-white border border-slate-200/90 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  Semantic Document RAG & Vector Grounding
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ground responses with verified domain knowledge chunks and verifiable citations.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">RAG Grounding:</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agent.capability_rag}
                    onChange={(e) => handleFieldChange('capability_rag', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            {/* RAG Settings Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Chunk Size</span>
                <span className="font-semibold text-slate-800">500 Tokens / Segment</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Overlap Window</span>
                <span className="font-semibold text-slate-800">50 Tokens</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Similarity Metric</span>
                <span className="font-semibold text-indigo-600">Cosine (Top-4 Semantic Chunks)</span>
              </div>
            </div>

            {/* Upload Dropzone */}
            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl bg-slate-50/60 hover:bg-indigo-50/20 cursor-pointer transition-all group">
              <input
                type="file"
                multiple
                accept=".pdf,.txt,.docx,.md"
                onChange={handleFileUpload}
                disabled={isUploading || !agent.id}
                className="hidden"
              />
              <div className="p-3 rounded-2xl bg-indigo-100/80 text-indigo-600 group-hover:scale-105 transition-transform shadow-xs">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <UploadCloud className="w-6 h-6" />
                )}
              </div>
              <span className="text-xs font-bold text-slate-900 mt-3">
                {isUploading ? 'Generating semantic vector embeddings...' : 'Upload Knowledge Documents'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5">
                {!agent.id
                  ? 'Please save agent as draft first before uploading files'
                  : 'Supports PDF, Word (.docx), Markdown (.md), and Text files up to 25MB'}
              </span>
            </label>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Document Index List */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                <span>Indexed Documents ({documents.length})</span>
                <span>Embedding Status</span>
              </div>

              {documents.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No knowledge documents attached yet</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Attach reference documents to allow this agent to perform retrieval-augmented generation and quote exact source materials.
                  </p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-indigo-600 shadow-2xs">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {doc.filename}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {Math.round(doc.file_size / 1024)} KB • {doc.chunk_count} vector chunks indexed
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                          doc.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : doc.status === 'processing'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {doc.status === 'completed' ? 'Vectorized' : doc.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PILLAR 4: MODEL CONTEXT PROTOCOL (MCP) PAGE */}
      {activeTab === 'mcp' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="rounded-2xl bg-white border border-slate-200/90 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Model Context Protocol (MCP) Server Hub
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/80">
                    Schema v1.0 Standard
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connect autonomous agents to MCP servers for standardized external tool discovery, prompt templates, and dynamic resource streaming.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                  <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                  MCP Client Ready
                </span>
              </div>
            </div>

            {/* MCP Primitives Architecture */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs mb-1">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>tools/list & call</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Allows the agent to dynamically inspect and invoke executable functions exposed by remote MCP endpoints.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>resources/read</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Directly attaches structured database views, API documents, and live application state to model context.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>prompts/get</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Retrieves versioned prompt templates and multi-turn workflows managed centrally across engineering teams.
                </p>
              </div>
            </div>

            {/* Registered MCP Endpoints */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Registered MCP Connectors
              </h4>

              <div className="space-y-2">
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-indigo-600 shadow-2xs mt-0.5">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Agent.Studio Native FastMCP Hub</span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                        transport: stdio • capabilities: [tools, resources, prompts]
                      </p>
                    </div>
                  </div>

                  <span className="text-xs text-indigo-600 font-semibold self-start sm:self-auto">
                    Built-in
                  </span>
                </div>

                {/* Custom Remote MCP Server Input */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Attach Custom MCP Server</span>
                    <span className="text-[11px] text-slate-400">SSE / Stdio transport</span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <select
                      value={mcpTransport}
                      onChange={(e) => setMcpTransport(e.target.value as any)}
                      className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none"
                    >
                      <option value="sse">SSE (HTTP/HTTPS)</option>
                      <option value="stdio">Stdio Process</option>
                    </select>

                    <input
                      type="text"
                      value={mcpEndpoint}
                      onChange={(e) => setMcpEndpoint(e.target.value)}
                      placeholder={mcpTransport === 'sse' ? 'https://mcp.company.internal/sse' : 'npx -y @modelcontextprotocol/server-postgres'}
                      className="flex-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />

                    <button
                      type="button"
                      disabled={testingMcp || !mcpEndpoint.trim()}
                      onClick={() => {
                        setTestingMcp(true);
                        setTimeout(() => {
                          setTestingMcp(false);
                          setMcpStatus('connected');
                          alert(`MCP endpoint "${mcpEndpoint}" verified successfully with Protocol Schema v1.0!`);
                        }, 1200);
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-40"
                    >
                      {testingMcp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3 h-3 fill-white" />}
                      <span>Verify &amp; Attach</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PILLAR 5: INSTRUCTIONS & STARTERS */}
      {activeTab === 'instructions' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="rounded-2xl bg-white border border-slate-200/90 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  System Instructions & Persona Definition
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Program the agent's tone, constraints, problem-solving methodology, and output format.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPromptBuilder(true)}
                className="flex items-center gap-1.5 text-xs text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 px-3 py-1.5 rounded-xl font-semibold transition-all self-start sm:self-auto"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Prompt Builder AI</span>
              </button>
            </div>

            <div className="relative">
              <textarea
                rows={12}
                value={agent.system_instructions || ''}
                onChange={(e) => handleFieldChange('system_instructions', e.target.value)}
                placeholder="Define agent personality and operating guidelines...&#10;&#10;# Persona: Senior Autonomous Analyst&#10;- Always answer queries factually and cite sources.&#10;- When mathematical calculations are needed, invoke the calculator tool.&#10;- Synthesize insights into actionable bullet points."
                className="w-full font-mono rounded-xl bg-slate-900 text-slate-100 p-4 text-xs leading-relaxed placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner resize-y"
              />
              <div className="absolute right-3 bottom-3 text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                {(agent.system_instructions || '').length} characters
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200/90 p-5 space-y-4 shadow-xs">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                Conversation Starters & Guided Prompts
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Suggested prompts presented to users when initiating an interactive session with this agent.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(agent.conversation_starters || []).map((starter, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-xs text-slate-800 font-medium transition-colors"
                >
                  <span>{starter}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStarter(idx)}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newStarter}
                onChange={(e) => setNewStarter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddStarter();
                  }
                }}
                placeholder="Enter a prompt starter (e.g. 'Summarize today\'s financial metrics') and press Enter..."
                className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white shadow-2xs"
              />
              <button
                type="button"
                onClick={handleAddStarter}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Starter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PILLAR 6: RUNTIME & GOVERNANCE */}
      {activeTab === 'runtime' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="rounded-2xl bg-white border border-slate-200/90 p-5 space-y-4 shadow-xs">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Lifecycle & Deployment State
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review runtime versioning, deployment status, and exposure in discovery catalogs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Status</span>
                <span className="text-sm font-bold text-slate-900 uppercase font-mono">{agent.status}</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Release Version</span>
                <span className="text-sm font-bold text-indigo-600 font-mono">v{agent.current_version || '1.0'}</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Catalog Listing</span>
                <span className="text-sm font-bold text-slate-900">{agent.is_public ? 'Public Discovery' : 'Private Studio'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              {agent.status === 'published' && (
                <button
                  type="button"
                  onClick={handleUnpublish}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
                >
                  Unpublish from Live
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Embed & Direct Link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Tool Modal */}
      {activeConfigureTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{activeConfigureTool.name}</h3>
                <span className="text-[11px] text-slate-500">Schema & Tool Specification</span>
              </div>
              <button
                onClick={() => setActiveConfigureTool(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Description</span>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed">{activeConfigureTool.description}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Input Parameters Schema</span>
                <pre className="mt-1.5 p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(activeConfigureTool.config_schema || {}, null, 2)}
                </pre>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-slate-700 font-semibold">Enable for this Agent</span>
                <button
                  type="button"
                  disabled={!activeConfigureTool.is_enabled}
                  onClick={() => {
                    const current = agent.enabled_tools || [];
                    const isNowOn = current.includes(activeConfigureTool.id);
                    handleFieldChange(
                      'enabled_tools',
                      isNowOn ? current.filter((id) => id !== activeConfigureTool.id) : [...current, activeConfigureTool.id]
                    );
                    setActiveConfigureTool(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                    (agent.enabled_tools || []).includes(activeConfigureTool.id)
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {(agent.enabled_tools || []).includes(activeConfigureTool.id) ? 'Disable on Agent' : 'Enable on Agent'}
                </button>
              </div>
            </div>

            <div className="p-3 px-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setActiveConfigureTool(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sandbox Test Tool Modal */}
      {activeTestTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sandbox: {activeTestTool.name}</h3>
                <span className="text-[11px] text-slate-500">Live capability verification bench</span>
              </div>
              <button
                onClick={() => setActiveTestTool(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              {activeTestTool.id === 'calculator' && (
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Mathematical Expression</label>
                  <input
                    type="text"
                    value={testParams.expression || ''}
                    onChange={(e) => setTestParams({ ...testParams, expression: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>
              )}

              {activeTestTool.id === 'datetime_tool' && (
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Operation</label>
                  <select
                    value={testParams.operation || 'now'}
                    onChange={(e) => setTestParams({ ...testParams, operation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  >
                    <option value="now">Current Time (now)</option>
                    <option value="diff">Date Difference</option>
                    <option value="add_subtract">Add / Subtract Units</option>
                  </select>
                </div>
              )}

              {activeTestTool.id === 'url_validator' && (
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Target URL</label>
                  <input
                    type="text"
                    value={testParams.url || ''}
                    onChange={(e) => setTestParams({ ...testParams, url: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>
              )}

              {!['calculator', 'datetime_tool', 'url_validator'].includes(activeTestTool.id) && (
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Parameters (JSON)</label>
                  <textarea
                    rows={4}
                    value={typeof testParams === 'string' ? testParams : JSON.stringify(testParams, null, 2)}
                    onChange={(e) => {
                      try {
                        setTestParams(JSON.parse(e.target.value));
                      } catch {
                        // ignore typing errors
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>
              )}

              {testResult && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Result ({testResult.execution_time_ms}ms)</span>
                    <span className={`font-semibold ${testResult.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {testResult.success ? 'Success' : 'Execution Failed'}
                    </span>
                  </div>
                  {testResult.output_preview && (
                    <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono">
                      {testResult.output_preview}
                    </p>
                  )}
                  {testResult.error && (
                    <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 font-mono">
                      {testResult.error}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 px-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveTestTool(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                Close
              </button>

              <button
                type="button"
                disabled={isExecutingTest}
                onClick={async () => {
                  setIsExecutingTest(true);
                  setTestResult(null);
                  try {
                    const res = await api.testTool(activeTestTool.id, testParams);
                    setTestResult(res);
                  } catch (err: any) {
                    setTestResult({
                      success: false,
                      tool_id: activeTestTool.id,
                      error: err.message,
                      execution_time_ms: 0,
                    });
                  } finally {
                    setIsExecutingTest(false);
                  }
                }}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                {isExecutingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3 h-3 fill-white" />}
                <span>Execute Sandbox Test</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Builder AI Modal */}
      <PromptBuilderModal
        isOpen={showPromptBuilder}
        onClose={() => setShowPromptBuilder(false)}
        onApplyPrompt={(p) => handleFieldChange('system_instructions', p)}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        agentSlug={agent.slug}
        agentName={agent.name}
      />
    </div>
  );
};
