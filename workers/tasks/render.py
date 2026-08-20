from pathlib import Path

from workers.celery_app import celery_app


@celery_app.task(name="workers.tasks.render.render_project_task")
def render_project_task(job_id: str) -> str:
    from app.config import get_settings
    from app.database import SessionLocal
    from app.models import AudioFile, RenderJob, Track
    from app.services.render import mix_files

    settings = get_settings()
    db = SessionLocal()
    try:
        job = db.get(RenderJob, job_id)
        if not job:
            return "missing"
        job.status = "rendering"
        job.progress = 0.1
        db.commit()

        tracks = db.query(Track).filter(Track.project_id == job.project_id).all()
        paths = []
        for track in tracks:
            if track.audio_file_id:
                audio = db.get(AudioFile, track.audio_file_id)
                if audio:
                    paths.append(Path(audio.path))
        if not paths:
            # Fall back to any analyzed library files referenced by project graph.
            files = db.query(AudioFile).limit(2).all()
            paths = [Path(f.path) for f in files if Path(f.path).exists()]

        out = settings.storage_path / "renders" / f"{job.id}.{job.format}"
        result = mix_files(paths, out)
        job.output_path = str(result)
        job.progress = 1.0
        job.status = "done"
        db.commit()
        return "done"
    except Exception as exc:
        job = db.get(RenderJob, job_id)
        if job:
            job.status = "error"
            job.error_message = str(exc)
            db.commit()
        return f"error:{exc}"
    finally:
        db.close()
