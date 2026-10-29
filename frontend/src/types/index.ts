export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'creator';
  is_active: boolean;
}

export interface Model {
  id: number;
  provider_id: number;
  provider_name: string;
  model_identifier: string;
  display_name: string;
  is_enabled: boolean;
  context_window: number;
  supports_streaming: boolean;
  supports_rag: boolean;
}

export interface ProviderCredential {
  key_hint: string;
  is_valid: boolean;
  last_tested_at?: string;
  last_error?: string;
}

export interface Provider {
  id: number;
  name: string;
  display_name: string;
  is_configured: boolean;
  credentials?: ProviderCredential;
  models: Model[];
}

export interface Document {
  id: number;
  knowledge_base_id: number;
  filename: string;
  file_type: string;
  file_size: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBase {
  id: number;
  creator_id: number;
  name: string;
  description: string;
  documents: Document[];
  created_at: string;
}

export interface Agent {
  id: number;
  creator_id: number;
  name: string;
  slug: string;
  description: string;
  base_model_id?: number;
  base_model_name?: string;
  provider_name?: string;
  system_instructions: string;
  conversation_starters: string[];
  capability_rag: boolean;
  capability_memory: boolean;
  capability_streaming: boolean;
  status: 'draft' | 'tested' | 'published' | 'unpublished';
  current_version: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicAgent {
  id: number;
  name: string;
  slug: string;
  description: string;
  model_name?: string;
  conversation_starters: string[];
  capability_rag: boolean;
  capability_streaming: boolean;
  created_at: string;
}

export interface Citation {
  source: string;
  page: number;
  score: number;
  snippet: string;
}

export interface Message {
  id?: number;
  conversation_id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  latency_ms?: number;
  token_usage?: number;
  created_at?: string;
}

export interface Conversation {
  id: number;
  agent_id: number;
  title: string;
  is_demo: boolean;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  total_agents: number;
  published_agents: number;
  total_conversations: number;
  total_tokens_used: number;
  estimated_cost: number;
  total_errors: number;
}

export interface UsageStats {
  provider_name: string;
  model_identifier: string;
  total_requests: number;
  total_tokens: number;
  avg_latency_ms: number;
  error_count: number;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details_json?: string;
  ip_address?: string;
  created_at: string;
}
