"""project share_token

Revision ID: 002_share_token
Revises: 001_initial
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa

revision = "002_share_token"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("share_token", sa.String(64), nullable=True))
    op.create_index("ix_projects_share_token", "projects", ["share_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_projects_share_token", table_name="projects")
    op.drop_column("projects", "share_token")
