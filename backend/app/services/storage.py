from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import get_settings

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".aiff", ".aif", ".flac", ".ogg", ".m4a"}
ALLOWED_TYPES = {
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/aiff",
    "audio/x-aiff",
    "audio/flac",
    "audio/ogg",
    "audio/mp4",
    "application/octet-stream",
}

settings = get_settings()


def usage_bytes(db: Session, user_id: str) -> int:
    from app.models import AudioFile

    total = db.query(func.coalesce(func.sum(AudioFile.file_size), 0)).filter(AudioFile.user_id == user_id).scalar()
    return int(total or 0)


def save_upload(file: UploadFile, *, used_bytes: int = 0) -> tuple[str, Path, int]:
    suffix = Path(file.filename or "audio.wav").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {suffix}")
    if file.content_type and file.content_type not in ALLOWED_TYPES:
        # Some browsers send empty/unknown types; still allow by extension.
        if file.content_type not in ("application/octet-stream", ""):
            pass

    quota = settings.quota_mb * 1024 * 1024 if settings.quota_mb > 0 else 0
    if quota and used_bytes >= quota:
        raise HTTPException(status_code=413, detail="Storage quota exceeded")

    file_id = str(uuid.uuid4())
    dest_dir = settings.storage_path / file_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"original{suffix}"

    size = 0
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if quota:
        max_bytes = min(max_bytes, max(0, quota - used_bytes))
    with dest.open("wb") as buffer:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > max_bytes:
                buffer.close()
                shutil.rmtree(dest_dir, ignore_errors=True)
                detail = "Storage quota exceeded" if quota and used_bytes + size > quota else "File exceeds upload limit"
                raise HTTPException(status_code=413, detail=detail)
            buffer.write(chunk)

    try:
        from app.services.object_store import upload_file

        upload_file(dest, f"{file_id}/{dest.name}")
    except Exception:
        pass

    return file_id, dest, size


def resolve_audio_path(stored_path: str) -> Path:
    path = Path(stored_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio file missing on disk")
    return path
