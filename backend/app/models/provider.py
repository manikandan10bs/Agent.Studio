from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.session import Base

def utcnow():
    return datetime.now(timezone.utc)

class Provider(Base):
    __tablename__ = "providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)  # 'gemini', 'groq', 'openrouter', 'mistral'
    display_name = Column(String(100), nullable=False)
    is_configured = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    credentials = relationship("ProviderCredential", back_populates="provider", uselist=False, cascade="all, delete-orphan")
    models = relationship("Model", back_populates="provider", cascade="all, delete-orphan")

class ProviderCredential(Base):
    __tablename__ = "provider_credentials"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id"), unique=True, nullable=False)
    encrypted_api_key = Column(Text, nullable=False)
    key_hint = Column(String(20), nullable=False)  # e.g. "sk-...ab12"
    is_valid = Column(Boolean, default=True)
    last_tested_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    provider = relationship("Provider", back_populates="credentials")

class Model(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id"), nullable=False)
    model_identifier = Column(String(100), unique=True, index=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    is_enabled = Column(Boolean, default=True)
    context_window = Column(Integer, default=128000)
    supports_streaming = Column(Boolean, default=True)
    supports_rag = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    provider = relationship("Provider", back_populates="models")
    agents = relationship("Agent", back_populates="base_model")
