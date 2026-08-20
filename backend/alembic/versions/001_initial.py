"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None

JSON = sa.JSON


def _ts():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=True),
        *_ts(),
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), server_default=""),
        sa.Column("bpm", sa.Float(), server_default="120"),
        sa.Column("time_signature", sa.String(16), server_default="4/4"),
        sa.Column("musical_key", sa.String(16), server_default="C minor"),
        sa.Column("graph", JSON, nullable=True),
        *_ts(),
    )
    op.create_table(
        "audio_files",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("original_filename", sa.String(512), nullable=False),
        sa.Column("content_type", sa.String(128), server_default="audio/wav"),
        sa.Column("path", sa.String(1024), nullable=False),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.Column("sample_rate", sa.Integer(), nullable=True),
        sa.Column("channels", sa.Integer(), nullable=True),
        sa.Column("file_size", sa.Integer(), server_default="0"),
        sa.Column("analysis_status", sa.String(32), server_default="pending"),
        sa.Column("analysis", JSON, nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        *_ts(),
    )
    op.create_table(
        "tracks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("audio_file_id", sa.String(36), sa.ForeignKey("audio_files.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("color", sa.String(16), server_default="#ff6a00"),
        sa.Column("kind", sa.String(32), server_default="audio"),
        sa.Column("order_index", sa.Integer(), server_default="0"),
        sa.Column("muted", sa.Boolean(), server_default=sa.false()),
        sa.Column("solo", sa.Boolean(), server_default=sa.false()),
        sa.Column("volume", sa.Float(), server_default="0.8"),
        sa.Column("pan", sa.Float(), server_default="0"),
        *_ts(),
    )
    op.create_table(
        "decks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(8), nullable=False),
        sa.Column("audio_file_id", sa.String(36), sa.ForeignKey("audio_files.id"), nullable=True),
        sa.Column("is_playing", sa.Boolean(), server_default=sa.false()),
        sa.Column("position", sa.Float(), server_default="0"),
        sa.Column("pitch", sa.Float(), server_default="0"),
        sa.Column("volume", sa.Float(), server_default="0.8"),
        *_ts(),
    )
    op.create_table(
        "clips",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("track_id", sa.String(36), sa.ForeignKey("tracks.id"), nullable=False),
        sa.Column("audio_file_id", sa.String(36), sa.ForeignKey("audio_files.id"), nullable=True),
        sa.Column("name", sa.String(255), server_default="Clip"),
        sa.Column("start_time", sa.Float(), server_default="0"),
        sa.Column("duration", sa.Float(), server_default="4"),
        sa.Column("offset", sa.Float(), server_default="0"),
        sa.Column("loop", sa.Boolean(), server_default=sa.false()),
        sa.Column("color", sa.String(16), server_default="#3dff7a"),
        *_ts(),
    )
    op.create_table(
        "cue_points",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("audio_file_id", sa.String(36), sa.ForeignKey("audio_files.id"), nullable=False),
        sa.Column("time", sa.Float(), nullable=False),
        sa.Column("label", sa.String(128), server_default="Cue"),
        sa.Column("color", sa.String(16), server_default="#ff6a00"),
        sa.Column("hotcue_index", sa.Integer(), nullable=True),
        *_ts(),
    )
    op.create_table(
        "loop_regions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("audio_file_id", sa.String(36), sa.ForeignKey("audio_files.id"), nullable=False),
        sa.Column("start", sa.Float(), nullable=False),
        sa.Column("end", sa.Float(), nullable=False),
        sa.Column("label", sa.String(128), server_default="Loop"),
        *_ts(),
    )
    op.create_table(
        "beat_grids",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("audio_file_id", sa.String(36), sa.ForeignKey("audio_files.id"), unique=True),
        sa.Column("bpm", sa.Float(), server_default="120"),
        sa.Column("first_beat_offset", sa.Float(), server_default="0"),
        sa.Column("beats", JSON, nullable=True),
        *_ts(),
    )
    op.create_table(
        "mixer_channels",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("role", sa.String(32), server_default="deck"),
        sa.Column("gain", sa.Float(), server_default="0"),
        sa.Column("eq_low", sa.Float(), server_default="0"),
        sa.Column("eq_mid", sa.Float(), server_default="0"),
        sa.Column("eq_high", sa.Float(), server_default="0"),
        sa.Column("filter_knob", sa.Float(), server_default="0"),
        sa.Column("pan", sa.Float(), server_default="0"),
        sa.Column("mute", sa.Boolean(), server_default=sa.false()),
        sa.Column("solo", sa.Boolean(), server_default=sa.false()),
        sa.Column("volume", sa.Float(), server_default="0.8"),
        *_ts(),
    )
    op.create_table(
        "effect_chains",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("mixer_channel_id", sa.String(36), sa.ForeignKey("mixer_channels.id"), unique=True),
        sa.Column("slots", JSON, nullable=True),
        *_ts(),
    )
    op.create_table(
        "effect_presets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("effect_type", sa.String(64), nullable=False),
        sa.Column("params", JSON, nullable=True),
        *_ts(),
    )
    op.create_table(
        "synth_presets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("params", JSON, nullable=True),
        *_ts(),
    )
    op.create_table(
        "drum_kits",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("pads", JSON, nullable=True),
        *_ts(),
    )
    op.create_table(
        "drum_patterns",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("kit_id", sa.String(36), sa.ForeignKey("drum_kits.id"), nullable=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("length", sa.Integer(), server_default="16"),
        sa.Column("swing", sa.Float(), server_default="0"),
        sa.Column("bpm", sa.Float(), server_default="120"),
        sa.Column("steps", JSON, nullable=True),
        *_ts(),
    )
    op.create_table(
        "arrangements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(128), server_default="Arrangement"),
        sa.Column("length_bars", sa.Integer(), server_default="32"),
        sa.Column("structure", JSON, nullable=True),
        *_ts(),
    )
    op.create_table(
        "automation_lanes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("track_id", sa.String(36), sa.ForeignKey("tracks.id"), nullable=True),
        sa.Column("target", sa.String(128), nullable=False),
        sa.Column("points", JSON, nullable=True),
        *_ts(),
    )
    op.create_table(
        "ai_conversations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("title", sa.String(255), server_default="AI Producer"),
        sa.Column("messages", JSON, nullable=True),
        *_ts(),
    )
    op.create_table(
        "ai_tasks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("conversation_id", sa.String(36), sa.ForeignKey("ai_conversations.id"), nullable=False),
        sa.Column("status", sa.String(32), server_default="pending"),
        sa.Column("prompt", sa.Text(), server_default=""),
        sa.Column("result", JSON, nullable=True),
        *_ts(),
    )
    op.create_table(
        "render_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("status", sa.String(32), server_default="queued"),
        sa.Column("format", sa.String(16), server_default="wav"),
        sa.Column("output_path", sa.String(1024), nullable=True),
        sa.Column("progress", sa.Float(), server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        *_ts(),
    )


def downgrade() -> None:
    for table in [
        "render_jobs",
        "ai_tasks",
        "ai_conversations",
        "automation_lanes",
        "arrangements",
        "drum_patterns",
        "drum_kits",
        "synth_presets",
        "effect_presets",
        "effect_chains",
        "mixer_channels",
        "beat_grids",
        "loop_regions",
        "cue_points",
        "clips",
        "decks",
        "tracks",
        "audio_files",
        "projects",
        "users",
    ]:
        op.drop_table(table)
