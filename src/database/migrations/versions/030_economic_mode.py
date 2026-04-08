"""add economic_mode column to reels_config

Revision ID: 030
Revises: 029
Create Date: 2026-04-07

Phase 999.14: Economic asset mode (Ken Burns)
- economic_mode Boolean column on reels_config; default False
- When true, the pipeline skips Kie API entirely and produces static
  clips for every scene. The editor applies Ken Burns motion at
  preview/render time via Remotion interpolate (no ffmpeg zoompan).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '030'
down_revision: Union[str, None] = '029'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "reels_config",
        sa.Column("economic_mode", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("reels_config", "economic_mode")
