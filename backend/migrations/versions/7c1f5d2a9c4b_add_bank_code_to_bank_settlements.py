"""add bank_code to bank_settlements

Revision ID: 7c1f5d2a9c4b
Revises: 3f0a1c9bcdea
Create Date: 2026-07-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7c1f5d2a9c4b"
down_revision: Union[str, Sequence[str], None] = "3f0a1c9bcdea"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bank_settlements", sa.Column("bank_code", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("bank_settlements", "bank_code")
