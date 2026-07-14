"""add reversed transaction status

Revision ID: a1d2c3f4b5e6
Revises: 3f0a1c9bcdea
Create Date: 2026-07-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1d2c3f4b5e6'
down_revision: Union[str, Sequence[str], None] = '3f0a1c9bcdea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    No schema-level changes required because `transactions.status` is stored
    as a plain string. This migration records the addition of the
    `REVERSED` value to the `TransactionStatus` application enum.
    """
    # No-op migration: application-level enum extended.
    pass


def downgrade() -> None:
    """Downgrade schema.

    No-op: cannot safely remove enum value from existing application code.
    """
    pass
