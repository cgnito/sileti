"""expand webhook logs for payment audit

Revision ID: 9b2a7d6e4c91
Revises: 4fe1ece2ea44
Create Date: 2026-07-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9b2a7d6e4c91"
down_revision: Union[str, Sequence[str], None] = "4fe1ece2ea44"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payment_ledger_entries",
        sa.Column("request_id", sa.String(length=100), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=True),
        sa.Column("invoice_id", sa.UUID(), nullable=True),
        sa.Column("payment_flow", sa.String(length=30), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("gateway_reference", sa.String(length=120), nullable=True),
        sa.Column("transaction_id", sa.String(length=120), nullable=True),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("payment_method", sa.String(length=50), nullable=True),
        sa.Column("customer_name", sa.String(length=255), nullable=True),
        sa.Column("raw_payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("request_id"),
    )

    op.add_column("webhook_logs", sa.Column("payment_flow", sa.String(length=30), nullable=True))
    op.add_column("webhook_logs", sa.Column("gateway_reference", sa.String(length=120), nullable=True))
    op.add_column("webhook_logs", sa.Column("transaction_id", sa.String(length=120), nullable=True))
    op.add_column("webhook_logs", sa.Column("raw_payload", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_table("payment_ledger_entries")
    op.drop_column("webhook_logs", "raw_payload")
    op.drop_column("webhook_logs", "transaction_id")
    op.drop_column("webhook_logs", "gateway_reference")
    op.drop_column("webhook_logs", "payment_flow")
