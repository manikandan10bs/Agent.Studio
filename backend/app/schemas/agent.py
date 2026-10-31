from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field

class AgentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = ""
    base_model_id: Optional[int] = None
    system_instructions: Optional[str] = ""
    conversation_starters: Optional[List[str]] = []
    capability_rag: bool = True
    capability_memory: bool = True
    capability_streaming: bool = True
    enabled_tools: Optional[List[str]] = []
    tools_config: Optional[dict] = {}

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_model_id: Optional[int] = None
    system_instructions: Optional[str] = None
    conversation_starters: Optional[List[str]] = None
    capability_rag: Optional[bool] = None
    capability_memory: Optional[bool] = None
    capability_streaming: Optional[bool] = None
    enabled_tools: Optional[List[str]] = None
    tools_config: Optional[dict] = None

class AgentVersionOut(BaseModel):
    id: int
    version_number: int
    name: str
    description: Optional[str]
    model_identifier: Optional[str]
    system_instructions: Optional[str]
    conversation_starters: Optional[str]
    enabled_tools: Optional[str] = "[]"
    tools_config: Optional[str] = "{}"
    created_at: datetime

    class Config:
        from_attributes = True

class AgentOut(BaseModel):
    id: int
    creator_id: int
    name: str
    slug: str
    description: Optional[str] = ""
    base_model_id: Optional[int] = None
    base_model_name: Optional[str] = None
    provider_name: Optional[str] = None
    system_instructions: Optional[str] = ""
    conversation_starters: List[str] = []
    capability_rag: bool = True
    capability_memory: bool = True
    capability_streaming: bool = True
    enabled_tools: List[str] = []
    tools_config: dict = {}
    status: str = "draft"
    current_version: int = 1
    is_public: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PublicAgentOut(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = ""
    model_name: Optional[str] = None
    conversation_starters: List[str] = []
    capability_rag: bool = True
    capability_streaming: bool = True
    enabled_tools: List[str] = []
    created_at: datetime

    class Config:
        from_attributes = True
