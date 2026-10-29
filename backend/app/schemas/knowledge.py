from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

class DocumentOut(BaseModel):
    id: int
    knowledge_base_id: int
    filename: str
    file_type: str
    file_size: int
    status: str
    error_message: Optional[str] = None
    chunk_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class KnowledgeBaseCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class KnowledgeBaseOut(BaseModel):
    id: int
    creator_id: int
    name: str
    description: Optional[str] = ""
    documents: List[DocumentOut] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
