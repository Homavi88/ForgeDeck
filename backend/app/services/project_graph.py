"""Hydrate relational rows from the frontend project graph on save."""

from __future__ import annotations

from typing import Any, TypeVar

from sqlalchemy.orm import Session

from app.models import DrumPattern, MixerChannel, Project, SynthPreset

T = TypeVar("T")


def keep_named(db: Session, model: type[T], project_id: str, name: str) -> T | None:
    """Return one row for (project, name); delete extras left by old autosave."""
    rows = (
        db.query(model)
        .filter(model.project_id == project_id, model.name == name)
        .order_by(model.created_at.asc(), model.id.asc())
        .all()
    )
    if not rows:
        return None
    keeper = rows[0]
    for extra in rows[1:]:
        db.delete(extra)
    if len(rows) > 1:
        db.flush()
    return keeper


def persist_graph(db: Session, project: Project, graph: dict[str, Any]) -> None:
    drums = graph.get("drums") or {}
    if drums.get("steps"):
        pattern = keep_named(db, DrumPattern, project.id, "Main")
        if pattern is None:
            pattern = DrumPattern(project_id=project.id, name="Main")
            db.add(pattern)
        pattern.steps = drums.get("steps") or {}
        pattern.length = int(drums.get("length") or 16)
        pattern.swing = float(drums.get("swing") or 0)
        pattern.bpm = float(graph.get("bpm") or project.bpm)

    synth = graph.get("synth")
    if synth:
        preset = keep_named(db, SynthPreset, project.id, "Current")
        if preset is None:
            preset = SynthPreset(project_id=project.id, name="Current", params=synth)
            db.add(preset)
        else:
            preset.params = synth

    mixer = graph.get("mixer") or {}
    name_map = {"A": "Deck A", "B": "Deck B", "drums": "Drums", "synth": "Synth"}
    for key, state in mixer.items():
        if not isinstance(state, dict):
            continue
        ch_name = name_map.get(key, key)
        channel = keep_named(db, MixerChannel, project.id, ch_name)
        if channel is None:
            channel = MixerChannel(
                project_id=project.id,
                name=ch_name,
                role="audio" if key not in name_map else ("deck" if key in ("A", "B") else key),
            )
            db.add(channel)
            db.flush()
        if "volume" in state:
            channel.volume = float(state["volume"])
        if "gain" in state:
            channel.gain = float(state["gain"])
        if "mute" in state:
            channel.mute = bool(state["mute"])
        if "solo" in state:
            channel.solo = bool(state["solo"])
        if "pan" in state:
            channel.pan = float(state["pan"])
        eq = state.get("eq")
        if isinstance(eq, list) and len(eq) == 3:
            channel.eq_low, channel.eq_mid, channel.eq_high = map(float, eq)
        if "filter" in state:
            channel.filter_knob = float(state["filter"])

    db.add(project)
    db.commit()
