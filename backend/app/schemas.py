from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORMModel):
    id: str
    email: str
    name: str
    created_at: datetime | None = None


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    bpm: float = 120.0
    time_signature: str = "4/4"
    musical_key: str = "C minor"


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    bpm: float | None = None
    time_signature: str | None = None
    musical_key: str | None = None
    graph: dict[str, Any] | None = None
    expected_revision: int | None = Field(default=None, ge=0)
    snapshot_label: str | None = Field(default=None, max_length=255)


class ProjectOut(ORMModel):
    id: str
    user_id: str
    name: str
    description: str
    bpm: float
    time_signature: str
    musical_key: str
    graph: dict[str, Any]
    graph_revision: int
    share_token: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProjectDetail(ProjectOut):
    tracks: list[dict[str, Any]] = []
    decks: list[dict[str, Any]] = []
    mixer_channels: list[dict[str, Any]] = []
    drum_patterns: list[dict[str, Any]] = []
    synth_presets: list[dict[str, Any]] = []
    arrangements: list[dict[str, Any]] = []


class ProjectSnapshotCreate(BaseModel):
    label: str = Field(default="Manual restore point", min_length=1, max_length=255)


class ProjectSnapshotOut(ORMModel):
    id: str
    project_id: str
    revision: int
    label: str
    graph: dict[str, Any]
    created_at: datetime | None = None


class AudioFileOut(ORMModel):
    id: str
    user_id: str
    filename: str
    original_filename: str
    content_type: str
    duration: float | None
    sample_rate: int | None
    channels: int | None
    file_size: int
    analysis_status: str
    analysis: dict[str, Any] | None = None
    error_message: str | None = None
    created_at: datetime | None = None


class TrackCreate(BaseModel):
    name: str
    kind: str = "audio"
    audio_file_id: str | None = None
    color: str = "#ff6a00"


class TrackOut(ORMModel):
    id: str
    project_id: str
    audio_file_id: str | None
    name: str
    color: str
    kind: str
    order_index: int
    muted: bool
    solo: bool
    volume: float
    pan: float


class CuePointCreate(BaseModel):
    time: float
    label: str = "Cue"
    color: str = "#ff6a00"
    hotcue_index: int | None = None


class CuePointOut(ORMModel):
    id: str
    audio_file_id: str
    time: float
    label: str
    color: str
    hotcue_index: int | None


class LoopCreate(BaseModel):
    start: float
    end: float
    label: str = "Loop"


class LoopOut(ORMModel):
    id: str
    audio_file_id: str
    start: float
    end: float
    label: str


class MixerSettings(BaseModel):
    gain: float | None = None
    eq_low: float | None = None
    eq_mid: float | None = None
    eq_high: float | None = None
    filter_knob: float | None = None
    pan: float | None = None
    mute: bool | None = None
    solo: bool | None = None
    volume: float | None = None


class DrumPatternCreate(BaseModel):
    name: str = "Pattern 1"
    length: int = 16
    swing: float = 0.0
    bpm: float = 120.0
    steps: dict[str, Any] = Field(default_factory=dict)
    kit_id: str | None = None


class DrumPatternOut(ORMModel):
    id: str
    project_id: str
    kit_id: str | None
    name: str
    length: int
    swing: float
    bpm: float
    steps: dict[str, Any]


class SynthPresetCreate(BaseModel):
    name: str
    params: dict[str, Any] = Field(default_factory=dict)


class SynthPresetOut(ORMModel):
    id: str
    project_id: str | None
    name: str
    params: dict[str, Any]


class RenderRequest(BaseModel):
    format: str = "wav"


class RenderJobOut(ORMModel):
    id: str
    project_id: str
    status: str
    format: str
    source: str
    details: dict[str, Any]
    output_path: str | None
    progress: float
    error_message: str | None


class AIChatRequest(BaseModel):
    project_id: str | None = None
    conversation_id: str | None = None
    message: str
    context: dict[str, Any] = Field(default_factory=dict)


class AIAction(BaseModel):
    type: str
    params: dict[str, Any] = Field(default_factory=dict)


class AIChatResponse(BaseModel):
    conversation_id: str
    message: str
    actions: list[dict[str, Any]]
    reasoning: str | None = None


class AIApplyRequest(BaseModel):
    project_id: str
    actions: list[dict[str, Any]]
