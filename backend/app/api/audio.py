from __future__ import annotations

import threading
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal, get_db
from app.deps import get_current_user
from app.models import AudioFile, User
from app.schemas import AudioFileOut, CuePointCreate, CuePointOut, LoopCreate, LoopOut
from app.services.analysis import analyze_file, persist_analysis
from app.services.storage import save_upload, usage_bytes

router = APIRouter(prefix="/audio", tags=["audio"])
settings = get_settings()


def _enqueue_analysis(audio_id: str) -> None:
    if settings.use_celery:
        try:
            from workers.tasks.analyze import analyze_audio_task

            analyze_audio_task.delay(audio_id)
            return
        except Exception:
            pass
    thread = threading.Thread(target=_run_analysis, args=(audio_id,), daemon=True)
    thread.start()


def _run_analysis(audio_id: str) -> None:
    db = SessionLocal()
    try:
        audio = db.get(AudioFile, audio_id)
        if not audio:
            return
        audio.analysis_status = "processing"
        db.commit()
        result = analyze_file(audio.path)
        persist_analysis(db, audio, result)
    except Exception as exc:
        audio = db.get(AudioFile, audio_id)
        if audio:
            audio.analysis_status = "error"
            audio.error_message = str(exc)
            db.commit()
    finally:
        db.close()


@router.post("/upload", response_model=AudioFileOut)
async def upload_audio(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    file_id, path, size = save_upload(file, used_bytes=usage_bytes(db, user.id))
    audio = AudioFile(
        id=file_id,
        user_id=user.id,
        filename=path.name,
        original_filename=file.filename or path.name,
        content_type=file.content_type or "application/octet-stream",
        path=str(path),
        file_size=size,
        analysis_status="pending",
    )
    db.add(audio)
    db.commit()
    db.refresh(audio)
    _enqueue_analysis(audio.id)
    return audio


@router.get("/compatible")
def compatible_tracks(
    bpm: float | None = None,
    key: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.harmony import bpm_compatible, camelot, compatible_camelot

    files = db.query(AudioFile).filter(AudioFile.user_id == user.id, AudioFile.analysis_status == "ready").all()
    target_code = camelot(key) if key else None
    out = []
    for f in files:
        analysis = f.analysis or {}
        fbpm = analysis.get("bpm")
        fkey = analysis.get("key")
        ok_bpm = bpm is None or (fbpm and bpm_compatible(float(bpm), float(fbpm)))
        ok_key = target_code is None or (fkey and camelot(str(fkey)) in compatible_camelot(target_code))
        if ok_bpm and ok_key:
            out.append(
                {
                    "id": f.id,
                    "original_filename": f.original_filename,
                    "bpm": fbpm,
                    "key": fkey,
                    "camelot": analysis.get("camelot") or (camelot(str(fkey)) if fkey else None),
                }
            )
    return out


@router.get("", response_model=list[AudioFileOut])
def list_audio(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(AudioFile)
        .filter(AudioFile.user_id == user.id)
        .order_by(AudioFile.created_at.desc())
        .all()
    )


@router.get("/{audio_id}", response_model=AudioFileOut)
def get_audio(audio_id: str, db: Session = Depends(get_db)):
    audio = db.get(AudioFile, audio_id)
    if not audio:
        raise HTTPException(404, "Audio not found")
    return audio


@router.get("/{audio_id}/stream")
def stream_audio(audio_id: str, db: Session = Depends(get_db)):
    audio = db.get(AudioFile, audio_id)
    if not audio or not Path(audio.path).exists():
        raise HTTPException(404, "Audio not found")
    return FileResponse(audio.path, media_type=audio.content_type, filename=audio.original_filename)


@router.post("/{audio_id}/analyze", response_model=AudioFileOut)
def analyze_audio(audio_id: str, db: Session = Depends(get_db)):
    audio = db.get(AudioFile, audio_id)
    if not audio:
        raise HTTPException(404, "Audio not found")
    audio.analysis_status = "processing"
    db.commit()
    _enqueue_analysis(audio.id)
    db.refresh(audio)
    return audio


@router.get("/{audio_id}/analysis")
def get_analysis(audio_id: str, db: Session = Depends(get_db)):
    audio = db.get(AudioFile, audio_id)
    if not audio:
        raise HTTPException(404, "Audio not found")
    return {
        "id": audio.id,
        "status": audio.analysis_status,
        "analysis": audio.analysis,
        "error": audio.error_message,
    }


@router.post("/{audio_id}/cues", response_model=CuePointOut)
def add_cue(audio_id: str, payload: CuePointCreate, db: Session = Depends(get_db)):
    from app.models import CuePoint

    audio = db.get(AudioFile, audio_id)
    if not audio:
        raise HTTPException(404, "Audio not found")
    cue = CuePoint(audio_file_id=audio_id, **payload.model_dump())
    db.add(cue)
    db.commit()
    db.refresh(cue)
    return cue


@router.get("/{audio_id}/cues", response_model=list[CuePointOut])
def list_cues(audio_id: str, db: Session = Depends(get_db)):
    from app.models import CuePoint

    return db.query(CuePoint).filter(CuePoint.audio_file_id == audio_id).all()


@router.post("/{audio_id}/stems")
def split_stems(audio_id: str, db: Session = Depends(get_db)):
    from app.services.stems import hpss_stems
    from workers.tasks.stems import _try_demucs

    audio = db.get(AudioFile, audio_id)
    if not audio:
        raise HTTPException(404, "Audio not found")
    demucs = _try_demucs(Path(audio.path), Path(audio.path).parent / "stems")
    paths = demucs or hpss_stems(audio.path)
    engine = "demucs" if demucs else "hpss"
    analysis = dict(audio.analysis or {})
    analysis["stems"] = paths
    analysis["stems_engine"] = engine
    audio.analysis = analysis
    db.add(audio)
    db.commit()
    return {"id": audio.id, "stems": paths, "engine": engine}


@router.get("/{audio_id}/stems/{stem}/stream")
def stream_stem(audio_id: str, stem: str, db: Session = Depends(get_db)):
    audio = db.get(AudioFile, audio_id)
    if not audio:
        raise HTTPException(404, "Audio not found")
    stems = (audio.analysis or {}).get("stems") or {}
    path = stems.get(stem)
    if not path or not Path(path).exists():
        raise HTTPException(404, "Stem not found — run POST /stems first")
    return FileResponse(path, media_type="audio/wav", filename=f"{stem}.wav")


@router.post("/{audio_id}/loops", response_model=LoopOut)
def add_loop(audio_id: str, payload: LoopCreate, db: Session = Depends(get_db)):
    from app.models import LoopRegion

    audio = db.get(AudioFile, audio_id)
    if not audio:
        raise HTTPException(404, "Audio not found")
    loop = LoopRegion(audio_file_id=audio_id, **payload.model_dump())
    db.add(loop)
    db.commit()
    db.refresh(loop)
    return loop
