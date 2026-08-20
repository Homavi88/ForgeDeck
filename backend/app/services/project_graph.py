"""Hydrate relational rows from the frontend project graph on save."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import DrumPattern, MixerChannel, Project, SynthPreset


def persist_graph(db: Session, project: Project, graph: dict[str, Any]) -> None:
    drums = graph.get("drums") or {}
    if drums.get("steps"):
        pattern = (
            db.query(DrumPattern)
            .filter(DrumPattern.project_id == project.id, DrumPattern.name == "Main")
            .one_or_none()
        )
        if pattern is None:
            pattern = DrumPattern(project_id=project.id, name="Main")
            db.add(pattern)
        pattern.steps = drums.get("steps") or {}
        pattern.length = int(drums.get("length") or 16)
        pattern.swing = float(drums.get("swing") or 0)
        pattern.bpm = float(graph.get("bpm") or project.bpm)

    synth = graph.get("synth")
    if synth:
        preset = (
            db.query(SynthPreset)
            .filter(SynthPreset.project_id == project.id, SynthPreset.name == "Current")
            .one_or_none()
        )
        if preset is None:
            preset = SynthPreset(project_id=project.id, name="Current", params=synth)
            db.add(preset)
        else:
            preset.params = synth

    mixer = graph.get("mixer") or {}
    name_map = {"A": "Deck A", "B": "Deck B", "drums": "Drums", "synth": "Synth"}
    for key, ch_name in name_map.items():
        state = mixer.get(key)
        if not isinstance(state, dict):
            continue
        channel = (
            db.query(MixerChannel)
            .filter(MixerChannel.project_id == project.id, MixerChannel.name == ch_name)
            .one_or_none()
        )
        if not channel:
            continue
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
