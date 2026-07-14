import uuid
import enum
from sqlalchemy import Enum, Column, String, DateTime, JSON, ForeignKey, Numeric, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from .base import Base


class TransactionStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REVERSED = "REVERSED"


class PaymentLedgerStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REVERSED = "REVERSED"
    IGNORED = "IGNORED"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    reference = Column(String(100), unique=True, nullable=False)
    status = Column(String(50), nullable=False, default=TransactionStatus.PENDING.value)
    payment_method = Column(String(50), nullable=True)
    checkout_url = Column(String(512), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    invoice = relationship("Invoice", back_populates="transactions")


class PaymentLedger(Base):
    __tablename__ = "payment_ledger_entries"

    request_id = Column(String(100), primary_key=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    payment_flow = Column(String(30), nullable=False)
    event_type = Column(String(50), nullable=False)
    gateway_reference = Column(String(120), nullable=True)
    transaction_id = Column(String(120), nullable=True)
    amount = Column(Numeric(12, 2), nullable=True)
    status = Column(String(20), nullable=False, default=PaymentLedgerStatus.PENDING.value)
    payment_method = Column(String(50), nullable=True)
    customer_name = Column(String(255), nullable=True)
    raw_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    invoice = relationship("Invoice", back_populates="ledger_entries")


class WebhookLog(Base):
    __tablename__ = "webhook_logs"

    # Nomba's exact requestId as the primary key — DB naturally rejects duplicates.
    request_id = Column(String(100), primary_key=True)
    event_type = Column(String(50), nullable=False)
    payment_flow = Column(String(30), nullable=True)
    gateway_reference = Column(String(120), nullable=True)
    transaction_id = Column(String(120), nullable=True)
    raw_payload = Column(JSON, nullable=True)
    processed_at = Column(DateTime(timezone=True), server_default=func.now())


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    idempotency_key = Column(String(180), nullable=False, unique=True, index=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    channel = Column(String(30), nullable=False, default="whatsapp")
    event_type = Column(String(50), nullable=False)
    recipient_phone = Column(String(20), nullable=True)
    recipient_email = Column(String(255), nullable=True)
    message_sid = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="queued")
    error_message = Column(String(255), nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
