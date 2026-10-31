from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from app.db.session import Base

def utcnow():
    return datetime.now(timezone.utc)

class SystemTool(Base):
    __tablename__ = "system_tools"

    id = Column(String(50), primary_key=True)  # e.g. "pdf_extractor"
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)  # "Documents & Files", "Data Processing", etc.
    icon = Column(String(50), default="Wrench")
    is_enabled = Column(Boolean, default=True)  # Administrator global toggle
    config_schema = Column(Text, default="{}")  # JSON schema for configuration options
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class ToolExecutionLog(Base):
    __tablename__ = "tool_execution_logs"

    id = Column(Integer, primary_key=True, index=True)
    tool_id = Column(String(50), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True)
    input_params_json = Column(Text, nullable=True)
    output_summary_json = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, default=0)
    status = Column(String(20), default="success")  # "success", "failed"
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
