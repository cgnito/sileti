"""add template id to invoices

Revision ID: 1f2a3b4c5d6e
Revises: 8d7f2c3b9a11
Create Date: 2026-07-06 12:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1f2a3b4c5d6e"
down_revision: Union[str, Sequence[str], None] = "8d7f2c3b9a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("template_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_invoices_template_id_fee_templates",
        "invoices",
        "fee_templates",
        ["template_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_invoices_template_id_fee_templates", "invoices", type_="foreignkey")
    op.drop_column("invoices", "template_id")
