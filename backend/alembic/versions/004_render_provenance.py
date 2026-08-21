"""render and recording provenance

Revision ID: 004_render_provenance
Revises: 003_project_snapshots
Create Date: 2026-08-21
"""

from alembic import op
import sqlalchemy as sa


revision = "004_render_provenance"
down_revision = "003_project_snapshots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "render_jobs",
        sa.Column("source", sa.String(length=32), nullable=False, server_default="server_render"),
    )
    op.add_column(
        "render_jobs",
        sa.Column("details", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )


def downgrade() -> None:
    op.drop_column("render_jobs", "details")
    op.drop_column("render_jobs", "source")
