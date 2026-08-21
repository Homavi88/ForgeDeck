"""project graph revisions and restore points

Revision ID: 003_project_snapshots
Revises: 002_share_token
Create Date: 2026-08-21
"""

from alembic import op
import sqlalchemy as sa


revision = "003_project_snapshots"
down_revision = "002_share_token"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("graph_revision", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "project_snapshots",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False, server_default="Autosave"),
        sa.Column("graph", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_snapshots_project_id", "project_snapshots", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_project_snapshots_project_id", table_name="project_snapshots")
    op.drop_table("project_snapshots")
    op.drop_column("projects", "graph_revision")
