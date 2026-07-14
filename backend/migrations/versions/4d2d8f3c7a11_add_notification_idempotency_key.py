"""add notification idempotency key

Revision ID: 4d2d8f3c7a11
Revises: 2c9f7e8a1b6d
Create Date: 2026-07-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4d2d8f3c7a11"
down_revision: Union[str, Sequence[str], None] = "2c9f7e8a1b6d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("notification_logs", sa.Column("idempotency_key", sa.String(length=180), nullable=False))
    op.create_index(op.f("ix_notification_logs_idempotency_key"), "notification_logs", ["idempotency_key"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_notification_logs_idempotency_key"), table_name="notification_logs")
    op.drop_column("notification_logs", "idempotency_key")
