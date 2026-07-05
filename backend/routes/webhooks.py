import os
import hmac
import hashlib
import base64
import logging
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Header
from sqlalchemy.orm import Session

from . import payments
from database import get_db
from models import Invoice, InvoiceStatus, PaymentLedger, PaymentLedgerStatus, Transaction, TransactionStatus, WebhookLog
from schemas.webhooks import WebhookPayload
from services import notifications

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

NOMBA_WEBHOOK_SECRET = os.environ.get("NOMBA_WEBHOOK_SECRET")


def _normalize_response_code(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned.lower() == "null":
            return ""
        return cleaned
    return str(value)


def _get_data_blocks(payload: WebhookPayload) -> tuple[dict, dict, dict]:
    data_block = payload.data if isinstance(payload.data, dict) else {}
    merchant = data_block.get("merchant") if isinstance(data_block.get("merchant"), dict) else {}
    transaction_data = data_block.get("transaction") if isinstance(data_block.get("transaction"), dict) else {}
    order_data = data_block.get("order") if isinstance(data_block.get("order"), dict) else {}
    return merchant, transaction_data, order_data


def _build_signature_payload(payload: WebhookPayload, nomba_timestamp: str) -> str:
    merchant, transaction_data, _ = _get_data_blocks(payload)
    return (
        f"{payload.event_type}:{payload.request_id}:"
        f"{merchant.get('userId', '')}:{merchant.get('walletId', '')}:"
        f"{transaction_data.get('transactionId', '')}:{transaction_data.get('type', '')}:"
        f"{transaction_data.get('time', '')}:"
        f"{_normalize_response_code(transaction_data.get('responseCode'))}:{nomba_timestamp}"
    )


def _save_webhook_log(
    db: Session,
    payload: WebhookPayload,
    payment_flow: str | None,
    gateway_reference: str | None,
    transaction_id: str | None,
) -> None:
    db.add(
        WebhookLog(
            request_id=payload.request_id,
            event_type=payload.event_type,
            payment_flow=payment_flow,
            gateway_reference=gateway_reference,
            transaction_id=transaction_id,
            raw_payload=payload.model_dump(mode="json", by_alias=True),
        )
    )


def _save_payment_ledger(
    db: Session,
    payload: WebhookPayload,
    payment_flow: str,
    gateway_reference: str | None,
    transaction_id: str | None,
    status: str,
    org_id=None,
    invoice_id=None,
    amount=None,
    payment_method: str | None = None,
    customer_name: str | None = None,
) -> None:
    numeric_amount = None
    if amount is not None:
        try:
            numeric_amount = Decimal(str(amount))
        except Exception:
            numeric_amount = None

    db.add(
        PaymentLedger(
            request_id=payload.request_id,
            org_id=org_id,
            invoice_id=invoice_id,
            payment_flow=payment_flow,
            event_type=payload.event_type,
            gateway_reference=gateway_reference,
            transaction_id=transaction_id,
            amount=numeric_amount,
            status=status,
            payment_method=payment_method,
            customer_name=customer_name,
            raw_payload=payload.model_dump(mode="json", by_alias=True),
        )
    )


def _commit_event(
    db: Session,
    payload: WebhookPayload,
    payment_flow: str | None,
    gateway_reference: str | None,
    transaction_id: str | None,
    *,
    ledger_status: str | None = None,
    org_id=None,
    invoice_id=None,
    amount=None,
    payment_method: str | None = None,
    customer_name: str | None = None,
) -> None:
    _save_webhook_log(db, payload, payment_flow, gateway_reference, transaction_id)

    if ledger_status and payment_flow:
        _save_payment_ledger(
            db,
            payload,
            payment_flow,
            gateway_reference,
            transaction_id,
            ledger_status,
            org_id=org_id,
            invoice_id=invoice_id,
            amount=amount,
            payment_method=payment_method,
            customer_name=customer_name,
        )

    db.commit()


@router.post("/nomba")
async def nomba_webhook_handler(
    payload: WebhookPayload,
    nomba_signature: str = Header(..., alias="nomba-signature"),
    nomba_timestamp: str = Header(..., alias="nomba-timestamp"),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    if not NOMBA_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret missing configuration.")

    try:
        hashing_payload = _build_signature_payload(payload, nomba_timestamp)
    except Exception as exc:
        logger.error("Malformed Nomba webhook payload: %s", exc)
        raise HTTPException(status_code=400, detail="Malformed structure.") from exc

    computed_digest = hmac.new(
        NOMBA_WEBHOOK_SECRET.encode("utf-8"),
        hashing_payload.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    computed_signature = base64.b64encode(computed_digest).decode("utf-8")

    if not hmac.compare_digest(nomba_signature.strip(), computed_signature):
        raise HTTPException(status_code=401, detail="Signature mismatch.")

    existing_log = db.query(WebhookLog).filter(WebhookLog.request_id == payload.request_id).first()
    if existing_log:
        return {"status": "success", "message": "Already processed."}

    _, transaction_data, order_data = _get_data_blocks(payload)
    transaction_id = transaction_data.get("transactionId")
    payment_flow = "checkout"
    gateway_reference = None

    if payload.event_type == "payment_success":
        order_ref = order_data.get("orderReference") or transaction_data.get("merchantTxRef")

        verification = {}
        if transaction_id:
            try:
                verification = payments.verify_transaction_by_id(transaction_id)
            except Exception:
                verification = {}

        if not verification and order_ref:
            verification = payments.verify_checkout_transaction(order_ref)

        resolved_order_ref = (
            verification.get("orderReference")
            or verification.get("merchantTxRef")
            or order_ref
        )
        gateway_reference = resolved_order_ref or transaction_id

        if not resolved_order_ref:
            logger.error("No orderReference or transactionRef could be resolved for checkout webhook.")
            _commit_event(
                db,
                payload,
                payment_flow,
                gateway_reference,
                transaction_id,
                ledger_status=PaymentLedgerStatus.IGNORED.value,
            )
            return {"status": "ignored", "message": "No checkout reference provided"}

        db_transaction = db.query(Transaction).filter(Transaction.reference == resolved_order_ref).first()
        if not db_transaction:
            logger.error("Transaction reference %s not found in database.", resolved_order_ref)
            _commit_event(
                db,
                payload,
                payment_flow,
                gateway_reference,
                transaction_id,
                ledger_status=PaymentLedgerStatus.IGNORED.value,
            )
            return {"status": "ignored", "message": "Transaction reference mismatch"}

        status_from_nomba = verification.get("status")

        existing_success_ledger = db.query(PaymentLedger).filter(
            PaymentLedger.payment_flow == payment_flow,
            PaymentLedger.invoice_id == db_transaction.invoice_id,
            PaymentLedger.gateway_reference == resolved_order_ref,
            PaymentLedger.status == PaymentLedgerStatus.SUCCESS.value,
        ).first()

        if status_from_nomba == "SUCCESS" and existing_success_ledger:
            logger.info(
                "Ignoring duplicate checkout success webhook for order %s because a successful ledger entry already exists.",
                resolved_order_ref,
            )
            _commit_event(
                db,
                payload,
                payment_flow,
                gateway_reference,
                transaction_id,
                ledger_status=PaymentLedgerStatus.IGNORED.value,
                org_id=db_transaction.org_id,
                invoice_id=db_transaction.invoice_id,
                amount=transaction_data.get("transactionAmount") or verification.get("amount") or db_transaction.amount,
                payment_method=db_transaction.payment_method,
                customer_name=transaction_data.get("narration") or transaction_data.get("senderName") or transaction_data.get("customerName"),
            )
            return {"status": "success", "message": "Already processed."}

        if status_from_nomba == "SUCCESS":
            db_transaction.status = TransactionStatus.SUCCESS.value
            db_transaction.payment_method = transaction_data.get("channel") or verification.get("paymentMethod")

            invoice = db_transaction.invoice
            if invoice:
                received_amount = transaction_data.get("transactionAmount") or verification.get("amount") or 0
                try:
                    invoice.paid_amount += Decimal(str(received_amount))
                except Exception:
                    invoice.paid_amount += received_amount

                if invoice.paid_amount >= invoice.total_amount:
                    invoice.status = InvoiceStatus.PAID
                else:
                    invoice.status = InvoiceStatus.PARTIAL
        else:
            db_transaction.status = TransactionStatus.FAILED.value

        ledger_status = (
            PaymentLedgerStatus.SUCCESS.value
            if status_from_nomba == "SUCCESS"
            else PaymentLedgerStatus.FAILED.value
        )
        _commit_event(
            db,
            payload,
            payment_flow,
            gateway_reference,
            transaction_id,
            ledger_status=ledger_status,
            org_id=db_transaction.org_id,
            invoice_id=db_transaction.invoice_id,
            amount=transaction_data.get("transactionAmount") or verification.get("amount") or db_transaction.amount,
            payment_method=db_transaction.payment_method,
            customer_name=transaction_data.get("narration") or transaction_data.get("senderName") or transaction_data.get("customerName"),
        )
        logger.info("Processed checkout webhook for order %s with Nomba status %s", resolved_order_ref, status_from_nomba)

        if status_from_nomba == "SUCCESS" and db_transaction.invoice_id:
            if background_tasks is not None:
                background_tasks.add_task(notifications.notify_payment_received, db_transaction.invoice_id)

    elif payload.event_type == "payment_failed":
        gateway_reference = order_data.get("orderReference") or transaction_data.get("merchantTxRef") or transaction_id

        db_transaction = db.query(Transaction).filter(Transaction.reference == gateway_reference).first() if gateway_reference else None
        if db_transaction:
            db_transaction.status = TransactionStatus.FAILED.value
        else:
            logger.warning("payment_failed for unknown transaction %s", gateway_reference)

        _commit_event(
            db,
            payload,
            payment_flow,
            gateway_reference,
            transaction_id,
            ledger_status=PaymentLedgerStatus.FAILED.value if gateway_reference else PaymentLedgerStatus.IGNORED.value,
            org_id=db_transaction.org_id if db_transaction else None,
            invoice_id=db_transaction.invoice_id if db_transaction else None,
            amount=db_transaction.amount if db_transaction else None,
            payment_method=db_transaction.payment_method if db_transaction else None,
            customer_name=transaction_data.get("narration") or transaction_data.get("senderName") or transaction_data.get("customerName"),
        )

    elif payload.event_type == "payment_reversal":
        gateway_reference = order_data.get("orderReference") or transaction_data.get("merchantTxRef") or transaction_id

        db_transaction = db.query(Transaction).filter(Transaction.reference == gateway_reference).first() if gateway_reference else None
        if db_transaction:
            db_transaction.status = TransactionStatus.REVERSED.value
        else:
            logger.warning("payment_reversal for unknown transaction %s", gateway_reference)

        _commit_event(
            db,
            payload,
            payment_flow,
            gateway_reference,
            transaction_id,
            ledger_status=PaymentLedgerStatus.REVERSED.value if gateway_reference else PaymentLedgerStatus.IGNORED.value,
            org_id=db_transaction.org_id if db_transaction else None,
            invoice_id=db_transaction.invoice_id if db_transaction else None,
            amount=db_transaction.amount if db_transaction else None,
            payment_method=db_transaction.payment_method if db_transaction else None,
            customer_name=transaction_data.get("narration") or transaction_data.get("senderName") or transaction_data.get("customerName"),
        )

    else:
        gateway_reference = order_data.get("orderReference") or transaction_data.get("merchantTxRef") or transaction_id
        _commit_event(
            db,
            payload,
            None,
            gateway_reference,
            transaction_id,
        )

    return {"status": "success"}
