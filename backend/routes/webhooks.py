import os
import hmac
import hashlib
import base64
import logging
from fastapi import APIRouter, Request, Header, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any
from sqlalchemy.orm import Session

from . import payments
from decimal import Decimal
from models import Transaction, Invoice, InvoiceStatus, TransactionStatus, WebhookLog
from database import get_db 
from schemas.webhooks import WebhookPayload

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

NOMBA_WEBHOOK_SECRET = os.environ.get("NOMBA_WEBHOOK_SECRET")

@router.post("/nomba")
async def nomba_webhook_handler(
    request: Request,
    payload: WebhookPayload,
    nomba_signature: str = Header(..., alias="nomba-signature"),
    nomba_timestamp: str = Header(..., alias="nomba-timestamp"),
    db: Session = Depends(get_db)
):
    if not NOMBA_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret missing configuration.")

    # VERIFY SIGNATURE (Nomba structural spec mapping)
    try:
        data_block = payload.data
        merchant = data_block.get("merchant", {})
        transaction_data = data_block.get("transaction", {})

        hashing_payload = (
            f"{payload.event_type}:{payload.request_id}:"
            f"{merchant.get('userId', '')}:{merchant.get('walletId', '')}:"
            f"{transaction_data.get('transactionId', '')}:{transaction_data.get('type', '')}:"
            f"{transaction_data.get('time', '')}:"
            f"{transaction_data.get('responseCode', '') or ''}:{nomba_timestamp}"
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed structure.")

    computed_digest = hmac.new(
        NOMBA_WEBHOOK_SECRET.encode("utf-8"),
        hashing_payload.encode("utf-8"),
        hashlib.sha256
    ).digest()
    computed_signature = base64.b64encode(computed_digest).decode("utf-8")

    if not hmac.compare_digest(nomba_signature, computed_signature):
        raise HTTPException(status_code=401, detail="Signature mismatch.")

    # CHECK IDEMPOTENCY (Look up the unique Nomba Request ID)
    existing_log = db.query(WebhookLog).filter(WebhookLog.request_id == payload.request_id).first()
    if existing_log:
        return {"status": "success", "message": "Already processed."}

    # PROCESS VALIDATED TRANSACTION
    if payload.event_type == "payment_success":
        # Prefer explicit order reference in webhook payload; fall back to merchantTxRef
        order_ref = None
        order_block = payload.data.get("order") or {}
        order_ref = order_block.get("orderReference") or transaction_data.get("merchantTxRef")

        if not order_ref:
            logger.error("No orderReference found in webhook payload")
            return {"status": "ignored", "message": "No orderReference provided"}

        # Server-side verify with Nomba to ensure payment really succeeded
        try:
            verification = payments.verify_checkout_transaction(order_ref)
        except Exception as exc:
            logger.error("Error verifying transaction %s: %s", order_ref, exc)
            raise HTTPException(status_code=502, detail="Failed to verify transaction with Nomba") from exc

        status_from_nomba = verification.get("status")
        # Find the transaction record by reference (our orderReference)
        db_transaction = db.query(Transaction).filter(Transaction.reference == order_ref).first()

        if not db_transaction:
            logger.error("Transaction reference %s not found in database.", order_ref)
            # still record the webhook so it won't be retried
            new_log = WebhookLog(request_id=payload.request_id, event_type=payload.event_type)
            db.add(new_log)
            db.commit()
            return {"status": "ignored", "message": "Transaction reference mismatch"}

        # write transaction status returned by Nomba
        if status_from_nomba == "SUCCESS":
            db_transaction.status = TransactionStatus.SUCCESS.value
            # payment method may be inside verification or webhook transaction block
            db_transaction.payment_method = transaction_data.get("channel") or verification.get("paymentMethod")

            # Update invoice paid amount and status
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
            # non-success — mark FAILED for clarity
            db_transaction.status = TransactionStatus.FAILED.value

        # Log and commit
        new_log = WebhookLog(request_id=payload.request_id, event_type=payload.event_type)
        db.add(new_log)
        db.commit()
        logger.info("Processed webhook for order %s with Nomba status %s", order_ref, status_from_nomba)

    elif payload.event_type == "payment_failed":
        merchant_ref = transaction_data.get("merchantTxRef") or transaction_data.get("transactionId")
        db_transaction = db.query(Transaction).filter(Transaction.reference == merchant_ref).first()
        if db_transaction:
            db_transaction.status = TransactionStatus.FAILED.value
            new_log = WebhookLog(request_id=payload.request_id, event_type=payload.event_type)
            db.add(new_log)
            db.commit()
        else:
            logger.warning("payment_failed for unknown transaction %s", merchant_ref)

    elif payload.event_type == "payment_reversal":
        merchant_ref = transaction_data.get("merchantTxRef") or transaction_data.get("transactionId")
        db_transaction = db.query(Transaction).filter(Transaction.reference == merchant_ref).first()
        if db_transaction:
            db_transaction.status = TransactionStatus.REVERSED.value
            new_log = WebhookLog(request_id=payload.request_id, event_type=payload.event_type)
            db.add(new_log)
            db.commit()
        else:
            logger.warning("payment_reversal for unknown transaction %s", merchant_ref)

    return {"status": "success"}