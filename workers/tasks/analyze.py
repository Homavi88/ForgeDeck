from workers.celery_app import celery_app


@celery_app.task(name="workers.tasks.analyze.analyze_audio_task")
def analyze_audio_task(audio_file_id: str) -> str:
    from app.database import SessionLocal
    from app.models import AudioFile
    from app.services.analysis import analyze_file, persist_analysis

    db = SessionLocal()
    try:
        audio = db.get(AudioFile, audio_file_id)
        if not audio:
            return "missing"
        audio.analysis_status = "processing"
        db.commit()
        result = analyze_file(audio.path)
        persist_analysis(db, audio, result)
        return "ready"
    except Exception as exc:
        audio = db.get(AudioFile, audio_file_id)
        if audio:
            audio.analysis_status = "error"
            audio.error_message = str(exc)
            db.commit()
        return f"error:{exc}"
    finally:
        db.close()
