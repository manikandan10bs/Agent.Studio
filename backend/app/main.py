import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.core.config import settings
from app.db.session import engine, Base, SessionLocal
from app.db.init_db import init_db
from app.api.v1 import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and seeds
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()
    
    # Ensure upload storage folder exists
    os.makedirs(settings.STORAGE_DIR, exist_ok=True)
    yield

app = FastAPI(
    title="AGENT.STUDIO API",
    description="Enterprise-grade AI Agent Builder Platform with Multi-Provider LLM Gateway and Document RAG",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AGENT.STUDIO Backend",
        "version": "1.0.0"
    }

# Mount Frontend static build if available for seamless unified production hosting
potential_paths = [
    os.getenv("FRONTEND_DIST", ""),
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static"),
    os.path.join(os.getcwd(), "static"),
    os.path.join(os.getcwd(), "frontend", "dist"),
]

frontend_dist = next((p for p in potential_paths if p and os.path.exists(p) and os.path.isdir(p)), None)

if frontend_dist:
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Do not intercept /api routes or FastAPI documentation
        if full_path.startswith("api") or full_path in ["docs", "redoc", "openapi.json"]:
            return None
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
