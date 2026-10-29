from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Table
from sqlalchemy.orm import relationship
from app.db.session import Base

def utcnow():
    return datetime.now(timezone.utc)

# Association table between Agent and KnowledgeBase
agent_knowledge_base = Table(
    "agent_knowledge_bases",
    Base.metadata,
    Column("agent_id", Integer, ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True),
    Column("knowledge_base_id", Integer, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), primary_key=True),
)

class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(120), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True, default="")
    base_model_id = Column(Integer, ForeignKey("models.id"), nullable=True)
    system_instructions = Column(Text, nullable=True, default="")
    conversation_starters = Column(Text, nullable=True, default="[]")  # JSON array string
    
    # Core capabilities
    capability_rag = Column(Boolean, default=True)
    capability_memory = Column(Boolean, default=True)
    capability_streaming = Column(Boolean, default=True)

    status = Column(String(20), default="draft")  # 'draft', 'tested', 'published', 'unpublished'
    current_version = Column(Integer, default=1)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    creator = relationship("User", back_populates="agents")
    base_model = relationship("Model", back_populates="agents")
    versions = relationship("AgentVersion", back_populates="agent", cascade="all, delete-orphan", order_by="desc(AgentVersion.version_number)")
    knowledge_bases = relationship("KnowledgeBase", secondary=agent_knowledge_base, back_populates="agents")
    conversations = relationship("Conversation", back_populates="agent", cascade="all, delete-orphan")

class AgentVersion(Base):
    __tablename__ = "agent_versions"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    model_identifier = Column(String(100), nullable=True)
    system_instructions = Column(Text, nullable=True)
    conversation_starters = Column(Text, nullable=True)
    capabilities = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime(timezone=True), default=utcnow)

    agent = relationship("Agent", back_populates="versions")
