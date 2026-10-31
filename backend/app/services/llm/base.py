from abc import ABC, abstractmethod
from typing import List, Optional, AsyncGenerator, Tuple, Dict, Any
from pydantic import BaseModel, Field

class LLMMessage(BaseModel):
    role: str  # 'system', 'user', 'assistant'
    content: str

class LLMUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

class LLMResponse(BaseModel):
    content: str
    usage: LLMUsage = Field(default_factory=LLMUsage)
    model: str
    latency_ms: int = 0
    tool_calls: Optional[List[Dict[str, Any]]] = None
    raw_parts: Optional[List[Dict[str, Any]]] = None

class LLMStreamChunk(BaseModel):
    delta: str = ""
    is_done: bool = False
    usage: Optional[LLMUsage] = None
    error: Optional[str] = None

class BaseLLMAdapter(ABC):
    def __init__(self, api_key: str):
        self.api_key = api_key

    @abstractmethod
    async def generate(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        """Generate a complete chat response."""
        pass

    @abstractmethod
    async def generate_stream(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        """Stream a chat response yielding incremental tokens."""
        pass

    @abstractmethod
    async def test_connection(self) -> Tuple[bool, str]:
        """Test API key validity and return (is_valid, message_or_error)."""
        pass
