"""Create user_credits and credit_logs tables for credit system.

Pre-paid credit balance per user and per-call audit log for all Kie.ai API calls.

Revision ID: 027
Revises: 026
"""

import sqlalchemy as sa
from alembic import op

revision = "027"
down_revision = "026"


def upgrade() -> None:
    op.create_table(
        "user_credits",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("balance", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    op.create_table(
        "credit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("duration", sa.Integer(), nullable=True),
        sa.Column("credits", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("job_type", sa.String(20), nullable=True),
        sa.Column("job_id", sa.String(36), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    op.create_index("ix_credit_logs_user_date", "credit_logs", ["user_id", "created_at"])
    op.create_index("ix_credit_logs_type", "credit_logs", ["type"])


def downgrade() -> None:
    op.drop_index("ix_credit_logs_type", table_name="credit_logs")
    op.drop_index("ix_credit_logs_user_date", table_name="credit_logs")
    op.drop_table("credit_logs")
    op.drop_table("user_credits")
