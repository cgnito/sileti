"""merge main and payments heads

Revision ID: ed78f27f5de7
Revises: dc868da5fa9a, 4d2d8f3c7a11
Create Date: 2026-07-06 00:33:32.810736

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ed78f27f5de7'
down_revision: Union[str, Sequence[str], None] = ('dc868da5fa9a', '4d2d8f3c7a11')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
