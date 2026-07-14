"""add email recipient to notification logs

Revision ID: 8d7f2c3b9a11
Revises: ed78f27f5de7
Create Date: 2026-07-06 08:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8d7f2c3b9a11"
down_revision: Union[str, Sequence[str], None] = "ed78f27f5de7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("notification_logs", sa.Column("recipient_email", sa.String(length=255), nullable=True))
    op.alter_column("notification_logs", "recipient_phone", existing_type=sa.String(length=20), nullable=True)


def downgrade() -> None:
    op.alter_column("notification_logs", "recipient_phone", existing_type=sa.String(length=20), nullable=False)
    op.drop_column("notification_logs", "recipient_email")
