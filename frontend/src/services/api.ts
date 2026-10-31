import {
  User,
  Agent,
  Model,
  Provider,
  Document,
  KnowledgeBase,
  Conversation,
  Message,
  DashboardStats,
  UsageStats,
  AuditLog,
  PublicAgent
} from '../types';

const getApiBase = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (!envUrl) return '/api';
  const trimmed = envUrl.trim().replace(/\/+$/, '');
  if (!trimmed.endsWith('/api')) {
    return `${trimmed}/api`;
  }
  return trimmed;
};

const API_BASE = getApiBase();

function getHeaders(isJson = true): HeadersInit {
  const token = localStorage.getItem('agent_studio_token');
  const headers: Record<string, string> = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMessage = `Error ${res.status}: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data.detail) {
        errMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }
  return res.json();
}

export const api = {
  // --- Auth ---
  async login(email: string, password: string): Promise<{ access_token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse<{ access_token: string; user: User }>(res);
    localStorage.setItem('agent_studio_token', data.access_token);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: getHeaders() });
    } finally {
      localStorage.removeItem('agent_studio_token');
    }
  },

  async getCurrentUser(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: getHeaders() });
    return handleResponse<User>(res);
  },

  async getInvitationInfo(token: string): Promise<{ email: string; role: string; is_valid: boolean }> {
    const res = await fetch(`${API_BASE}/auth/invitation-info?token=${encodeURIComponent(token)}`);
    return handleResponse<{ email: string; role: string; is_valid: boolean }>(res);
  },

  async acceptInvitation(token: string, password: string, fullName?: string): Promise<{ access_token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/accept-invitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, full_name: fullName }),
    });
    const data = await handleResponse<{ access_token: string; user: User }>(res);
    localStorage.setItem('agent_studio_token', data.access_token);
    return data;
  },

  // --- Models ---
  async getEnabledModels(): Promise<Model[]> {
    const res = await fetch(`${API_BASE}/models`, { headers: getHeaders() });
    return handleResponse<Model[]>(res);
  },

  async getProvidersStatus(): Promise<Provider[]> {
    const res = await fetch(`${API_BASE}/models/providers-status`, { headers: getHeaders() });
    return handleResponse<Provider[]>(res);
  },

  // --- Agents ---
  async getAgents(): Promise<Agent[]> {
    const res = await fetch(`${API_BASE}/agents`, { headers: getHeaders() });
    return handleResponse<Agent[]>(res);
  },

  async getAgent(id: number): Promise<Agent> {
    const res = await fetch(`${API_BASE}/agents/${id}`, { headers: getHeaders() });
    return handleResponse<Agent>(res);
  },

  async createAgent(data: Partial<Agent>): Promise<Agent> {
    const res = await fetch(`${API_BASE}/agents`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<Agent>(res);
  },

  async updateAgent(id: number, data: Partial<Agent>): Promise<Agent> {
    const res = await fetch(`${API_BASE}/agents/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<Agent>(res);
  },

  async testAgent(id: number): Promise<Agent> {
    const res = await fetch(`${API_BASE}/agents/${id}/test`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<Agent>(res);
  },

  async publishAgent(id: number): Promise<Agent> {
    const res = await fetch(`${API_BASE}/agents/${id}/publish`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<Agent>(res);
  },

  async unpublishAgent(id: number): Promise<Agent> {
    const res = await fetch(`${API_BASE}/agents/${id}/unpublish`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<Agent>(res);
  },

  async deleteAgent(id: number): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/agents/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse<{ message: string }>(res);
  },

  // --- Knowledge & Documents ---
  async getAgentDocuments(agentId: number): Promise<Document[]> {
    const res = await fetch(`${API_BASE}/agents/${agentId}/documents`, { headers: getHeaders() });
    return handleResponse<Document[]>(res);
  },

  async uploadAgentDocument(agentId: number, file: File): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    const headers = getHeaders(false);
    const res = await fetch(`${API_BASE}/agents/${agentId}/documents`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse<Document>(res);
  },

  async deleteDocument(documentId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse<{ message: string }>(res);
  },

  // --- Chat ---
  async sendChat(
    agentId: number,
    message: string,
    conversationId?: number,
    isDemo = true
  ): Promise<{ conversation_id: number; message: Message; citations: any[] }> {
    const res = await fetch(`${API_BASE}/agents/${agentId}/chat?is_demo=${isDemo}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message, conversation_id: conversationId, stream: false }),
    });
    return handleResponse<{ conversation_id: number; message: Message; citations: any[] }>(res);
  },

  async getConversations(agentId?: number, isDemo?: boolean): Promise<Conversation[]> {
    let url = `${API_BASE}/conversations?`;
    if (agentId) url += `agent_id=${agentId}&`;
    if (isDemo !== undefined) url += `is_demo=${isDemo}&`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse<Conversation[]>(res);
  },

  async deleteConversation(conversationId: number): Promise<void> {
    await fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  // --- Public Gallery ---
  async getPublicAgents(query?: string): Promise<PublicAgent[]> {
    let url = `${API_BASE}/public/agents`;
    if (query) url += `?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    return handleResponse<PublicAgent[]>(res);
  },

  async getPublicAgent(slug: string): Promise<PublicAgent> {
    const res = await fetch(`${API_BASE}/public/agents/${slug}`);
    return handleResponse<PublicAgent>(res);
  },

  async sendPublicChat(
    slug: string,
    message: string,
    conversationId?: number
  ): Promise<{ conversation_id: number; message: Message; citations: any[] }> {
    const res = await fetch(`${API_BASE}/public/agents/${slug}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversation_id: conversationId, stream: false }),
    });
    return handleResponse<{ conversation_id: number; message: Message; citations: any[] }>(res);
  },

  // --- Admin ---
  async getAdminDashboard(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/admin/dashboard`, { headers: getHeaders() });
    return handleResponse<DashboardStats>(res);
  },

  async getAdminProviders(): Promise<Provider[]> {
    const res = await fetch(`${API_BASE}/admin/providers`, { headers: getHeaders() });
    return handleResponse<Provider[]>(res);
  },

  async updateProviderCredentials(providerId: number, apiKey: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/providers/${providerId}/credentials`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ api_key: apiKey }),
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  async testProviderConnection(providerId: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/providers/${providerId}/test`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  async toggleModel(modelId: number, isEnabled: boolean): Promise<Model> {
    const res = await fetch(`${API_BASE}/admin/models/${modelId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ is_enabled: isEnabled }),
    });
    return handleResponse<Model>(res);
  },

  async getAdminUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/admin/users`, { headers: getHeaders() });
    return handleResponse<User[]>(res);
  },

  async createAdminUser(data: { email: string; full_name: string; password: string; role: string }): Promise<User> {
    const res = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<User>(res);
  },

  async createInvitation(email: string, role = 'creator'): Promise<{ invitation_url: string; email: string }> {
    const res = await fetch(`${API_BASE}/admin/invitations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, role }),
    });
    return handleResponse<{ invitation_url: string; email: string }>(res);
  },

  async updateUserStatus(userId: number, data: { is_active?: boolean; role?: string }): Promise<User> {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<User>(res);
  },

  async getAdminUsage(): Promise<UsageStats[]> {
    const res = await fetch(`${API_BASE}/admin/usage`, { headers: getHeaders() });
    return handleResponse<UsageStats[]>(res);
  },

  async getAdminAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, { headers: getHeaders() });
    return handleResponse<AuditLog[]>(res);
  },

  // --- 12 Core System Tools API ---
  async getTools(category?: string, search?: string): Promise<import('../types').SystemTool[]> {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (search && search.trim()) params.append('search', search.trim());
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/tools${query}`, { headers: getHeaders() });
    return handleResponse<import('../types').SystemTool[]>(res);
  },

  async toggleTool(toolId: string, is_enabled: boolean): Promise<import('../types').SystemTool> {
    const res = await fetch(`${API_BASE}/tools/${toolId}/toggle`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ is_enabled }),
    });
    return handleResponse<import('../types').SystemTool>(res);
  },

  async testTool(toolId: string, parameters: Record<string, any>): Promise<import('../types').ToolExecutionResult> {
    const res = await fetch(`${API_BASE}/tools/${toolId}/test`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ tool_id: toolId, parameters }),
    });
    return handleResponse<import('../types').ToolExecutionResult>(res);
  },

  async uploadToolTestFile(file: File): Promise<{ filename: string; original_filename: string; file_size: number; file_path: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('agent_studio_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/tools/upload-test-file`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse<{ filename: string; original_filename: string; file_size: number; file_path: string }>(res);
  },
};
