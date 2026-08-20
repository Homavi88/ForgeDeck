"""Stem separation: Demucs if installed, otherwise HPSS."""

from pathlib import Path

from workers.celery_app import celery_app


@celery_app.task(name="workers.tasks.stems.separate_stems_task")
def separate_stems_task(audio_file_id: str) -> dict:
    from app.database import SessionLocal
    from app.models import AudioFile
    from app.services.stems import hpss_stems

    db = SessionLocal()
    try:
        audio = db.get(AudioFile, audio_file_id)
        if not audio:
            return {"status": "missing"}
        demucs = _try_demucs(Path(audio.path), Path(audio.path).parent / "stems")
        paths = demucs or hpss_stems(audio.path)
        analysis = dict(audio.analysis or {})
        analysis["stems"] = paths
        analysis["stems_engine"] = "demucs" if demucs else "hpss"
        audio.analysis = analysis
        db.add(audio)
        db.commit()
        return {"status": "ready", "engine": analysis["stems_engine"], "stems": paths}
    finally:
        db.close()


def _try_demucs(src: Path, out_dir: Path) -> dict[str, str] | None:
    import shutil
    import subprocess

    bin_path = shutil.which("demucs")
    if not bin_path:
        return None
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [bin_path, "-n", "htdemucs", "-o", str(out_dir), str(src)],
            check=True,
            capture_output=True,
            timeout=600,
        )
    except Exception:
        return None
    found: dict[str, str] = {}
    for wav in out_dir.rglob("*.wav"):
        stem = wav.stem.lower()
        if stem in {"vocals", "drums", "bass", "other"}:
            found[stem] = str(wav)
    return found or None
