"""second_schema_is_active_false

Revision ID: 1b7bffb1083a
Revises: a691922ece75
Create Date: 2026-04-30 15:26:36.154603

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1b7bffb1083a'
down_revision: Union[str, Sequence[str], None] = 'a691922ece75'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    #set the server-side default for new rows
    op.alter_column('users', 'is_active',
               existing_type=sa.Boolean(),
               server_default=sa.text('false'),
               nullable=True)
    
    #optional: update any existing users that might be True back to False
    op.execute("UPDATE users SET is_active = false")


def downgrade() -> None:
    # Revert the server-side default (if you want to go back to True)
    op.alter_column('users', 'is_active',
               existing_type=sa.Boolean(),
               server_default=sa.text('true'),
               nullable=True)
