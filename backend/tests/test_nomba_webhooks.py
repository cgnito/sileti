import asyncio
import base64
import hashlib
import hmac
import os
import unittest
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from routes import webhooks
from schemas.webhooks import WebhookPayload


class NombaWebhookTests(unittest.TestCase):
    def setUp(self):
        os.environ["NOMBA_WEBHOOK_SECRET"] = "webhook-secret"
        webhooks.NOMBA_WEBHOOK_SECRET = os.environ["NOMBA_WEBHOOK_SECRET"]
        engine = create_engine("sqlite:///:memory:")
        models.Base.metadata.create_all(engine)
        self.session_factory = sessionmaker(bind=engine)

    def _make_signature(self, payload: WebhookPayload, timestamp: str) -> str:
        merchant = payload.data.get("merchant", {})
        transaction = payload.data.get("transaction", {})
        response_code = transaction.get("responseCode")
        normalized_response_code = "" if response_code in (None, "null") else str(response_code).strip()
        hashing_payload = (
            f"{payload.event_type}:{payload.request_id}:"
            f"{merchant.get('userId', '')}:{merchant.get('walletId', '')}:"
            f"{transaction.get('transactionId', '')}:{transaction.get('type', '')}:"
            f"{transaction.get('time', '')}:"
            f"{normalized_response_code}:{timestamp}"
        )
        digest = hmac.new(
            os.environ["NOMBA_WEBHOOK_SECRET"].encode("utf-8"),
            hashing_payload.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return base64.b64encode(digest).decode("utf-8")

    def _build_checkout_payload(self, order_ref: str, transaction_id: str, merchant_tx_ref: str | None = None) -> WebhookPayload:
        merchant_tx_ref = merchant_tx_ref or order_ref
        return WebhookPayload.model_validate(
            {
                "event_type": "payment_success",
                "requestId": str(uuid4()),
                "data": {
                    "merchant": {
                        "walletId": "wallet-123",
                        "userId": "user-123",
                    },
                    "transaction": {
                        "transactionId": transaction_id,
                        "type": "online_checkout",
                        "transactionAmount": 500,
                        "time": "2026-02-06T10:21:56Z",
                        "responseCode": "",
                        "merchantTxRef": merchant_tx_ref,
                    },
                    "order": {
                        "orderReference": order_ref,
                    },
                },
            }
        )

    def _seed_checkout_state(self, db, order_ref: str):
        org = models.Organization(
            school_name="Greenwood Academy",
            short_code="GREEN",
            school_email="greenwood@example.com",
            hashed_password="hash",
            slug="greenwood-academy",
        )
        db.add(org)
        db.flush()

        school_class = models.SchoolClass(org_id=org.id, name="JSS 1", level=1)
        db.add(school_class)
        db.flush()

        student = models.Student(
            org_id=org.id,
            class_id=school_class.id,
            silete_id="KWA/2026/0001",
            serial_number=1,
            admission_year=2026,
            first_name="Ada",
            last_name="Lovelace",
        )
        db.add(student)
        db.flush()

        invoice = models.Invoice(
            org_id=org.id,
            student_id=student.id,
            session="2025/2026",
            term="First Term",
            total_amount=1000,
            paid_amount=0,
            status=models.InvoiceStatus.UNPAID,
        )
        db.add(invoice)
        db.flush()

        transaction = models.Transaction(
            org_id=org.id,
            invoice_id=invoice.id,
            amount=500,
            reference=order_ref,
            status=models.TransactionStatus.PENDING.value,
        )
        db.add(transaction)
        db.commit()

        return org, invoice, transaction

    def test_checkout_webhook_marks_invoice_paid_and_logs_event(self):
        db = self.session_factory()
        order_ref = "SIL-ABC123DEF456"
        _, invoice, transaction = self._seed_checkout_state(db, order_ref)
        payload = self._build_checkout_payload(order_ref=order_ref, transaction_id="tx-checkout-001")
        timestamp = "2026-02-06T10:21:56Z"
        signature = self._make_signature(payload, timestamp)

        with patch("routes.webhooks.nomba.verify_transaction_by_id") as mock_verify:
            mock_verify.return_value = {
                "status": "SUCCESS",
                "orderReference": order_ref,
                "paymentMethod": "transfer",
                "amount": 500,
            }

            result = asyncio.run(
                webhooks.nomba_webhook_handler(
                    payload=payload,
                    nomba_signature=signature,
                    nomba_timestamp=timestamp,
                    db=db,
                )
            )

        self.assertEqual(result["status"], "success")
        db.refresh(transaction)
        db.refresh(invoice)
        self.assertEqual(transaction.status, models.TransactionStatus.SUCCESS.value)
        self.assertEqual(float(invoice.paid_amount), 500.0)
        self.assertEqual(invoice.status, models.InvoiceStatus.PARTIAL)

        log = db.query(models.WebhookLog).filter(models.WebhookLog.request_id == payload.request_id).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.payment_flow, "checkout")
        self.assertEqual(log.gateway_reference, order_ref)
        self.assertEqual(log.transaction_id, "tx-checkout-001")

        ledger = db.query(models.PaymentLedger).filter(models.PaymentLedger.request_id == payload.request_id).first()
        self.assertIsNotNone(ledger)
        self.assertEqual(ledger.payment_flow, "checkout")
        self.assertEqual(ledger.status, models.PaymentLedgerStatus.SUCCESS.value)
        self.assertEqual(float(ledger.amount), 500.0)
        self.assertEqual(ledger.invoice_id, invoice.id)

    def test_checkout_webhook_uses_order_reference_even_when_merchant_tx_ref_differs(self):
        db = self.session_factory()
        order_ref = "order-ref-test-0001"
        merchant_ref = "mref-001"
        _, invoice, transaction = self._seed_checkout_state(db, order_ref)
        payload = self._build_checkout_payload(order_ref=order_ref, transaction_id="tx-checkout-002", merchant_tx_ref=merchant_ref)
        timestamp = "2026-02-06T10:21:56Z"
        signature = self._make_signature(payload, timestamp)

        with patch("routes.webhooks.nomba.verify_transaction_by_id") as mock_verify:
            mock_verify.return_value = {
                "status": "SUCCESS",
                "orderReference": order_ref,
                "merchantTxRef": merchant_ref,
                "paymentMethod": "transfer",
                "amount": 500,
            }

            result = asyncio.run(
                webhooks.nomba_webhook_handler(
                    payload=payload,
                    nomba_signature=signature,
                    nomba_timestamp=timestamp,
                    db=db,
                )
            )

        self.assertEqual(result["status"], "success")
        db.refresh(transaction)
        db.refresh(invoice)
        self.assertEqual(transaction.status, models.TransactionStatus.SUCCESS.value)
        self.assertEqual(float(invoice.paid_amount), 500.0)

        ledger = db.query(models.PaymentLedger).filter(models.PaymentLedger.request_id == payload.request_id).first()
        self.assertIsNotNone(ledger)
        self.assertEqual(ledger.gateway_reference, order_ref)
        self.assertEqual(ledger.status, models.PaymentLedgerStatus.SUCCESS.value)

    def test_duplicate_checkout_webhook_does_not_double_count_payment(self):
        db = self.session_factory()
        order_ref = "SIL-ABC123DEF456"
        _, invoice, transaction = self._seed_checkout_state(db, order_ref)
        first_payload = self._build_checkout_payload(order_ref=order_ref, transaction_id="tx-checkout-001")
        second_payload = self._build_checkout_payload(order_ref=order_ref, transaction_id="tx-checkout-001")
        timestamp = "2026-02-06T10:21:56Z"
        first_signature = self._make_signature(first_payload, timestamp)
        second_signature = self._make_signature(second_payload, timestamp)

        with patch("routes.webhooks.nomba.verify_transaction_by_id") as mock_verify:
            mock_verify.return_value = {
                "status": "SUCCESS",
                "orderReference": order_ref,
                "paymentMethod": "transfer",
                "amount": 500,
            }

            asyncio.run(
                webhooks.nomba_webhook_handler(
                    payload=first_payload,
                    nomba_signature=first_signature,
                    nomba_timestamp=timestamp,
                    db=db,
                )
            )

            asyncio.run(
                webhooks.nomba_webhook_handler(
                    payload=second_payload,
                    nomba_signature=second_signature,
                    nomba_timestamp=timestamp,
                    db=db,
                )
            )

        db.refresh(transaction)
        db.refresh(invoice)
        self.assertEqual(transaction.status, models.TransactionStatus.SUCCESS.value)
        self.assertEqual(float(invoice.paid_amount), 500.0)
        self.assertEqual(invoice.status, models.InvoiceStatus.PARTIAL)

        success_ledgers = db.query(models.PaymentLedger).filter(
            models.PaymentLedger.invoice_id == invoice.id,
            models.PaymentLedger.status == models.PaymentLedgerStatus.SUCCESS.value,
        ).all()
        self.assertEqual(len(success_ledgers), 1)


if __name__ == "__main__":
    unittest.main()
