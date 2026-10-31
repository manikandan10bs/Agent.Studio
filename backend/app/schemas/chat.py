from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    stream: bool = False

class CitationOut(BaseModel):
    source: str
    page: int
    score: float
    snippet: str

class ToolExecutionInfo(BaseModel):
    tool_id: str
    tool_name: str
    args: Dict[str, Any] = {}
    success: bool = True
    output_preview: Optional[str] = None
    download_url: Optional[str] = None

class MessageOut(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str
    citations: List[CitationOut] = []
    tools: List[ToolExecutionInfo] = []
    latency_ms: Optional[int] = None
    token_usage: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationOut(BaseModel):
    id: int
    agent_id: int
    title: str
    is_demo: bool
    created_at: datetime
    updated_at: datetime
    messages: List[MessageOut] = []

    class Config:
        from_attributes = True

class ChatResponse(BaseModel):
    conversation_id: int
    message: MessageOut
    citations: List[CitationOut] = []
    tools: List[ToolExecutionInfo] = []
