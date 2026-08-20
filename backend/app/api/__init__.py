from fastapi import APIRouter

from app.api import ai, audio, projects, ws

api_router = APIRouter()
api_router.include_router(projects.router)
api_router.include_router(audio.router)
api_router.include_router(ai.router)

__all__ = ["api_router", "ws"]
