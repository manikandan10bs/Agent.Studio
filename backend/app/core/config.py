import os
from typing import List, Optional, Union
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AGENT.STUDIO"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "agent-studio-super-secret-jwt-key-2026-production-ready"
    ENCRYPTION_MASTER_KEY: str = "agent-studio-master-encryption-key-32-chars!!"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    INVITATION_TOKEN_EXPIRE_HOURS: int = 72  # 3 days
    
    # Database
    DATABASE_URL: str = "sqlite:///./agent_studio.db"
    
    # Upload storage directory
    STORAGE_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
    
    # Optional Production Frontend Domain
    FRONTEND_URL: Optional[str] = None

    # Supabase (Optional persistent document storage & PostgreSQL)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "agent-documents"

    # Firebase & Google Cloud
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None
    FIREBASE_CREDENTIALS_JSON: Optional[str] = None
    USE_FIRESTORE: bool = True

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]
    CORS_ORIGINS: Optional[str] = None

    # Default Seed Administrator
    DEFAULT_ADMIN_EMAIL: str = "manikandan10bs@gmail.com"
    DEFAULT_ADMIN_PASSWORD: str = "Admin@Studio2026"
    DEFAULT_ADMIN_NAME: str = "Platform Administrator"

    # Provider API Keys (optional in .env, seamlessly auto-synced to encrypted DB)
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    MISTRAL_API_KEY: Optional[str] = None

    class Config:
        env_file = (
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), ".env"),
            ".env"
        )
        case_sensitive = True
        extra = "allow"

settings = Settings()
