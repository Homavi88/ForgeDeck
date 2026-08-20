"""Stem separation: GPU Demucs when available, otherwise HPSS."""

from pathlib import Path

from workers.celery_app import celery_app


@celery_app.task(name="workers.tasks.stems.separate_stems_task")
def separate_stems_task(audio_file_id: str) -> dict:
    from app.database import SessionLocal
    from app.models import AudioFile
    from app.services.stems import separate_stems

    db = SessionLocal()
    try:
        audio = db.get(AudioFile, audio_file_id)
        if not audio:
            return {"status": "missing"}
        paths, engine = separate_stems(audio.path)
        analysis = dict(audio.analysis or {})
        analysis["stems"] = paths
        analysis["stems_engine"] = engine
        audio.analysis = analysis
        db.add(audio)
        db.commit()
        return {"status": "ready", "engine": engine, "stems": paths}
    finally:
        db.close()
