"""
app/models — SQLAlchemy ORM models, split by domain.

All models and Base are re-exported here so existing code that does
`from app.models import X` or `from app import models; models.X`
continues to work without modification.

Alembic's env.py imports `Base` from here and gets all table metadata
automatically because every domain module is imported below.
"""
from .base import Base  # noqa: F401

from .org import Organization, BankSettlement  # noqa: F401
from .user import User, UserRole  # noqa: F401
from .student import StudentStatus, SchoolClass, student_parents, Student, Parent  # noqa: F401
from .billing import InvoiceStatus, FeeTemplate, FeeLineItem, Invoice, InvoiceDetail  # noqa: F401
from .payment import (  # noqa: F401
    TransactionStatus,
    PaymentLedgerStatus,
    Transaction,
    PaymentLedger,
    WebhookLog,
    NotificationLog,
)

__all__ = [
    "Base",
    # org
    "Organization",
    "BankSettlement",
    # user
    "User",
    "UserRole",
    # student
    "StudentStatus",
    "SchoolClass",
    "student_parents",
    "Student",
    "Parent",
    # billing
    "InvoiceStatus",
    "FeeTemplate",
    "FeeLineItem",
    "Invoice",
    "InvoiceDetail",
    # payment
    "TransactionStatus",
    "PaymentLedgerStatus",
    "Transaction",
    "PaymentLedger",
    "WebhookLog",
    "NotificationLog",
]
