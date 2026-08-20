from fastapi import APIRouter

from app.api import ai, audio, auth, presets, projects, share, system, ws

api_router = APIRouter()
api_router.include_router(projects.router)
api_router.include_router(audio.router)
api_router.include_router(ai.router)
api_router.include_router(auth.router)
api_router.include_router(presets.router)
api_router.include_router(share.router)
api_router.include_router(system.router)

__all__ = ["api_router", "ws"]
