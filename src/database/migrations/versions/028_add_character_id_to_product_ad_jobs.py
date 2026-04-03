"""Add character_id column to product_ad_jobs for character-scoped navigation.

Revision ID: 028
Revises: 027
"""

import sqlalchemy as sa
from alembic import op

revision = "028"
down_revision = "027"


def upgrade() -> None:
    op.add_column(
        "product_ad_jobs",
        sa.Column("character_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_product_ad_jobs_character_id",
        "product_ad_jobs",
        "characters",
        ["character_id"],
        ["id"],
    )
    op.create_index(
        "idx_product_ad_jobs_character_id",
        "product_ad_jobs",
        ["character_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_product_ad_jobs_character_id", table_name="product_ad_jobs")
    op.drop_constraint(
        "fk_product_ad_jobs_character_id",
        "product_ad_jobs",
        type_="foreignkey",
    )
    op.drop_column("product_ad_jobs", "character_id")
