from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def new_id() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)

    projects: Mapped[list[Project]] = relationship(back_populates="user", cascade="all, delete-orphan")
    audio_files: Mapped[list[AudioFile]] = relationship(back_populates="user")


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    bpm: Mapped[float] = mapped_column(Float, default=120.0)
    time_signature: Mapped[str] = mapped_column(String(16), default="4/4")
    musical_key: Mapped[str] = mapped_column(String(16), default="C minor")
    # Full frontend snapshot (decks, mixer, clips, patterns, etc.)
    graph: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    user: Mapped[User] = relationship(back_populates="projects")
    tracks: Mapped[list[Track]] = relationship(back_populates="project", cascade="all, delete-orphan")
    decks: Mapped[list[Deck]] = relationship(back_populates="project", cascade="all, delete-orphan")
    mixer_channels: Mapped[list[MixerChannel]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    arrangements: Mapped[list[Arrangement]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    drum_kits: Mapped[list[DrumKit]] = relationship(back_populates="project", cascade="all, delete-orphan")
    drum_patterns: Mapped[list[DrumPattern]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    synth_presets: Mapped[list[SynthPreset]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    conversations: Mapped[list[AIConversation]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    render_jobs: Mapped[list[RenderJob]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class AudioFile(Base, TimestampMixin):
    __tablename__ = "audio_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    filename: Mapped[str] = mapped_column(String(512))
    original_filename: Mapped[str] = mapped_column(String(512))
    content_type: Mapped[str] = mapped_column(String(128), default="audio/wav")
    path: Mapped[str] = mapped_column(String(1024))
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)
    sample_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    channels: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    analysis_status: Mapped[str] = mapped_column(String(32), default="pending")
    analysis: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped[User] = relationship(back_populates="audio_files")
    cue_points: Mapped[list[CuePoint]] = relationship(
        back_populates="audio_file", cascade="all, delete-orphan"
    )
    loop_regions: Mapped[list[LoopRegion]] = relationship(
        back_populates="audio_file", cascade="all, delete-orphan"
    )
    beat_grid: Mapped[BeatGrid | None] = relationship(
        back_populates="audio_file", uselist=False, cascade="all, delete-orphan"
    )


class Track(Base, TimestampMixin):
    __tablename__ = "tracks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    audio_file_id: Mapped[str | None] = mapped_column(ForeignKey("audio_files.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    color: Mapped[str] = mapped_column(String(16), default="#ff6a00")
    kind: Mapped[str] = mapped_column(String(32), default="audio")  # audio|midi|drum|synth
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    muted: Mapped[bool] = mapped_column(Boolean, default=False)
    solo: Mapped[bool] = mapped_column(Boolean, default=False)
    volume: Mapped[float] = mapped_column(Float, default=0.8)
    pan: Mapped[float] = mapped_column(Float, default=0.0)

    project: Mapped[Project] = relationship(back_populates="tracks")
    clips: Mapped[list[Clip]] = relationship(back_populates="track", cascade="all, delete-orphan")
    automation_lanes: Mapped[list[AutomationLane]] = relationship(
        back_populates="track", cascade="all, delete-orphan"
    )


class Deck(Base, TimestampMixin):
    __tablename__ = "decks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(8))  # A / B
    audio_file_id: Mapped[str | None] = mapped_column(ForeignKey("audio_files.id"), nullable=True)
    is_playing: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[float] = mapped_column(Float, default=0.0)
    pitch: Mapped[float] = mapped_column(Float, default=0.0)
    volume: Mapped[float] = mapped_column(Float, default=0.8)

    project: Mapped[Project] = relationship(back_populates="decks")


class Clip(Base, TimestampMixin):
    __tablename__ = "clips"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    track_id: Mapped[str] = mapped_column(ForeignKey("tracks.id"), index=True)
    audio_file_id: Mapped[str | None] = mapped_column(ForeignKey("audio_files.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), default="Clip")
    start_time: Mapped[float] = mapped_column(Float, default=0.0)
    duration: Mapped[float] = mapped_column(Float, default=4.0)
    offset: Mapped[float] = mapped_column(Float, default=0.0)
    loop: Mapped[bool] = mapped_column(Boolean, default=False)
    color: Mapped[str] = mapped_column(String(16), default="#3dff7a")

    track: Mapped[Track] = relationship(back_populates="clips")


class CuePoint(Base, TimestampMixin):
    __tablename__ = "cue_points"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    audio_file_id: Mapped[str] = mapped_column(ForeignKey("audio_files.id"), index=True)
    time: Mapped[float] = mapped_column(Float)
    label: Mapped[str] = mapped_column(String(128), default="Cue")
    color: Mapped[str] = mapped_column(String(16), default="#ff6a00")
    hotcue_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    audio_file: Mapped[AudioFile] = relationship(back_populates="cue_points")


class LoopRegion(Base, TimestampMixin):
    __tablename__ = "loop_regions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    audio_file_id: Mapped[str] = mapped_column(ForeignKey("audio_files.id"), index=True)
    start: Mapped[float] = mapped_column(Float)
    end: Mapped[float] = mapped_column(Float)
    label: Mapped[str] = mapped_column(String(128), default="Loop")

    audio_file: Mapped[AudioFile] = relationship(back_populates="loop_regions")


class BeatGrid(Base, TimestampMixin):
    __tablename__ = "beat_grids"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    audio_file_id: Mapped[str] = mapped_column(ForeignKey("audio_files.id"), unique=True)
    bpm: Mapped[float] = mapped_column(Float, default=120.0)
    first_beat_offset: Mapped[float] = mapped_column(Float, default=0.0)
    beats: Mapped[list[float]] = mapped_column(JSON, default=list)

    audio_file: Mapped[AudioFile] = relationship(back_populates="beat_grid")


class MixerChannel(Base, TimestampMixin):
    __tablename__ = "mixer_channels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(32), default="deck")  # deck|drum|synth|master
    gain: Mapped[float] = mapped_column(Float, default=0.0)
    eq_low: Mapped[float] = mapped_column(Float, default=0.0)
    eq_mid: Mapped[float] = mapped_column(Float, default=0.0)
    eq_high: Mapped[float] = mapped_column(Float, default=0.0)
    filter_knob: Mapped[float] = mapped_column(Float, default=0.0)
    pan: Mapped[float] = mapped_column(Float, default=0.0)
    mute: Mapped[bool] = mapped_column(Boolean, default=False)
    solo: Mapped[bool] = mapped_column(Boolean, default=False)
    volume: Mapped[float] = mapped_column(Float, default=0.8)

    project: Mapped[Project] = relationship(back_populates="mixer_channels")
    effect_chain: Mapped[EffectChain | None] = relationship(
        back_populates="channel", uselist=False, cascade="all, delete-orphan"
    )


class EffectChain(Base, TimestampMixin):
    __tablename__ = "effect_chains"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    mixer_channel_id: Mapped[str] = mapped_column(ForeignKey("mixer_channels.id"), unique=True)
    slots: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    channel: Mapped[MixerChannel] = relationship(back_populates="effect_chain")


class EffectPreset(Base, TimestampMixin):
    __tablename__ = "effect_presets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    effect_type: Mapped[str] = mapped_column(String(64))
    params: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class SynthPreset(Base, TimestampMixin):
    __tablename__ = "synth_presets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    params: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    project: Mapped[Project | None] = relationship(back_populates="synth_presets")


class DrumKit(Base, TimestampMixin):
    __tablename__ = "drum_kits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    pads: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    project: Mapped[Project | None] = relationship(back_populates="drum_kits")
    patterns: Mapped[list[DrumPattern]] = relationship(back_populates="kit")


class DrumPattern(Base, TimestampMixin):
    __tablename__ = "drum_patterns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    kit_id: Mapped[str | None] = mapped_column(ForeignKey("drum_kits.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    length: Mapped[int] = mapped_column(Integer, default=16)
    swing: Mapped[float] = mapped_column(Float, default=0.0)
    bpm: Mapped[float] = mapped_column(Float, default=120.0)
    steps: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    project: Mapped[Project] = relationship(back_populates="drum_patterns")
    kit: Mapped[DrumKit | None] = relationship(back_populates="patterns")


class Arrangement(Base, TimestampMixin):
    __tablename__ = "arrangements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(128), default="Arrangement")
    length_bars: Mapped[int] = mapped_column(Integer, default=32)
    structure: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    project: Mapped[Project] = relationship(back_populates="arrangements")


class AutomationLane(Base, TimestampMixin):
    __tablename__ = "automation_lanes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    track_id: Mapped[str | None] = mapped_column(ForeignKey("tracks.id"), nullable=True)
    target: Mapped[str] = mapped_column(String(128))
    points: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    track: Mapped[Track | None] = relationship(back_populates="automation_lanes")


class AIConversation(Base, TimestampMixin):
    __tablename__ = "ai_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    title: Mapped[str] = mapped_column(String(255), default="AI Producer")
    messages: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    project: Mapped[Project] = relationship(back_populates="conversations")
    tasks: Mapped[list[AITask]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class AITask(Base, TimestampMixin):
    __tablename__ = "ai_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("ai_conversations.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    prompt: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    conversation: Mapped[AIConversation] = relationship(back_populates="tasks")


class RenderJob(Base, TimestampMixin):
    __tablename__ = "render_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    format: Mapped[str] = mapped_column(String(16), default="wav")
    output_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped[Project] = relationship(back_populates="render_jobs")
