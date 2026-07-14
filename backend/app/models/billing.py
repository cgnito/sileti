import uuid
import enum
from sqlalchemy import Enum, Column, String, DateTime, Boolean, ForeignKey, Date, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from .base import Base


class InvoiceStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PARTIAL = "partially_paid"
    PAID = "paid"
    VOIDED = "voided"


class FeeTemplate(Base):
    __tablename__ = "fee_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    line_items = relationship("FeeLineItem", back_populates="template", cascade="all, delete-orphan")


class FeeLineItem(Base):
    __tablename__ = "fee_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("fee_templates.id"), nullable=False)
    name = Column(String(100), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    is_compulsory = Column(Boolean, default=True)

    template = relationship("FeeTemplate", back_populates="line_items")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("fee_templates.id"), nullable=True)
    session = Column(String(20), nullable=False)
    term = Column(String(20), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    paid_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.UNPAID)
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student")
    template = relationship("FeeTemplate")
    items = relationship("InvoiceDetail", back_populates="invoice", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="invoice", cascade="all, delete-orphan")
    ledger_entries = relationship("PaymentLedger", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceDetail(Base):
    __tablename__ = "invoice_details"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    name = Column(String(255), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)

    invoice = relationship("Invoice", back_populates="items")
