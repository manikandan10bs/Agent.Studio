from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

class ModelOut(BaseModel):
    id: int
    provider_id: int
    provider_name: str
    model_identifier: str
    display_name: str
    is_enabled: bool
    context_window: int
    supports_streaming: bool
    supports_rag: bool

    class Config:
        from_attributes = True

class ModelToggle(BaseModel):
    is_enabled: bool

class ProviderCredentialCreate(BaseModel):
    api_key: str

class ProviderCredentialOut(BaseModel):
    key_hint: str
    is_valid: bool
    last_tested_at: Optional[datetime] = None
    last_error: Optional[str] = None

class ProviderOut(BaseModel):
    id: int
    name: str
    display_name: str
    is_configured: bool
    credentials: Optional[ProviderCredentialOut] = None
    models: List[ModelOut] = []

    class Config:
        from_attributes = True

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
