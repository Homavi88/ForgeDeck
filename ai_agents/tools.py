"""Tool implementations that mutate ForgeDeck projects.

Each tool returns a structured result the orchestrator can attach to an action.
Apply happens only after the user confirms in the UI.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.deps import default_synth_params
from app.models import (
    Arrangement,
    AudioFile,
    AutomationLane,
    CuePoint,
    DrumPattern,
    MixerChannel,
    Project,
    RenderJob,
    SynthPreset,
)
from app.services.analysis import analyze_file, persist_analysis


class ToolError(Exception):
    pass


def analyze_audio(db: Session, file_id: str) -> dict[str, Any]:
    audio = db.get(AudioFile, file_id)
    if not audio:
        raise ToolError("Audio file not found")
    result = analyze_file(audio.path)
    persist_analysis(db, audio, result)
    return {"file_id": file_id, "analysis": result}


def create_cue_point(db: Session, track_id: str, time: float, label: str = "Cue", hotcue_index: int | None = None) -> dict[str, Any]:
    audio = db.get(AudioFile, track_id)
    if not audio:
        raise ToolError("Track/audio not found for cue")
    cue = CuePoint(audio_file_id=audio.id, time=float(time), label=label, hotcue_index=hotcue_index)
    db.add(cue)
    db.commit()
    db.refresh(cue)
    return {"id": cue.id, "time": cue.time, "label": cue.label}


def create_loop(db: Session, track_id: str, start: float, end: float, label: str = "Loop") -> dict[str, Any]:
    from app.models import LoopRegion

    audio = db.get(AudioFile, track_id)
    if not audio:
        raise ToolError("Track/audio not found for loop")
    loop = LoopRegion(audio_file_id=audio.id, start=float(start), end=float(end), label=label)
    db.add(loop)
    db.commit()
    db.refresh(loop)
    return {"id": loop.id, "start": loop.start, "end": loop.end, "label": loop.label}


def create_drum_pattern(
    db: Session,
    project_id: str,
    genre: str = "house",
    bpm: float = 120,
    steps: dict | None = None,
    name: str = "AI Pattern",
    swing: float = 0.08,
    length: int = 16,
) -> dict[str, Any]:
    project = db.get(Project, project_id)
    if not project:
        raise ToolError("Project not found")
    pattern = DrumPattern(
        project_id=project_id,
        name=name,
        bpm=bpm,
        swing=swing,
        length=length,
        steps=steps or {},
    )
    db.add(pattern)
    db.commit()
    db.refresh(pattern)
    return {"id": pattern.id, "name": pattern.name, "steps": pattern.steps, "genre": genre}


def create_synth_preset(db: Session, project_id: str, style: str = "supersaw", name: str | None = None, params: dict | None = None) -> dict[str, Any]:
    project = db.get(Project, project_id)
    if not project:
        raise ToolError("Project not found")
    merged = default_synth_params()
    merged.update(params or {})
    preset = SynthPreset(project_id=project_id, name=name or style.title(), params=merged)
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return {"id": preset.id, "name": preset.name, "params": preset.params}


def suggest_transition(db: Session, deck_a_track_id: str | None, deck_b_track_id: str | None, bars: int = 32) -> dict[str, Any]:
    return {
        "bars": bars,
        "deck_a_track_id": deck_a_track_id,
        "deck_b_track_id": deck_b_track_id,
        "plan": "filter + EQ swap + delay",
    }


def apply_mixer_settings(db: Session, project_id: str, channel_id: str, settings: dict[str, Any]) -> dict[str, Any]:
    query = db.query(MixerChannel).filter(MixerChannel.project_id == project_id)
    channel = query.filter(MixerChannel.id == channel_id).one_or_none()
    if channel is None:
        channel = query.filter(MixerChannel.name == channel_id).one_or_none()
    if channel is None:
        raise ToolError(f"Mixer channel {channel_id} not found")
    for key in ("gain", "eq_low", "eq_mid", "eq_high", "filter_knob", "pan", "mute", "solo", "volume"):
        if key in settings and settings[key] is not None:
            setattr(channel, key, settings[key])
    db.add(channel)
    db.commit()
    return {"channel_id": channel.id, "name": channel.name, "settings": settings}


def create_arrangement(db: Session, project_id: str, structure: list[dict], name: str = "AI Arrangement") -> dict[str, Any]:
    project = db.get(Project, project_id)
    if not project:
        raise ToolError("Project not found")
    length = sum(int(s.get("bars", 8)) for s in structure)
    arr = Arrangement(project_id=project_id, name=name, length_bars=length, structure=structure)
    db.add(arr)
    db.commit()
    db.refresh(arr)
    return {"id": arr.id, "name": arr.name, "structure": arr.structure}


def apply_automation(db: Session, target: str, points: list[dict], track_id: str | None = None) -> dict[str, Any]:
    lane = AutomationLane(track_id=track_id, target=target, points=points)
    db.add(lane)
    db.commit()
    db.refresh(lane)
    return {"id": lane.id, "target": target, "points": points}


def export_mix(db: Session, project_id: str, fmt: str = "wav") -> dict[str, Any]:
    project = db.get(Project, project_id)
    if not project:
        raise ToolError("Project not found")
    job = RenderJob(project_id=project_id, format=fmt, status="queued")
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"job_id": job.id, "status": job.status, "format": fmt}


def suggest_compatible_tracks(db: Session, project_id: str, bpm: float | None = None, key: str | None = None) -> dict[str, Any]:
    from app.services.harmony import bpm_compatible, camelot, compatible_camelot

    project = db.get(Project, project_id)
    bpm = bpm or (project.bpm if project else 120)
    key = key or (project.musical_key if project else "C minor")
    files = db.query(AudioFile).filter(
        AudioFile.analysis_status == "ready",
        AudioFile.user_id == project.user_id if project else "",
    ).all()
    code = camelot(key)
    matches = []
    for f in files:
        a = f.analysis or {}
        fbpm, fkey = a.get("bpm"), a.get("key")
        if fbpm and bpm_compatible(float(bpm), float(fbpm)) and fkey and camelot(str(fkey)) in compatible_camelot(code):
            matches.append({"id": f.id, "name": f.original_filename, "bpm": fbpm, "key": fkey, "camelot": camelot(str(fkey))})
    return {"bpm": bpm, "key": key, "camelot": code, "tracks": matches[:12]}


def create_bassline(db: Session, project_id: str, genre: str = "house", key: str | None = None) -> dict[str, Any]:
    from app.services.harmony import make_bassline

    project = db.get(Project, project_id)
    key = key or (project.musical_key if project else "C minor")
    notes = make_bassline(key, genre)
    return {"project_id": project_id, "kind": "bassline", "genre": genre, "key": key, "notes": notes}


def create_melody(db: Session, project_id: str, genre: str = "house", key: str | None = None) -> dict[str, Any]:
    from app.services.harmony import make_melody

    project = db.get(Project, project_id)
    key = key or (project.musical_key if project else "C minor")
    notes = make_melody(key, genre)
    return {"project_id": project_id, "kind": "melody", "genre": genre, "key": key, "notes": notes}


def create_chord_progression(db: Session, project_id: str, key: str | None = None) -> dict[str, Any]:
    from app.services.harmony import make_chords

    project = db.get(Project, project_id)
    key = key or (project.musical_key if project else "C minor")
    notes = make_chords(key)
    return {"project_id": project_id, "kind": "chords", "key": key, "notes": notes}


def separate_stems(db: Session, file_id: str) -> dict[str, Any]:
    from app.services.stems import separate_stems

    audio = db.get(AudioFile, file_id)
    if not audio:
        raise ToolError("Audio file not found")
    paths, engine = separate_stems(audio.path)
    analysis = dict(audio.analysis or {})
    analysis["stems"] = paths
    analysis["stems_engine"] = engine
    audio.analysis = analysis
    db.add(audio)
    db.commit()
    return {"file_id": file_id, "stems": paths, "engine": engine}


TOOL_REGISTRY = {
    "analyze_audio": analyze_audio,
    "create_cue_point": create_cue_point,
    "create_loop": create_loop,
    "create_drum_pattern": create_drum_pattern,
    "create_synth_preset": create_synth_preset,
    "suggest_transition": suggest_transition,
    "apply_mixer_settings": apply_mixer_settings,
    "create_arrangement": create_arrangement,
    "apply_automation": apply_automation,
    "export_mix": export_mix,
    "suggest_compatible_tracks": suggest_compatible_tracks,
    "create_bassline": create_bassline,
    "create_melody": create_melody,
    "create_chord_progression": create_chord_progression,
    "separate_stems": separate_stems,
}
