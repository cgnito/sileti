"""add_is_verified_and_remove_settings_from_org

Revision ID: 39f7d9637be2
Revises: bf73c3c1bfb3
Create Date: 2026-06-29 12:49:59.488613

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '39f7d9637be2'
down_revision: Union[str, Sequence[str], None] = 'bf73c3c1bfb3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # added server_default to handle nullable constraints smoothly
    op.add_column('organizations', sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.drop_column('organizations', 'settings')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('organizations', sa.Column('settings', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True))
    op.drop_column('organizations', 'is_verified')