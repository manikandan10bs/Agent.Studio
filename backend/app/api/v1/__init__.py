from fastapi import APIRouter
from app.api.v1 import auth, models, agents, knowledge, chat, public, admin

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(knowledge.router, tags=["knowledge"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(public.router, prefix="/public", tags=["public"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
