"""Seed a first-project demo loop into the user's library and Deck A."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AudioFile, Deck, Project, User

DEMO_FILENAME = "PulseForge Demo Loop.wav"


def write_demo_wav(dest: Path, sr: int = 44100, bpm: float = 120.0, bars: int = 4) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    duration = bars * 4 * (60.0 / bpm)
    n = int(sr * duration)
    t = np.linspace(0.0, duration, n, endpoint=False)
    tone = 0.12 * np.sin(2 * np.pi * 110.0 * t)
    click = np.zeros(n, dtype=np.float32)
    beat = int(sr * 60.0 / bpm)
    for i, start in enumerate(range(0, n, beat)):
        length = min(int(0.035 * sr), n - start)
        env = np.linspace(1.0, 0.0, length, dtype=np.float32)
        amp = 0.75 if i % 4 == 0 else 0.32
        click[start : start + length] += env * amp
    audio = np.clip(tone.astype(np.float32) + click, -1.0, 1.0)
    sf.write(str(dest), audio, sr)
    return dest


def ensure_demo_audio(db: Session, user: User) -> AudioFile:
    existing = (
        db.query(AudioFile)
        .filter(AudioFile.user_id == user.id, AudioFile.original_filename == DEMO_FILENAME)
        .one_or_none()
    )
    if existing:
        if existing.analysis_status != "ready":
            _analyze_now(db, existing)
        return existing

    settings = get_settings()
    dest_dir = settings.storage_path / "demo" / user.id
    dest = dest_dir / "demo-loop.wav"
    write_demo_wav(dest)
    audio = AudioFile(
        user_id=user.id,
        filename=dest.name,
        original_filename=DEMO_FILENAME,
        content_type="audio/wav",
        path=str(dest),
        file_size=dest.stat().st_size,
        analysis_status="pending",
    )
    db.add(audio)
    db.commit()
    db.refresh(audio)
    _analyze_now(db, audio)
    return audio


def _analyze_now(db: Session, audio: AudioFile) -> None:
    from app.services.analysis import analyze_file, persist_analysis

    result = analyze_file(audio.path)
    persist_analysis(db, audio, result)


def attach_demo_to_first_project(db: Session, user: User, project: Project) -> AudioFile | None:
    """Put the demo on Deck A when this is the user's first project (or they have no library yet)."""
    other_projects = (
        db.query(Project).filter(Project.user_id == user.id, Project.id != project.id).count()
    )
    library_count = db.query(AudioFile).filter(AudioFile.user_id == user.id).count()
    if other_projects > 0 and library_count > 0:
        return None

    audio = ensure_demo_audio(db, user)
    deck = db.query(Deck).filter(Deck.project_id == project.id, Deck.name == "A").one_or_none()
    if deck:
        deck.audio_file_id = audio.id
        db.add(deck)

    graph = dict(project.graph or {})
    decks = dict(graph.get("decks") or {})
    slot = dict(decks.get("A") or {})
    slot["audioFileId"] = audio.id
    decks["A"] = slot
    graph["decks"] = decks
    if audio.analysis and audio.analysis.get("bpm"):
        graph["bpm"] = audio.analysis["bpm"]
        project.bpm = float(audio.analysis["bpm"])
    project.graph = graph
    db.add(project)
    db.commit()
    db.refresh(project)
    return audio
