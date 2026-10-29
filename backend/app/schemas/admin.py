from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    total_agents: int
    published_agents: int
    total_conversations: int
    total_tokens_used: int
    estimated_cost: float
    total_errors: int

class UsageStats(BaseModel):
    provider_name: str
    model_identifier: str
    total_requests: int
    total_tokens: int
    avg_latency_ms: float
    error_count: int

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details_json: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
