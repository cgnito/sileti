"""merge conflicting migration heads

Revision ID: 4fe1ece2ea44
Revises: 7c1f5d2a9c4b, e4f2b1c6d0a1
Create Date: 2026-07-04 02:22:40.145744

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4fe1ece2ea44'
down_revision: Union[str, Sequence[str], None] = ('7c1f5d2a9c4b', 'e4f2b1c6d0a1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
