"""
Verifies that the models package re-exports every model and Base correctly,
and that SQLAlchemy metadata contains all expected table names.
"""
import unittest


class ModelsImportTest(unittest.TestCase):
    """All models are importable from the app.models package."""

    def test_base_importable(self):
        from app.models import Base
        self.assertIsNotNone(Base)

    def test_org_models(self):
        from app.models import Organization, BankSettlement
        self.assertIsNotNone(Organization)
        self.assertIsNotNone(BankSettlement)

    def test_user_models(self):
        from app.models import User, UserRole
        self.assertIsNotNone(User)
        self.assertEqual(UserRole.STAFF, "staff")

    def test_student_models(self):
        from app.models import Student, Parent, SchoolClass, StudentStatus, student_parents
        self.assertIsNotNone(Student)
        self.assertIsNotNone(Parent)
        self.assertIsNotNone(SchoolClass)
        self.assertEqual(StudentStatus.ACTIVE, "active")
        self.assertIsNotNone(student_parents)

    def test_billing_models(self):
        from app.models import FeeTemplate, FeeLineItem, Invoice, InvoiceDetail, InvoiceStatus
        self.assertIsNotNone(FeeTemplate)
        self.assertIsNotNone(FeeLineItem)
        self.assertIsNotNone(Invoice)
        self.assertIsNotNone(InvoiceDetail)
        self.assertEqual(InvoiceStatus.UNPAID, "unpaid")
        self.assertEqual(InvoiceStatus.PAID, "paid")

    def test_payment_models(self):
        from app.models import (
            Transaction,
            TransactionStatus,
            PaymentLedger,
            PaymentLedgerStatus,
            WebhookLog,
            NotificationLog,
        )
        self.assertIsNotNone(Transaction)
        self.assertIsNotNone(PaymentLedger)
        self.assertIsNotNone(WebhookLog)
        self.assertIsNotNone(NotificationLog)
        self.assertEqual(TransactionStatus.PENDING, "PENDING")
        self.assertEqual(PaymentLedgerStatus.IGNORED, "IGNORED")


class MetadataTablesTest(unittest.TestCase):
    """Base.metadata contains all expected table names."""

    EXPECTED_TABLES = {
        "organizations",
        "bank_settlements",
        "users",
        "classes",
        "student_parents",
        "students",
        "parents",
        "fee_templates",
        "fee_line_items",
        "invoices",
        "invoice_details",
        "transactions",
        "payment_ledger_entries",
        "webhook_logs",
        "notification_logs",
    }

    def test_all_tables_present(self):
        from app.models import Base
        table_names = set(Base.metadata.tables.keys())
        missing = self.EXPECTED_TABLES - table_names
        self.assertEqual(missing, set(), f"Missing tables in metadata: {missing}")

    def test_sqlite_create_all(self):
        """Smoke test: all tables can be created against an in-memory SQLite DB."""
        from sqlalchemy import create_engine
        from app.models import Base
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        from sqlalchemy import inspect
        inspector = inspect(engine)
        created = set(inspector.get_table_names())
        self.assertEqual(self.EXPECTED_TABLES, created)


if __name__ == "__main__":
    unittest.main()
