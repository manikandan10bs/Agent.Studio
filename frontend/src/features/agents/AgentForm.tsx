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
  MessageCircle,
  Lock,
  Search,
  Globe,
  Download,
  Settings,
  Bot
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
  const [overviewOpen, setOverviewOpen] = useState(true);
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

  // 12 Core Tools State
  const [availableTools, setAvailableTools] = useState<SystemTool[]>([]);
  const [toolsSearch, setToolsSearch] = useState('');
  const [toolsCategory, setToolsCategory] = useState('All');
  const [activeConfigureTool, setActiveConfigureTool] = useState<SystemTool | null>(null);
  const [activeTestTool, setActiveTestTool] = useState<SystemTool | null>(null);
  const [testParams, setTestParams] = useState<Record<string, any>>({});
  const [isExecutingTest, setIsExecutingTest] = useState(false);
  const [testResult, setTestResult] = useState<ToolExecutionResult | null>(null);

  // Load enabled models, providers status, documents, and 12 core tools
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
    if (!agent.name.trim()) {
      alert('Please enter an Agent Name before saving draft.');
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
          system_instructions: agent.system_instructions || 'You are a helpful and accurate precision AI assistant.',
          conversation_starters: agent.conversation_starters || ['What can you help me with?'],
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
      setSaveMessage('Your Agent has been saved as draft. Now You can test your Agent using Quick Test and then do the final save.');
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalSave = async () => {
    if (!agent.name.trim()) {
      alert('Please enter an Agent Name.');
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
          system_instructions: agent.system_instructions || 'You are a helpful and accurate precision AI assistant.',
          conversation_starters: agent.conversation_starters || ['What can you help me with?'],
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
    { id: 'tools', label: 'Tools & Capabilities', icon: Wrench, dot: true },
    { id: 'runtime', label: 'Runtime', icon: ShieldCheck, dot: true },
    { id: 'prompts', label: 'Sample Prompts', icon: MessageSquare, dot: true },
  ];

  return (
    <div className="flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden pr-2 pb-24 space-y-4 scroll-smooth">
      {/* Top Header matching Images 2 & 3 */}
      <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Create an Agent
          </h1>
        </div>

        {/* Top Right Action Buttons matching Images 2 & 3 */}
        <div className="flex items-center gap-2.5">
          {/* If draft has been saved (Image 3), show Final Save */}
          {isDraftSaved && (
            <button
              type="button"
              onClick={handleFinalSave}
              disabled={isSaving}
              className="flex items-center justify-center px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] shadow-sm transition-all"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Final Save
            </button>
          )}

          {/* Save Draft is always available */}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex items-center justify-center px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] shadow-sm transition-all"
          >
            {isSaving && !isDraftSaved ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            Save Draft
          </button>

          {/* Quick Test button appears after draft is saved (Image 3) */}
          {isDraftSaved && (
            <button
              type="button"
              onClick={handleQuickTestClick}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1E40AF] hover:bg-blue-800 transition-colors shadow-xs"
              title="Test agent in Quick Test panel"
            >
              <span className="font-bold">›</span>
              Quick Test
            </button>
          )}

          {/* Back to list button */}
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
        </div>
      </div>

      {/* 2. Overview Section matching Images 2, 3 & 4 */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 mb-3 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1">
              Overview <span className="text-rose-500">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Provide the Name and business description.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOverviewOpen(!overviewOpen)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            {overviewOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {overviewOpen && (
          <div className="space-y-4">
            {/* Name Input with validation checkmark */}
            <div>
              <label className="text-xs font-semibold text-slate-800 block mb-1">
                Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={agent.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="New agent"
                  className="w-full rounded-xl bg-white border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3.5 py-2 text-xs font-medium text-slate-900 shadow-xs transition-all pr-9"
                />
                {agent.name.trim().length > 0 && (
                  <Check className="w-4 h-4 text-emerald-600 absolute right-3 top-2.5 pointer-events-none" />
                )}
              </div>
            </div>

            {/* Description Textarea with validation checkmark */}
            <div>
              <label className="text-xs font-semibold text-slate-800 block mb-1">
                Description <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <textarea
                  rows={2}
                  value={agent.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Description"
                  className="w-full rounded-xl bg-white border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3.5 py-2 text-xs text-slate-900 shadow-xs transition-all pr-9 resize-y"
                />
                {(agent.description || '').trim().length > 0 && (
                  <Check className="w-4 h-4 text-emerald-600 absolute right-3 top-3 pointer-events-none" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Advance Configuration Toggle Bar matching Images 2 & 3 */}
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
          className="px-4 py-1.5 rounded-full text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-2xs"
        >
          {advanceConfigOpen ? 'Hide Advance Configuration' : 'Get Advance Configuration'}
        </button>
      </div>

      {/* 4. Amber or Green Banner matching Images 2, 3 & 4 */}
      {!isDraftSaved ? (
        <div className="mb-4 p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Get the advance configurations to save your agent and enable the Quick Test.
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5 text-xs font-medium">
            <div className="w-4 h-4 rounded-full border border-emerald-500 text-emerald-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
              ✓
            </div>
            <span>
              Your Agent has been saved as draft. Now You can test your Agent using Quick Test and then do the final save.
            </span>
          </div>
        </div>
      )}

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
          <div className="flex flex-col md:flex-row min-h-[460px] md:max-h-[680px]">
            {/* Left Vertical Sub-Tab Strip */}
            <div className="w-full md:w-52 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/70 p-3 space-y-1 flex-shrink-0 overflow-y-auto">
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
            <div className="flex-1 p-5 sm:p-6 overflow-y-auto min-h-0">
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
                          className="w-full appearance-none rounded-xl bg-white border border-slate-200 hover:border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-xs pr-14 transition-colors font-medium"
                        >
                          {models.length === 0 ? (
                            <option value="">Select Model</option>
                          ) : (
                            models.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.display_name} ({m.provider_name.toUpperCase()})
                              </option>
                            ))
                          )}
                        </select>
                        {agent.base_model_id && (
                          <Check className="w-4 h-4 text-emerald-600 absolute right-8 top-3 pointer-events-none" />
                        )}
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

                  {/* Knowledge Base Documents Upload Section - Closes when Document Knowledge / RAG is turned off */}
                  {agent.capability_rag ? (
                    <div className="space-y-3 pt-2 animate-in fade-in duration-200">
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
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 mt-2">
                      <p className="font-semibold text-slate-700">Document Knowledge / RAG is turned off</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        The document upload panel is closed. Turn on the "Document Knowledge / RAG" switch above to attach documents and enable vector retrieval.
                      </p>
                    </div>
                  )}
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

              {/* SUB-TAB 5: TOOLS & CAPABILITIES */}
              {activeSubTab === 'tools' && (
                <div className="space-y-4 animate-in fade-in duration-150 flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        Tools & Capabilities
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          {(agent.enabled_tools || []).length} / {availableTools.length} Active
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Equip this agent with practical Python capabilities. Enabled tools are provided to Gemini for autonomous function calling.
                      </p>
                    </div>

                    <a
                      href="/studio?view=tools"
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 self-start sm:self-auto"
                    >
                      <span>Tools Marketplace</span>
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Filter and Search Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                      {['All', 'Documents & Files', 'Data Processing', 'Data Utilities', 'Validation & Utilities', 'Web & Search', 'Gemini AI Tools'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setToolsCategory(cat)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                            toolsCategory === cat
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="relative min-w-[200px]">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter tools..."
                        value={toolsSearch}
                        onChange={(e) => setToolsSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Tools Grid Container with dedicated vertical scrolling */}
                  <div className="overflow-y-auto max-h-[460px] sm:max-h-[500px] pr-1.5 pt-1 pb-3 focus:outline-none">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableTools
                      .filter((t) => {
                        const matchesCat = toolsCategory === 'All' || t.category === toolsCategory;
                        const matchesSearch = !toolsSearch || t.name.toLowerCase().includes(toolsSearch.toLowerCase()) || t.description.toLowerCase().includes(toolsSearch.toLowerCase());
                        return matchesCat && matchesSearch;
                      })
                      .map((tool) => {
                        const isToolAdminDisabled = !tool.is_enabled;
                        const isAgentToolEnabled = (agent.enabled_tools || []).includes(tool.id);

                        return (
                          <div
                            key={tool.id}
                            className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                              isToolAdminDisabled
                                ? 'bg-slate-50/80 border-slate-200 opacity-70'
                                : isAgentToolEnabled
                                ? 'bg-blue-50/40 border-blue-300 shadow-xs ring-1 ring-blue-500/10'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 rounded-lg bg-white border border-slate-100 shadow-2xs">
                                    {tool.icon === 'FileText' && <FileText className="w-4 h-4 text-blue-500" />}
                                    {tool.icon === 'FileSpreadsheet' && <FileSpreadsheet className="w-4 h-4 text-emerald-500" />}
                                    {tool.icon === 'FileJson' && <FileJson className="w-4 h-4 text-amber-500" />}
                                    {tool.icon === 'Calculator' && <Calculator className="w-4 h-4 text-cyan-500" />}
                                    {tool.icon === 'Clock' && <Clock className="w-4 h-4 text-indigo-500" />}
                                    {tool.icon === 'BarChart3' && <BarChart3 className="w-4 h-4 text-violet-500" />}
                                    {tool.icon === 'Link' && <Link className="w-4 h-4 text-sky-500" />}
                                    {tool.icon === 'Sparkles' && <Sparkles className="w-4 h-4 text-teal-500" />}
                                    {tool.icon === 'Copy' && <Copy className="w-4 h-4 text-purple-500" />}
                                    {tool.icon === 'Cpu' && <Cpu className="w-4 h-4 text-pink-500" />}
                                    {tool.icon === 'Search' && <Search className="w-4 h-4 text-blue-600" />}
                                    {tool.icon === 'Globe' && <Globe className="w-4 h-4 text-emerald-600" />}
                                  </div>

                                  <div>
                                    <h4 className="text-xs font-bold text-slate-900 leading-tight">{tool.name}</h4>
                                    <span className="text-[10px] text-slate-400 font-medium">{tool.category}</span>
                                  </div>
                                </div>

                                {/* Enable Switch or Admin Disabled Badge */}
                                {isToolAdminDisabled ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                    <Lock className="w-2.5 h-2.5" />
                                    Disabled by Admin
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
                                    <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                                  </label>
                                )}
                              </div>

                              <p className="text-[11px] text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                                {tool.description}
                              </p>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                              <button
                                type="button"
                                onClick={() => setActiveConfigureTool(tool)}
                                className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1"
                              >
                                <Settings className="w-3 h-3" />
                                <span>Options</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTestTool(tool);
                                  setTestResult(null);
                                  // Seed defaults
                                  if (tool.id === 'calculator') setTestParams({ expression: '45 * 12 + 100' });
                                  else if (tool.id === 'datetime_tool') setTestParams({ operation: 'now' });
                                  else if (tool.id === 'url_validator') setTestParams({ url: 'https://example.com' });
                                  else setTestParams({});
                                }}
                                className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                              >
                                <Play className="w-3 h-3 fill-blue-600" />
                                <span>Test</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                    {agent.status === 'published' && (
                      <button
                        type="button"
                        onClick={handleUnpublish}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-xl text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
                      >
                        Unpublish Agent
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



      {/* Configure Tool Modal */}
      {activeConfigureTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{activeConfigureTool.name}</h3>
                <span className="text-[11px] text-slate-500">Tool Options & Schema</span>
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
                      : 'bg-blue-600 text-white hover:bg-blue-700'
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

      {/* Test Tool Modal */}
      {activeTestTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Test {activeTestTool.name}</h3>
                <span className="text-[11px] text-slate-500">Run sandbox test</span>
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
                      {testResult.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  {testResult.output_preview && (
                    <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono">
                      {testResult.output_preview}
                    </p>
                  )}
                  {testResult.error && (
                    <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200 font-mono">
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
                      execution_time_ms: 0
                    });
                  } finally {
                    setIsExecutingTest(false);
                  }
                }}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                {isExecutingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3 h-3 fill-white" />}
                <span>Execute Test</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
