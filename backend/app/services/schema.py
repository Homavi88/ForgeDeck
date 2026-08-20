"""Guarantee extra columns exist on already-created SQLite/Postgres DBs."""

from __future__ import annotations

from sqlalchemy import inspect, text

from app.database import engine


def ensure_schema() -> None:
    insp = inspect(engine)
    if "projects" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("projects")}
    stmts: list[str] = []
    if "share_token" not in cols:
        stmts.append("ALTER TABLE projects ADD COLUMN share_token VARCHAR(64)")
    with engine.begin() as conn:
        for sql in stmts:
            conn.execute(text(sql))
        conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_projects_share_token ON projects (share_token)")
        )
