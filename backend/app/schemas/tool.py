from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class ToolOut(BaseModel):
    id: str
    name: str
    description: str
    category: str
    icon: str
    is_enabled: bool
    config_schema: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ToolToggleRequest(BaseModel):
    is_enabled: bool

class ToolTestRequest(BaseModel):
    tool_id: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)

class ToolExecutionResult(BaseModel):
    success: bool
    tool_id: str
    data: Optional[Any] = None
    error: Optional[str] = None
    execution_time_ms: int = 0
    download_url: Optional[str] = None
    output_preview: Optional[str] = None

class ToolExecutionLogOut(BaseModel):
    id: int
    tool_id: str
    agent_id: Optional[int] = None
    status: str
    execution_time_ms: int
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
