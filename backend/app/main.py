from contextlib import asynccontextmanager
from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, ORJSONResponse
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.api import api_router, ws
from app.config import get_settings
from app.database import Base, engine
from app.deps import get_or_create_demo_user
from app.database import SessionLocal

# Import models so metadata is complete.
from app import models  # noqa: F401

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.storage_path.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    from app.services.schema import ensure_schema

    ensure_schema()
    db = SessionLocal()
    try:
        get_or_create_demo_user(db)
        from app.api.presets import ensure_global_presets

        ensure_global_presets(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "ForgeDeck API — project storage, audio analysis, AI producer tools, "
        "and export. Realtime playback is handled in the browser via Web Audio."
    ),
    version="0.1.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

# Honor X-Forwarded-Proto / X-Forwarded-For when behind nginx or a TLS proxy.
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
app.include_router(ws.router)


@app.get("/api/health")
def health():
    return {"ok": True, "app": settings.app_name, "env": settings.app_env}


desktop_ui_path = settings.desktop_ui_path

if desktop_ui_path:

    @app.get("/{path:path}", include_in_schema=False)
    def desktop_ui(path: str):
        """Serve the pre-built React application from the packaged backend."""
        if path.startswith(("api/", "ws/")):
            return ORJSONResponse({"detail": "Not Found"}, status_code=404)
        candidate = (desktop_ui_path / path).resolve()
        if desktop_ui_path in candidate.parents and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(desktop_ui_path / "index.html")

else:

    @app.get("/")
    def root():
        return {
            "name": settings.app_name,
            "docs": "/docs",
            "health": "/api/health",
        }
