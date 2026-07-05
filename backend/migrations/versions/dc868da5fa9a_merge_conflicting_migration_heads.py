"""merge conflicting migration heads

Revision ID: dc868da5fa9a
Revises: a1d2c3f4b5e6, a34e73fb64cc
Create Date: 2026-07-05 00:10:49.049689

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dc868da5fa9a'
down_revision: Union[str, Sequence[str], None] = ('a1d2c3f4b5e6', 'a34e73fb64cc')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
