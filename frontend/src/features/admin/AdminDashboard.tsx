import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudioLayout } from '../../layouts/StudioLayout';
import { api } from '../../services/api';
import {
  DashboardStats,
  Provider,
  User,
  UsageStats,
  AuditLog
} from '../../types';
import {
  Users,
  Cpu,
  BarChart3,
  Key,
  CheckCircle2,
  XCircle,
  RotateCw,
  Plus,
  Copy,
  Check,
  Bot,
  DollarSign,
  AlertTriangle,
  ShieldCheck,
  Shield,
  Lock,
  ExternalLink,
  Loader2,
  Sparkles
} from 'lucide-react';

const PROVIDER_KEY_URLS: Record<string, { label: string; url: string }> = {
  gemini: { label: 'Get Free Gemini Key (AI Studio)', url: 'https://aistudio.google.com/app/apikey' },
  groq: { label: 'Get Free Groq Key (Console)', url: 'https://console.groq.com/keys' },
  openrouter: { label: 'Get OpenRouter Key', url: 'https://openrouter.ai/keys' },
  mistral: { label: 'Get Mistral AI Key', url: 'https://console.mistral.ai/api-keys/' }
};

export const AdminDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as any) || 'providers';
  const [activeTab, setActiveTab] = useState<'providers' | 'overview' | 'users' | 'usage'>(initialTab);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [usage, setUsage] = useState<UsageStats[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Provider key editing state
  const [keyInputs, setKeyInputs] = useState<Record<number, string>>({});
  const [testingProviderId, setTestingProviderId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; msg: string } | null>(null);

  // User invitation modal state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('creator');
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Direct user create state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('creator');

  const loadAllAdminData = async () => {
    try {
      const [statsData, providersData, usersData, usageData, logsData] = await Promise.all([
        api.getAdminDashboard().catch(() => null),
        api.getAdminProviders().catch(() => api.getProvidersStatus()),
        api.getAdminUsers().catch(() => []),
        api.getAdminUsage().catch(() => []),
        api.getAdminAuditLogs().catch(() => []),
      ]);
      if (statsData) setStats(statsData);
      if (providersData) setProviders(providersData);
      setUsers(usersData);
      setUsage(usageData);
      setAuditLogs(logsData);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  const handleSaveProviderKey = async (providerId: number) => {
    const rawKey = keyInputs[providerId]?.trim();
    if (!rawKey) return;
    setTestingProviderId(providerId);
    setTestResult(null);

    try {
      const res = await api.updateProviderCredentials(providerId, rawKey);
      setTestResult({ id: providerId, success: res.success, msg: res.message });
      setKeyInputs((prev) => ({ ...prev, [providerId]: '' }));
      const updated = await api.getAdminProviders();
      setProviders(updated);
    } catch (err: any) {
      setTestResult({ id: providerId, success: false, msg: err.message });
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleTestConnection = async (providerId: number) => {
    setTestingProviderId(providerId);
    setTestResult(null);
    try {
      const res = await api.testProviderConnection(providerId);
      setTestResult({ id: providerId, success: res.success, msg: res.message });
      const updated = await api.getAdminProviders();
      setProviders(updated);
    } catch (err: any) {
      setTestResult({ id: providerId, success: false, msg: err.message });
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleToggleModel = async (modelId: number, currentEnabled: boolean) => {
    try {
      await api.toggleModel(modelId, !currentEnabled);
      const updated = await api.getAdminProviders();
      setProviders(updated);
    } catch (err: any) {
      alert(`Failed to toggle model: ${err.message}`);
    }
  };

  const handleGenerateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    try {
      const res = await api.createInvitation(inviteEmail, inviteRole);
      const fullUrl = `${window.location.origin}${res.invitation_url}`;
      setGeneratedInviteUrl(fullUrl);
      setInviteEmail('');
      loadAllAdminData();
    } catch (err: any) {
      alert(`Failed to create invitation: ${err.message}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newName) return;
    try {
      await api.createAdminUser({
        email: newEmail,
        full_name: newName,
        password: newPassword,
        role: newRole,
      });
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      loadAllAdminData();
      alert('User created successfully');
    } catch (err: any) {
      alert(`User creation failed: ${err.message}`);
    }
  };

  const handleToggleUserActive = async (user: User) => {
    try {
      await api.updateUserStatus(user.id, { is_active: !user.is_active });
      loadAllAdminData();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleToggleUserRole = async (user: User) => {
    const nextRole = user.role === 'admin' ? 'creator' : 'admin';
    const isPromoting = nextRole === 'admin';
    const confirmMsg = isPromoting
      ? `Promote "${user.full_name || user.email}" to Administrator? They will have full access to provider keys, user management, and platform metrics.`
      : `Change "${user.full_name || user.email}" role to Creator? They will only have access to the Creator Studio and Gallery Lobby.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.updateUserStatus(user.id, { role: nextRole });
      loadAllAdminData();
    } catch (err: any) {
      alert(`Failed to update user role: ${err.message}`);
    }
  };

  return (
    <StudioLayout>
      <div className="flex flex-col h-full w-full overflow-y-auto pr-1">
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              Platform Administration
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold tracking-wide uppercase bg-blue-100 text-blue-800 border border-blue-200">
                Admin Console
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Configure provider credentials, approved models, user invitations, and system usage.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-xs">
            <button
              onClick={() => setActiveTab('providers')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'providers'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Providers & Models
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'users'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Users & Invites
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'usage'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Usage & Audit
            </button>
          </div>
        </div>

        {/* TAB 1: PROVIDERS & MODELS */}
        {activeTab === 'providers' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Unified LLM Gateway Configuration</p>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Paste your API key into any provider card below and click <strong>Save &amp; Test</strong>. Keys are verified live and encrypted at rest with AES-256-GCM.
                  </p>
                </div>
              </div>
              <div className="text-[11px] text-blue-700 bg-white/80 px-2.5 py-1 rounded-lg border border-blue-200 font-mono flex items-center gap-1 self-start sm:self-auto flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Zero backend rebuild</span>
              </div>
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <span>{testResult.msg}</span>
                <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-slate-700">
                  ✕
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-blue-600 space-y-2 bg-white rounded-2xl border border-slate-200">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs font-semibold text-slate-600">Loading LLM Gateway providers...</span>
              </div>
            ) : providers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">No Providers Detected</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Unable to load providers from the backend database. Click retry to refresh.
                </p>
                <button
                  onClick={loadAllAdminData}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700"
                >
                  Retry Loading Providers
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {providers.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{p.display_name}</h3>
                          {PROVIDER_KEY_URLS[p.name.toLowerCase()] && (
                            <a
                              href={PROVIDER_KEY_URLS[p.name.toLowerCase()].url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 hover:underline font-medium"
                              title="Get API Key"
                            >
                              <span>Get Key</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {p.name}</p>
                      </div>
                      {p.is_configured ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Needs Key
                        </span>
                      )}
                    </div>

                  {/* Secret Key Input & Encryption */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-800 block">
                      API Credential (Encrypted via AES-256-GCM)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder={p.credentials?.key_hint ? `Configured (${p.credentials.key_hint})` : `Paste ${p.display_name} API key...`}
                        value={keyInputs[p.id] || ''}
                        onChange={(e) =>
                          setKeyInputs({ ...keyInputs, [p.id]: e.target.value })
                        }
                        className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
                      />
                      <button
                        onClick={() => handleSaveProviderKey(p.id)}
                        disabled={testingProviderId === p.id || !keyInputs[p.id]}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-all shadow-xs"
                      >
                        {testingProviderId === p.id ? 'Testing...' : 'Save & Test'}
                      </button>
                      {p.is_configured && (
                        <button
                          onClick={() => handleTestConnection(p.id)}
                          disabled={testingProviderId === p.id}
                          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
                          title="Test Connection"
                        >
                          <RotateCw
                            className={`w-4 h-4 ${
                              testingProviderId === p.id ? 'animate-spin text-blue-600' : ''
                            }`}
                          />
                        </button>
                      )}
                    </div>
                    {p.credentials?.last_tested_at && (
                      <p className="text-[11px] text-slate-500">
                        Last verified: {new Date(p.credentials.last_tested_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Models List & Toggles */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                      Approved Models
                    </span>
                    <div className="space-y-1.5">
                      {p.models.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80"
                        >
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{m.display_name}</p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {m.model_identifier} • {Math.round(m.context_window / 1000)}k context
                            </p>
                          </div>
                          <button
                            onClick={() => handleToggleModel(m.id, m.is_enabled)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                              m.is_enabled
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-200 text-slate-500 border border-slate-300'
                            }`}
                          >
                            {m.is_enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {/* TAB 2: OVERVIEW */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{stats.total_users}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {stats.active_users} active accounts
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Agents Built</span>
                  <Bot className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{stats.total_agents}</div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  {stats.published_agents} published in gallery
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Tokens Processed</span>
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {(stats.total_tokens_used / 1000).toFixed(1)}k
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Across unified gateways
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Est. Platform Cost</span>
                  <DollarSign className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">${stats.estimated_cost}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {stats.total_errors} errors recorded
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: USERS & INVITATIONS */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Generate Invitation Link */}
              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Generate Creator Invitation Link
                </h3>
                <p className="text-xs text-slate-500">
                  Create a secure, single-use invitation link for a new creator or admin.
                </p>

                <form onSubmit={handleGenerateInvitation} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Invitee Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="creator@company.com"
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none"
                    >
                      <option value="creator">Creator (Can build & publish private agents)</option>
                      <option value="admin">Administrator (Full platform permissions)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs"
                  >
                    Generate Invitation
                  </button>
                </form>

                {generatedInviteUrl && (
                  <div className="mt-4 p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                    <span className="text-xs font-semibold text-blue-900 block">
                      Single-Use Invitation URL Ready:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedInviteUrl}
                        className="flex-1 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-700 font-mono shadow-xs"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedInviteUrl);
                          setCopiedInvite(true);
                          setTimeout(() => setCopiedInvite(false), 2000);
                        }}
                        className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
                      >
                        {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Direct Account Creation */}
              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Create Account Directly
                </h3>
                <p className="text-xs text-slate-500">
                  Instantly provision an account with pre-set password.
                </p>

                <form onSubmit={handleCreateUser} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="jane@company.com"
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Initial Password
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xs"
                  >
                    Create User Account
                  </button>
                </form>
              </div>
            </div>

            {/* Users Directory Table */}
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                User Directory ({users.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-900">{u.full_name}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{u.email}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              u.role === 'admin'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              u.is_active
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {u.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                          {u.email === 'manikandan10bs@gmail.com' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <ShieldCheck className="w-3 h-3 text-amber-600" />
                              Super Admin
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleUserRole(u)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                                u.role === 'admin'
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                              title={u.role === 'admin' ? 'Demote to Creator' : 'Promote to Admin'}
                            >
                              <Shield className="w-3 h-3" />
                              <span>{u.role === 'admin' ? 'Demote to Creator' : 'Promote to Admin'}</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleUserActive(u)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                              u.is_active
                                ? 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {u.is_active ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: USAGE & AUDIT LOGS */}
        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Usage By Model Gateway
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2.5 px-3">Provider</th>
                      <th className="py-2.5 px-3">Model</th>
                      <th className="py-2.5 px-3">Requests</th>
                      <th className="py-2.5 px-3">Tokens</th>
                      <th className="py-2.5 px-3">Avg Latency</th>
                      <th className="py-2.5 px-3">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {usage.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-400">
                          No usage recorded yet. Test an agent to log telemetry.
                        </td>
                      </tr>
                    ) : (
                      usage.map((u, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-900 uppercase">
                            {u.provider_name}
                          </td>
                          <td className="py-3 px-3 font-mono text-blue-600 font-medium">
                            {u.model_identifier}
                          </td>
                          <td className="py-3 px-3">{u.total_requests}</td>
                          <td className="py-3 px-3 font-mono">{u.total_tokens}</td>
                          <td className="py-3 px-3">{u.avg_latency_ms} ms</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] ${
                                u.error_count > 0
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'text-slate-500'
                              }`}
                            >
                              {u.error_count}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Logs */}
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                System Audit Trail ({auditLogs.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-blue-600 font-bold">{log.action}</span>
                      <span className="text-slate-600">by {log.user_email || 'System'}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </StudioLayout>
  );
};
