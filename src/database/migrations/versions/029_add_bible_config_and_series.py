"""Add bible_config column to reels_jobs and create reels_series table.

Phase 1001: Biblical Reels Category — data foundation for biblical reel support.

Revision ID: 029
Revises: 028
"""

import sqlalchemy as sa
from alembic import op

revision = "029"
down_revision = "028"


def upgrade() -> None:
    # bible_config JSON on ReelsJob
    op.add_column("reels_jobs", sa.Column("bible_config", sa.JSON, nullable=True))

    # Series table for multi-part biblical series
    op.create_table(
        "reels_series",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Series FK and part_number on ReelsJob
    op.add_column(
        "reels_jobs",
        sa.Column("series_id", sa.Integer, sa.ForeignKey("reels_series.id"), nullable=True),
    )
    op.add_column("reels_jobs", sa.Column("part_number", sa.Integer, nullable=True))


def downgrade() -> None:
    op.drop_column("reels_jobs", "part_number")
    op.drop_column("reels_jobs", "series_id")
    op.drop_column("reels_jobs", "bible_config")
    op.drop_table("reels_series")
