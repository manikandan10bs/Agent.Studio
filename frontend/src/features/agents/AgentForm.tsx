import React, { useState, useEffect } from 'react';
import { Agent, Model, Document, Provider } from '../../types';
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
  Layers,
  ArrowLeft,
  Wrench,
  ShieldCheck,
  MessageCircle,
  Lock
} from 'lucide-react';

interface AgentFormProps {
  agent: Agent;
  onAgentChange: (updated: Agent) => void;
  onRefreshAgent: () => void;
  isSaving: boolean;
  setIsSaving: (s: boolean) => void;
  onBackToList?: () => void;
}

export const AgentForm: React.FC<AgentFormProps> = ({
  agent,
  onAgentChange,
  onRefreshAgent,
  isSaving,
  setIsSaving,
  onBackToList,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'model' | 'system' | 'skills' | 'mcp' | 'tools' | 'runtime' | 'prompts'>('model');
  const [advanceConfigOpen, setAdvanceConfigOpen] = useState(true);
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

  // Load enabled models, providers status, and documents
  const loadData = async () => {
    try {
      const [modelsList, providersList, docsList] = await Promise.all([
        api.getEnabledModels().catch(() => []),
        api.getProvidersStatus().catch(() => []),
        agent.id ? api.getAgentDocuments(agent.id).catch(() => []) : Promise.resolve([]),
      ]);
      setModels(modelsList);
      setProviders(providersList);
      setDocuments(docsList);

      // Auto-select first model if agent doesn't have one assigned
      if (!agent.base_model_id && modelsList.length > 0) {
        onAgentChange({
          ...agent,
          base_model_id: modelsList[0].id,
          base_model_name: modelsList[0].display_name,
          provider_name: modelsList[0].provider_name,
        });
      }
    } catch (err: any) {
      console.error('Failed to load models or docs:', err);
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
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const updated = await api.updateAgent(agent.id, {
        name: agent.name,
        description: agent.description,
        base_model_id: agent.base_model_id,
        system_instructions: agent.system_instructions,
        conversation_starters: agent.conversation_starters,
        capability_rag: agent.capability_rag,
        capability_memory: agent.capability_memory,
        capability_streaming: agent.capability_streaming,
      });
      onAgentChange(updated);
      setSaveMessage('Draft saved successfully');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsSaving(true);
    try {
      const updated = await api.publishAgent(agent.id);
      onAgentChange(updated);
      setShowShareModal(true);
    } catch (err: any) {
      alert(`Publish failed: ${err.message}`);
    } finally {
      setIsSaving(false);
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

  // Currently selected provider
  const currentProvider = providers.find(
    (p) => p.name.toLowerCase() === (agent.provider_name || 'gemini').toLowerCase()
  );

  // Filter models for selected provider
  const selectedProviderModels = models.filter(
    (m) => m.provider_name.toLowerCase() === (agent.provider_name || 'gemini').toLowerCase()
  );

  // 7 Sub-tabs matching screenshot
  const subTabs = [
    { id: 'model', label: 'Model', icon: Cpu, badge: 'info' },
    { id: 'system', label: 'System Message', icon: FileText, badge: 'info' },
    { id: 'skills', label: 'Skills', icon: Menu, dot: true },
    { id: 'mcp', label: 'MCP', icon: Layers, dot: true },
    { id: 'tools', label: 'Custom Tools', icon: Wrench, dot: true },
    { id: 'runtime', label: 'Runtime', icon: ShieldCheck, dot: true },
    { id: 'prompts', label: 'Sample Prompts', icon: MessageSquare, dot: true },
  ];

  return (
    <div className="flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden pr-2 pb-44 space-y-4 scroll-smooth">
      {/* 1. Top Header matching screenshot */}
      <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Create an Agent
          </h1>
          <span
            className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium tracking-wide uppercase ${
              agent.status === 'published'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : agent.status === 'tested'
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            {agent.status} (v{agent.current_version})
          </span>
        </div>

        {/* Top Right Action Buttons matching screenshot */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex items-center justify-center px-6 py-2 rounded-xl text-xs font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] shadow-sm transition-all"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            Save Draft
          </button>

          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to list
            </button>
          )}

          {agent.status === 'published' ? (
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-all"
            >
              <Rocket className="w-3.5 h-3.5" />
              Publish
            </button>
          )}
        </div>
      </div>

      {/* 2. Prominent Agent Identity: Name and Description */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 mb-3 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Agent Identity & Description
          </h2>
          <span className="text-[11px] text-slate-400">
            Defines the agent's name & self-awareness
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-800 block mb-1">
              Agent Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={agent.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="e.g. Precision HR Advisor"
              className="w-full rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3.5 py-2 text-xs font-semibold text-slate-900 shadow-xs transition-all"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-800 block mb-1">
              Agent Description & Purpose <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={agent.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="e.g. Answers employee queries on leave policies, medical insurance, and benefits with grounded citations."
              className="w-full rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3.5 py-2 text-xs text-slate-900 shadow-xs transition-all"
            />
          </div>
        </div>
      </div>

      {/* 3. Advance Configuration Toggle Bar matching screenshot */}
      <div className="flex items-center justify-between py-1 mb-2">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={advanceConfigOpen}
            onChange={(e) => setAdvanceConfigOpen(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          <span className="ml-3 text-xs sm:text-sm font-semibold text-slate-800">
            Advance configuration
          </span>
        </label>

        <button
          type="button"
          onClick={() => setAdvanceConfigOpen(!advanceConfigOpen)}
          className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs"
        >
          {advanceConfigOpen ? 'Hide Advance Configuration' : 'Get Advance Configuration'}
        </button>
      </div>

      {/* 4. Amber Alert Banner matching screenshot */}
      <div className="mb-4 p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            Get the advance configurations to save your agent and enable the Quick Test.
          </span>
        </div>
        {saveMessage && (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
            {saveMessage}
          </span>
        )}
      </div>

      {/* 5. Main Advance Configuration Card */}
      {advanceConfigOpen && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-6">
          {/* Card Header matching screenshot */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                Advance configuration <span className="text-rose-500">*</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Open this section to view all the configurations for this agent.
              </p>
            </div>
            <button
              onClick={() => setAdvanceConfigOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Card Body: 7 Sub-tabs Left Strip + Right Content Area */}
          <div className="flex flex-col md:flex-row min-h-[440px]">
            {/* Left Vertical Sub-Tab Strip */}
            <div className="w-full md:w-52 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/70 p-3 space-y-1 flex-shrink-0">
              {subTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSubTab(tab.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                      isActive
                        ? 'bg-[#EFF6FF] text-blue-700 font-semibold shadow-xs border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                    </div>

                    {tab.badge === 'info' ? (
                      <Info className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Content Area */}
            <div className="flex-1 p-5 sm:p-6">
              {/* SUB-TAB 1: MODEL (Only Model Selection, NO API Key configuration) */}
              {activeSubTab === 'model' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Model Client Dropdown */}
                    <div>
                      <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                        Model Client <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={agent.provider_name || 'gemini'}
                          onChange={(e) => {
                            const provName = e.target.value;
                            const matchingModels = models.filter(
                              (m) => m.provider_name.toLowerCase() === provName.toLowerCase()
                            );
                            const firstM = matchingModels[0];
                            onAgentChange({
                              ...agent,
                              provider_name: provName,
                              base_model_id: firstM ? firstM.id : agent.base_model_id,
                              base_model_name: firstM ? firstM.display_name : agent.base_model_name,
                            });
                          }}
                          className="w-full appearance-none rounded-xl bg-white border border-slate-200 hover:border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-xs pr-9 transition-colors font-medium"
                        >
                          <option value="gemini">Google Gemini API</option>
                          <option value="groq">GroqCloud</option>
                          <option value="openrouter">OpenRouter</option>
                          <option value="mistral">Mistral AI</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                      </div>
                    </div>

                    {/* Thinking Level Dropdown */}
                    <div>
                      <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                        Thinking Level
                      </label>
                      <div className="relative">
                        <select
                          value={thinkingLevel}
                          onChange={(e) => setThinkingLevel(e.target.value)}
                          className="w-full appearance-none rounded-xl bg-white border border-slate-200 hover:border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-xs pr-9 transition-colors"
                        >
                          <option value="Not supported">Not supported</option>
                          <option value="Low">Low (Fast & Concise)</option>
                          <option value="Medium">Medium (Balanced)</option>
                          <option value="High">High (Deep Reasoning)</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Specific Base Model Selector */}
                  <div>
                    <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                      Base Model <span className="text-rose-500">*</span>
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
                        className="w-full appearance-none rounded-xl bg-white border border-slate-200 hover:border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-xs pr-9 transition-colors font-mono"
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

                  {/* Clean Admin-Managed Provider Banner (NO API KEY INPUT) */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0 mt-0.5">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {currentProvider?.display_name || 'LLM Gateway'}
                        </span>
                        {currentProvider?.is_configured ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.2 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Ready & Configured
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.2 rounded-full border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> Pending Admin Setup
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        API credentials and rate limits are managed centrally by Platform Administrators in <strong>Providers & Models (/admin)</strong>. Creators can select any approved model without needing raw API keys.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: SYSTEM MESSAGE */}
              {activeSubTab === 'system' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        System Instructions
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Define persona constraints, behavioral rules, and response style.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPromptBuilder(true)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl font-medium transition-colors"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Prompt Builder
                    </button>
                  </div>

                  <textarea
                    rows={11}
                    value={agent.system_instructions || ''}
                    onChange={(e) => handleFieldChange('system_instructions', e.target.value)}
                    placeholder="Instructions for how the agent should think and respond...&#10;- Answer concisely and politely&#10;- Cite provided documents when answering factual queries"
                    className="w-full font-mono rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              )}

              {/* SUB-TAB 3: SKILLS (RAG Knowledge + Memory + Streaming) */}
              {activeSubTab === 'skills' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Skills & Capabilities
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ground agent responses with document knowledge retrieval, conversation memory, and streaming.
                    </p>
                  </div>

                  {/* Core Capabilities Toggles */}
                  <div className="divide-y divide-slate-100 rounded-xl bg-slate-50/60 p-4 border border-slate-200">
                    <Toggle
                      label="Document Knowledge / RAG"
                      description="Retrieves semantic chunks from uploaded documents to answer user queries with citations."
                      checked={agent.capability_rag}
                      onChange={(val) => handleFieldChange('capability_rag', val)}
                    />
                    <Toggle
                      label="Conversation Memory"
                      description="Retains conversational context across multi-turn interactions within context limits."
                      checked={agent.capability_memory}
                      onChange={(val) => handleFieldChange('capability_memory', val)}
                    />
                    <Toggle
                      label="Streaming Responses"
                      description="Streams output tokens in real-time as generated by the underlying model adapter."
                      checked={agent.capability_streaming}
                      onChange={(val) => handleFieldChange('capability_streaming', val)}
                    />
                  </div>

                  {/* Knowledge Base Documents Upload Section */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                      Knowledge Base Documents (PDF, DOCX, TXT)
                    </h4>

                    {/* Upload Dropzone */}
                    <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl bg-slate-50/50 hover:bg-blue-50/30 cursor-pointer transition-colors group">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.txt,.docx,.md"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        className="hidden"
                      />
                      <div className="p-2.5 rounded-full bg-blue-100 text-blue-600 group-hover:scale-105 transition-transform">
                        {isUploading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <UploadCloud className="w-5 h-5" />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-800 mt-2">
                        {isUploading ? 'Extracting text and generating vectors...' : 'Click or drag documents to upload'}
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5">
                        Supports PDF, DOCX, TXT files up to 25MB
                      </span>
                    </label>

                    {uploadError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                        {uploadError}
                      </div>
                    )}

                    {/* Document List */}
                    <div className="space-y-2 pt-1">
                      {documents.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-3">
                          No documents attached yet. Upload a document to ground this agent with verified facts.
                        </p>
                      ) : (
                        documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-xs"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 truncate">
                                  {doc.filename}
                                </p>
                                <p className="text-[11px] text-slate-500 font-mono">
                                  {Math.round(doc.file_size / 1024)} KB • {doc.chunk_count} vector chunks
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span
                                className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium ${
                                  doc.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : doc.status === 'processing'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {doc.status === 'completed' ? 'Indexed' : doc.status}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 4: MCP */}
              {activeSubTab === 'mcp' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Model Context Protocol (MCP)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Connect to standardized Model Context Protocol servers to provide dynamic context.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                    <div className="inline-flex p-3 rounded-full bg-blue-100 text-blue-600">
                      <Layers className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">Model Context Protocol Ready</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      AGENT.STUDIO supports MCP protocol endpoints. External MCP server connectors can be registered via the Admin Console.
                    </p>
                    <div className="pt-2">
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                        Protocol Schema v1.0 Supported
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 5: CUSTOM TOOLS */}
              {activeSubTab === 'tools' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Custom Tools & API Hooks
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Define REST webhooks and external execution endpoints for enterprise agent workflows.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                    <div className="inline-flex p-3 rounded-full bg-amber-100 text-amber-600">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">Tool Runtime Governance</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      External web scraping and arbitrary code execution are restricted by default for safety. Document RAG and Conversation Memory are fully active.
                    </p>
                  </div>
                </div>
              )}

              {/* SUB-TAB 6: RUNTIME */}
              {activeSubTab === 'runtime' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Runtime Versioning & Publication
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manage agent lifecycle: Draft → Tested → Published → Live in Public Gallery.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">Deployment State</span>
                      <span className="font-mono text-blue-600 font-bold uppercase">{agent.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">Current Version</span>
                      <span className="font-mono text-slate-600">v{agent.current_version}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">Public Gallery Visibility</span>
                      <span className="font-medium text-slate-700">{agent.is_public ? 'Publicly Listed' : 'Private'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    {agent.status === 'published' ? (
                      <button
                        type="button"
                        onClick={handleUnpublish}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-xl text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
                      >
                        Unpublish Agent
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePublish}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-all"
                      >
                        <Rocket className="w-3.5 h-3.5" />
                        Publish to Gallery
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowShareModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share Embed / Link
                    </button>
                  </div>
                </div>
              )}

              {/* SUB-TAB 7: SAMPLE PROMPTS */}
              {activeSubTab === 'prompts' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Conversation Starters
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Provide sample prompts to guide users during their first interaction with this agent.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(agent.conversation_starters || []).map((starter, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium"
                      >
                        <span>{starter}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStarter(idx)}
                          className="text-blue-500 hover:text-rose-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
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
                      placeholder="Enter prompt starter and press Enter..."
                      className="flex-1 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddStarter}
                      className="flex items-center gap-1 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold shadow-xs transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Bottom Sticky Actions below Advance Configuration */}
      <div className="pt-4 pb-6 flex items-center justify-between border-t border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Agent Status:</span>
          <span className="font-semibold text-slate-800 capitalize">{agent.status}</span>
          <span>•</span>
          <span>Version: v{agent.current_version}</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] shadow-sm transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </button>

          {agent.status === 'published' ? (
            <button
              type="button"
              onClick={handleUnpublish}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-all"
            >
              <Rocket className="w-3.5 h-3.5" />
              Publish Agent
            </button>
          )}
        </div>
      </div>

      {/* Prompt Builder Modal */}
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
