"""Public share links for a mix — no login required to listen."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, RenderJob
from fastapi import Depends

router = APIRouter(prefix="/share", tags=["share"])


@router.get("/{token}")
def get_share(token: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.share_token == token).one_or_none()
    if not project or not project.share_token:
        raise HTTPException(404, "Share not found")
    job = (
        db.query(RenderJob)
        .filter(RenderJob.project_id == project.id, RenderJob.status == "done")
        .order_by(RenderJob.created_at.desc())
        .first()
    )
    return {
        "name": project.name,
        "bpm": project.bpm,
        "musical_key": project.musical_key,
        "has_mix": bool(job and job.output_path),
        "token": token,
    }


@router.get("/{token}/mix")
def get_share_mix(token: str, db: Session = Depends(get_db)):
    from pathlib import Path

    project = db.query(Project).filter(Project.share_token == token).one_or_none()
    if not project:
        raise HTTPException(404, "Share not found")
    job = (
        db.query(RenderJob)
        .filter(RenderJob.project_id == project.id, RenderJob.status == "done")
        .order_by(RenderJob.created_at.desc())
        .first()
    )
    if not job or not job.output_path:
        raise HTTPException(404, "No mix exported yet — Bounce or Rec in the studio first")
    path = Path(job.output_path)
    if not path.exists():
        raise HTTPException(404, "Mix file missing")
    return FileResponse(path, media_type="audio/wav", filename=f"{project.name}.wav")
