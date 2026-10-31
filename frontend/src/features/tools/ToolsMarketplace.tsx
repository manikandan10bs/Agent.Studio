import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';
import { SystemTool, ToolExecutionResult } from '../../types';
import {
  FileText,
  FileSpreadsheet,
  FileJson,
  Calculator,
  Clock,
  BarChart3,
  Link,
  Sparkles,
  Copy,
  Cpu,
  Search,
  Globe,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Play,
  Settings,
  Download,
  Loader2,
  X,
  UploadCloud,
  ExternalLink,
  Info,
  ShieldCheck,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';

const CATEGORIES = [
  'All',
  'Documents & Files',
  'Data Processing',
  'Data Utilities',
  'Validation & Utilities',
  'Web & Search',
  'Gemini AI Tools'
] as const;

export const ToolsMarketplace: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tools, setTools] = useState<SystemTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Modal States
  const [activeConfigureTool, setActiveConfigureTool] = useState<SystemTool | null>(null);
  const [activeTestTool, setActiveTestTool] = useState<SystemTool | null>(null);

  // Test Modal Execution State
  const [testParams, setTestParams] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [testResult, setTestResult] = useState<ToolExecutionResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const loadTools = async () => {
    try {
      setLoading(true);
      const list = await api.getTools(selectedCategory, searchQuery);
      setTools(list);
    } catch (err: any) {
      console.error('Failed to load tools:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTools();
  };

  const handleToggleTool = async (tool: SystemTool) => {
    if (!isAdmin) return;
    setTogglingId(tool.id);
    try {
      const updated = await api.toggleTool(tool.id, !tool.is_enabled);
      setTools((prev) => prev.map((t) => (t.id === tool.id ? updated : t)));
    } catch (err: any) {
      alert(`Could not toggle tool: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const getToolIcon = (iconName: string) => {
    switch (iconName) {
      case 'FileText': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'FileSpreadsheet': return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
      case 'FileJson': return <FileJson className="w-5 h-5 text-amber-500" />;
      case 'Calculator': return <Calculator className="w-5 h-5 text-cyan-500" />;
      case 'Clock': return <Clock className="w-5 h-5 text-indigo-500" />;
      case 'BarChart3': return <BarChart3 className="w-5 h-5 text-violet-500" />;
      case 'Link': return <Link className="w-5 h-5 text-sky-500" />;
      case 'Sparkles': return <Sparkles className="w-5 h-5 text-teal-500" />;
      case 'Copy': return <Copy className="w-5 h-5 text-purple-500" />;
      case 'Cpu': return <Cpu className="w-5 h-5 text-pink-500" />;
      case 'Search': return <Search className="w-5 h-5 text-blue-600" />;
      case 'Globe': return <Globe className="w-5 h-5 text-emerald-600" />;
      default: return <Settings className="w-5 h-5 text-blue-500" />;
    }
  };

  const openTestModal = (tool: SystemTool) => {
    setActiveTestTool(tool);
    setTestResult(null);
    setUploadedFileName(null);

    // Seed sensible defaults for testing
    if (tool.id === 'calculator') {
      setTestParams({ expression: '25% of 200 + sqrt(144)' });
    } else if (tool.id === 'datetime_tool') {
      setTestParams({ operation: 'now', timezone: 'UTC' });
    } else if (tool.id === 'url_validator') {
      setTestParams({ url: 'https://example.com', check_accessibility: true });
    } else if (tool.id === 'json_parser') {
      setTestParams({
        json_data: JSON.stringify({
          agent: { name: 'Precision Assistant', version: '2.0', status: 'active' },
          tools_enabled: 12
        }, null, 2),
        operation: 'validate',
        path: 'agent.name'
      });
    } else if (tool.id === 'csv_processor') {
      setTestParams({
        csv_content: "id,name,role,department\n1,Alice,Engineer,Core\n2,Bob,Designer,Product\n3,Charlie,Architect,Infra",
        operation: 'filter',
        column: 'department',
        filter_value: 'Core'
      });
    } else if (tool.id === 'data_cleaner') {
      setTestParams({
        csv_content: " Full Name , Age , City \n John Doe , 30 , New York \n John Doe , 30 , New York \nJane Smith, 25, London",
        remove_duplicates: true,
        normalize_whitespace: true,
        standardize_column_names: true
      });
    } else if (tool.id === 'duplicate_finder') {
      setTestParams({
        csv_content: "SKU,Product,Price\nA100,Widget,25\nA100,Widget,25\nB200,Gadget,40\nC300,Device,90",
      });
    } else if (tool.id === 'chart_generator') {
      setTestParams({
        chart_type: 'bar',
        title: 'Quarterly Revenue Performance ($M)',
        x_field: 'Quarter',
        y_field: 'Revenue',
        data: JSON.stringify([
          { Quarter: 'Q1', Revenue: 18.5 },
          { Quarter: 'Q2', Revenue: 24.2 },
          { Quarter: 'Q3', Revenue: 21.0 },
          { Quarter: 'Q4', Revenue: 35.8 }
        ], null, 2)
      });
    } else if (tool.id === 'web_search') {
      setTestParams({ query: 'fastapi python tutorial', max_results: 3 });
    } else if (tool.id === 'web_fetch') {
      setTestParams({ url: 'https://example.com', max_characters: 2000 });
    } else if (tool.id === 'text_summarizer') {
      setTestParams({
        text: 'AGENT.STUDIO is an enterprise platform for autonomous precision AI agents. It provides a modular 12-core tool catalog, multi-provider model routing across Google Gemini, GroqCloud, OpenRouter, and Mistral, and integrated retrieval-augmented generation. Security governance ensures loopback and private IP SSRF attacks are prevented and data operations are processed within sandboxed local runtimes.',
        style: 'medium',
        include_key_points: true,
        include_action_items: true
      });
    } else {
      setTestParams({});
    }
  };

  const handleExecuteTest = async () => {
    if (!activeTestTool) return;
    setIsExecuting(true);
    setTestResult(null);

    try {
      const payload: Record<string, any> = { ...testParams };
      // If chart data is stringified JSON, parse it
      if (activeTestTool.id === 'chart_generator' && typeof payload.data === 'string') {
        try {
          payload.data = JSON.parse(payload.data);
        } catch {
          // ignore
        }
      }

      const res = await api.testTool(activeTestTool.id, payload);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        tool_id: activeTestTool.id,
        error: err.message || 'Execution failed',
        execution_time_ms: 0
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingFile(true);
    try {
      const uploaded = await api.uploadToolTestFile(file);
      setUploadedFileName(uploaded.original_filename);
      setTestParams((prev) => ({
        ...prev,
        file_path: uploaded.filename
      }));
    } catch (err: any) {
      alert(`File upload failed: ${err.message}`);
    } finally {
      setIsUploadingFile(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F4F7FB] overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-5 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                Core Catalog
              </span>
              <span className="text-xs text-slate-400">• 12 Standard Tools</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">Tools Marketplace</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Production-engineered tools for document extraction, tabular analysis, mathematical calculations, chart generation, and Gemini AI.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTools}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative min-w-[260px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search 12 tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </form>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="p-6 flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-xs">Loading tools catalog...</span>
          </div>
        ) : tools.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No tools found</h3>
            <p className="text-xs text-slate-500 mt-1">Try clearing your search query or selecting a different category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="rounded-2xl bg-white border border-slate-200/90 hover:border-blue-300 shadow-xs hover:shadow-md transition-all flex flex-col p-5"
              >
                {/* Card Top: Icon, Name, Category */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0">
                      {getToolIcon(tool.icon)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{tool.name}</h3>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                        {tool.category}
                      </span>
                    </div>
                  </div>

                  {/* Availability Badge */}
                  <div className="flex items-center">
                    {tool.is_enabled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        Disabled
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 mt-3 line-clamp-3 leading-relaxed flex-1">
                  {tool.description}
                </p>

                {/* Action Buttons & Admin Toggle */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openTestModal(tool)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>Test Tool</span>
                    </button>

                    <button
                      onClick={() => setActiveConfigureTool(tool)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                    >
                      <Settings className="w-3 h-3 text-slate-500" />
                      <span>Configure</span>
                    </button>
                  </div>

                  {/* Admin Global Toggle */}
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Admin:</span>
                      <button
                        type="button"
                        onClick={() => handleToggleTool(tool)}
                        disabled={togglingId === tool.id}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          tool.is_enabled ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            tool.is_enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CONFIGURE MODAL */}
      {activeConfigureTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50">
                  {getToolIcon(activeConfigureTool.icon)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{activeConfigureTool.name}</h3>
                  <span className="text-[11px] text-slate-500">Tool Configuration & Schema</span>
                </div>
              </div>
              <button
                onClick={() => setActiveConfigureTool(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Description</span>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed">{activeConfigureTool.description}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Category</span>
                <div className="mt-1">
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                    {activeConfigureTool.category}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Input Schema & Parameters</span>
                <pre className="mt-1.5 p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-56">
                  {JSON.stringify(activeConfigureTool.config_schema || {}, null, 2)}
                </pre>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-800">Global Admin Availability</h4>
                  <p className="text-[11px] text-slate-500">
                    {activeConfigureTool.is_enabled ? 'Enabled globally for all creators' : 'Disabled globally'}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleToggleTool(activeConfigureTool)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      activeConfigureTool.is_enabled
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {activeConfigureTool.is_enabled ? 'Disable Tool' : 'Enable Tool'}
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setActiveConfigureTool(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEST TOOL MODAL */}
      {activeTestTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50">
                  {getToolIcon(activeTestTool.icon)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Test {activeTestTool.name}</h3>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {activeTestTool.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Interactive execution environment</p>
                </div>
              </div>

              <button
                onClick={() => setActiveTestTool(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Tool Parameters Form */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Input Parameters
                </span>

                {/* Calculator Input */}
                {activeTestTool.id === 'calculator' && (
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">Mathematical Expression</label>
                    <input
                      type="text"
                      value={testParams.expression || ''}
                      onChange={(e) => setTestParams({ ...testParams, expression: e.target.value })}
                      placeholder="e.g. 25% of 200 + sqrt(144) or (350 * 1.5)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-2 mt-2">
                      {['15% of 300', 'sqrt(256) + 2**4', '1500 / 12'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setTestParams({ expression: preset })}
                          className="text-[10px] font-mono bg-slate-100 hover:bg-blue-50 hover:text-blue-600 px-2 py-0.5 rounded-md transition-colors"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Date & Time Input */}
                {activeTestTool.id === 'datetime_tool' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 block mb-1">Operation</label>
                        <select
                          value={testParams.operation || 'now'}
                          onChange={(e) => setTestParams({ ...testParams, operation: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
                        >
                          <option value="now">Current Time (now)</option>
                          <option value="diff">Date Difference</option>
                          <option value="add_subtract">Add / Subtract Units</option>
                          <option value="convert_tz">Timezone Conversion</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 block mb-1">Timezone</label>
                        <input
                          type="text"
                          value={testParams.timezone || 'UTC'}
                          onChange={(e) => setTestParams({ ...testParams, timezone: e.target.value })}
                          placeholder="UTC, America/New_York, Asia/Kolkata"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {testParams.operation === 'diff' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-600 block mb-1">Date 1</label>
                          <input
                            type="text"
                            value={testParams.date1 || '2026-01-01'}
                            onChange={(e) => setTestParams({ ...testParams, date1: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 block mb-1">Date 2</label>
                          <input
                            type="text"
                            value={testParams.date2 || '2026-05-15'}
                            onChange={(e) => setTestParams({ ...testParams, date2: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* URL Validator Input */}
                {activeTestTool.id === 'url_validator' && (
                  <div className="space-y-2">
                    <label className="text-xs text-slate-600 block mb-1">Target URL</label>
                    <input
                      type="text"
                      value={testParams.url || ''}
                      onChange={(e) => setTestParams({ ...testParams, url: e.target.value })}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={testParams.check_accessibility ?? true}
                        onChange={(e) => setTestParams({ ...testParams, check_accessibility: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-600">Check live public reachability (with strict SSRF protection)</span>
                    </label>
                  </div>
                )}

                {/* JSON Parser Input */}
                {activeTestTool.id === 'json_parser' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-600 block mb-1">JSON Data</label>
                      <textarea
                        rows={6}
                        value={testParams.json_data || ''}
                        onChange={(e) => setTestParams({ ...testParams, json_data: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 block mb-1">Extract Path (optional dot notation)</label>
                      <input
                        type="text"
                        value={testParams.path || ''}
                        onChange={(e) => setTestParams({ ...testParams, path: e.target.value })}
                        placeholder="e.g. agent.name"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Tabular Tools: CSV Processor, Cleaner, Duplicate, Chart */}
                {['csv_processor', 'data_cleaner', 'duplicate_finder'].includes(activeTestTool.id) && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-600">CSV Data or Upload File</label>
                        <label className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer font-semibold flex items-center gap-1">
                          <UploadCloud className="w-3 h-3" />
                          <span>Upload File</span>
                          <input type="file" accept=".csv,.xlsx" onChange={handleFileUpload} className="hidden" />
                        </label>
                      </div>
                      {uploadedFileName ? (
                        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center justify-between">
                          <span>Attached: <strong>{uploadedFileName}</strong></span>
                          <button onClick={() => { setUploadedFileName(null); setTestParams({ ...testParams, file_path: '' }); }} className="text-blue-600 hover:text-blue-800">✕</button>
                        </div>
                      ) : (
                        <textarea
                          rows={5}
                          value={testParams.csv_content || ''}
                          onChange={(e) => setTestParams({ ...testParams, csv_content: e.target.value })}
                          placeholder="Paste CSV rows here..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Chart Generator */}
                {activeTestTool.id === 'chart_generator' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 block mb-1">Chart Type</label>
                        <select
                          value={testParams.chart_type || 'bar'}
                          onChange={(e) => setTestParams({ ...testParams, chart_type: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                        >
                          <option value="bar">Bar Chart</option>
                          <option value="line">Line Chart</option>
                          <option value="pie">Pie Chart</option>
                          <option value="scatter">Scatter Plot</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 block mb-1">X Column</label>
                        <input
                          type="text"
                          value={testParams.x_field || 'Quarter'}
                          onChange={(e) => setTestParams({ ...testParams, x_field: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 block mb-1">Y Column</label>
                        <input
                          type="text"
                          value={testParams.y_field || 'Revenue'}
                          onChange={(e) => setTestParams({ ...testParams, y_field: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-600 block mb-1">Data (JSON array of records)</label>
                      <textarea
                        rows={4}
                        value={typeof testParams.data === 'string' ? testParams.data : JSON.stringify(testParams.data, null, 2)}
                        onChange={(e) => setTestParams({ ...testParams, data: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Text Summarizer */}
                {activeTestTool.id === 'text_summarizer' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-600 block mb-1">Text to Summarize</label>
                      <textarea
                        rows={5}
                        value={testParams.text || ''}
                        onChange={(e) => setTestParams({ ...testParams, text: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs leading-relaxed focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 block mb-1">Summary Depth</label>
                        <select
                          value={testParams.style || 'medium'}
                          onChange={(e) => setTestParams({ ...testParams, style: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                        >
                          <option value="short">Short (concise 1-2 paragraphs)</option>
                          <option value="medium">Medium (standard executive summary)</option>
                          <option value="detailed">Detailed (in-depth overview)</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-4 pt-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={testParams.include_key_points ?? true}
                            onChange={(e) => setTestParams({ ...testParams, include_key_points: e.target.checked })}
                            className="rounded text-blue-600"
                          />
                          <span className="text-xs text-slate-700">Key Points</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={testParams.include_action_items ?? true}
                            onChange={(e) => setTestParams({ ...testParams, include_action_items: e.target.checked })}
                            className="rounded text-blue-600"
                          />
                          <span className="text-xs text-slate-700">Action Items</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Document File Tools (PDF, DOCX, XLSX) */}
                {['pdf_extractor', 'docx_reader', 'excel_processor'].includes(activeTestTool.id) && (
                  <div className="space-y-3">
                    <label className="text-xs text-slate-600 block">Select Document to Test</label>
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl bg-slate-50 cursor-pointer">
                      <input
                        type="file"
                        accept={activeTestTool.id === 'pdf_extractor' ? '.pdf' : activeTestTool.id === 'docx_reader' ? '.docx' : '.xlsx,.xls'}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <UploadCloud className="w-6 h-6 text-blue-600 mb-1" />
                      <span className="text-xs font-semibold text-slate-800">
                        {isUploadingFile ? 'Uploading file...' : uploadedFileName ? `Attached: ${uploadedFileName}` : 'Click to select sample file'}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Execution Results */}
              {testResult && (
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Execution Output
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Latency: {testResult.execution_time_ms}ms
                    </span>
                  </div>

                  {testResult.success ? (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{testResult.output_preview || 'Tool executed successfully.'}</span>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Execution Error:</strong> {testResult.error || 'Operation failed'}
                      </div>
                    </div>
                  )}

                  {/* Generated Chart Preview */}
                  {testResult.data?.base64_image && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center">
                      <img
                        src={testResult.data.base64_image}
                        alt="Generated Chart"
                        className="max-h-64 object-contain rounded-lg border border-slate-200 shadow-xs"
                      />
                    </div>
                  )}

                  {/* Download Link if available */}
                  {testResult.download_url && (
                    <div>
                      <a
                        href={testResult.download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Processed File</span>
                      </a>
                    </div>
                  )}

                  {/* Data Payload Viewer */}
                  {testResult.data && (
                    <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-56">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveTestTool(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleExecuteTest}
                disabled={isExecuting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Running Tool...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Execute Test</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
