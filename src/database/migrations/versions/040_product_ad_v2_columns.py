"""Add v2 columns to product_ad_jobs for multi-scene cinematic pipeline.

Phase 1002 — Product Studio v2. Adds pipeline_version, takes_config,
storyboard, image_urls, category columns to product_ad_jobs. All new
columns are nullable or have server defaults so existing v1 rows remain
valid (REQ-PS2-11 backward compat).

Revision ID: 040_product_ad_v2
Revises: 030
"""
from typing import Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = '040_product_ad_v2'
down_revision: Union[str, None] = '030'
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column(
        'product_ad_jobs',
        sa.Column('pipeline_version', sa.Integer(), server_default='1', nullable=False),
    )
    op.add_column(
        'product_ad_jobs',
        sa.Column('takes_config', sa.JSON(), nullable=True),
    )
    op.add_column(
        'product_ad_jobs',
        sa.Column('storyboard', sa.JSON(), nullable=True),
    )
    op.add_column(
        'product_ad_jobs',
        sa.Column('image_urls', sa.JSON(), nullable=True),
    )
    op.add_column(
        'product_ad_jobs',
        sa.Column('category', sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('product_ad_jobs', 'category')
    op.drop_column('product_ad_jobs', 'image_urls')
    op.drop_column('product_ad_jobs', 'storyboard')
    op.drop_column('product_ad_jobs', 'takes_config')
    op.drop_column('product_ad_jobs', 'pipeline_version')
