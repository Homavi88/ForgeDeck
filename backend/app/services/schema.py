"""Guarantee extra columns exist on already-created SQLite/Postgres DBs."""

from __future__ import annotations

from sqlalchemy import inspect, text

from app.database import engine


def _dedupe_named_rows(conn, table: str) -> list[str]:
    """Keep the oldest row per (project_id, name); return extra ids."""
    rows = conn.execute(
        text(
            f"SELECT id, project_id, name FROM {table} "
            "WHERE project_id IS NOT NULL ORDER BY created_at ASC, id ASC"
        )
    ).fetchall()
    seen: set[tuple[str, str]] = set()
    extra: list[str] = []
    for row_id, project_id, name in rows:
        key = (str(project_id), str(name))
        if key in seen:
            extra.append(str(row_id))
        else:
            seen.add(key)
    return extra


def ensure_schema() -> None:
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    if "projects" not in tables:
        return
    cols = {c["name"] for c in insp.get_columns("projects")}
    stmts: list[str] = []
    if "share_token" not in cols:
        stmts.append("ALTER TABLE projects ADD COLUMN share_token VARCHAR(64)")
    if "graph_revision" not in cols:
        stmts.append("ALTER TABLE projects ADD COLUMN graph_revision INTEGER NOT NULL DEFAULT 0")
    with engine.begin() as conn:
        for sql in stmts:
            conn.execute(text(sql))
        conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_projects_share_token ON projects (share_token)")
        )
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS project_snapshots ("
                "id VARCHAR(36) PRIMARY KEY, project_id VARCHAR(36) NOT NULL, revision INTEGER NOT NULL, "
                "label VARCHAR(255) NOT NULL DEFAULT 'Autosave', graph JSON NOT NULL, "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
                "FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)"
            )
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_project_snapshots_project_id ON project_snapshots (project_id)")
        )
        if "render_jobs" in tables:
            render_cols = {c["name"] for c in insp.get_columns("render_jobs")}
            if "source" not in render_cols:
                conn.execute(text("ALTER TABLE render_jobs ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'server_render'"))
            if "details" not in render_cols:
                conn.execute(text("ALTER TABLE render_jobs ADD COLUMN details JSON NOT NULL DEFAULT '{}'"))

        if "mixer_channels" in tables and "effect_chains" in tables:
            extra = _dedupe_named_rows(conn, "mixer_channels")
            for row_id in extra:
                conn.execute(text("DELETE FROM effect_chains WHERE mixer_channel_id = :id"), {"id": row_id})
                conn.execute(text("DELETE FROM mixer_channels WHERE id = :id"), {"id": row_id})
        if "drum_patterns" in tables:
            for row_id in _dedupe_named_rows(conn, "drum_patterns"):
                conn.execute(text("DELETE FROM drum_patterns WHERE id = :id"), {"id": row_id})
        if "synth_presets" in tables:
            for row_id in _dedupe_named_rows(conn, "synth_presets"):
                conn.execute(text("DELETE FROM synth_presets WHERE id = :id"), {"id": row_id})

        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_drum_patterns_project_name "
                "ON drum_patterns (project_id, name)"
            )
        )
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_mixer_channels_project_name "
                "ON mixer_channels (project_id, name)"
            )
        )
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_synth_presets_project_name "
                "ON synth_presets (project_id, name)"
            )
        )
