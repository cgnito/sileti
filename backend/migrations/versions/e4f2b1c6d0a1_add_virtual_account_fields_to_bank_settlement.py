"""add virtual account fields to bank settlements

Revision ID: e4f2b1c6d0a1
Revises: 3f0a1c9bcdea
Create Date: 2026-07-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e4f2b1c6d0a1'
down_revision: Union[str, Sequence[str], None] = '3f0a1c9bcdea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bank_settlements', sa.Column('nomba_virtual_account_ref', sa.String(length=255), nullable=True))
    op.add_column('bank_settlements', sa.Column('nomba_virtual_account_number', sa.String(length=50), nullable=True))
    op.add_column('bank_settlements', sa.Column('nomba_virtual_account_name', sa.String(length=255), nullable=True))
    op.add_column('bank_settlements', sa.Column('nomba_virtual_account_bank_name', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('bank_settlements', 'nomba_virtual_account_bank_name')
    op.drop_column('bank_settlements', 'nomba_virtual_account_name')
    op.drop_column('bank_settlements', 'nomba_virtual_account_number')
    op.drop_column('bank_settlements', 'nomba_virtual_account_ref')
