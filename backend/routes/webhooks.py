import os
import hmac
import hashlib
import base64
import logging
from fastapi import APIRouter, Request, Header, HTTPException, status, Depends

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
    

    # Extract transaction token for identification
    transaction_id = transaction_data.get("transactionId")
    if not transaction_id:
        logger.warning("Received event '%s' without a transactionId inside data block.", payload.event_type)
        return {"status": "ignored", "message": "Missing transaction identification token."}


    # 3. PROCESS VALIDATED AND IDEMPOTENT WEBHOOK
    if payload.event_type == "payment_success":
        try:
            # verify via api and try to get the local reference mapping to our system
            verification = payments.verify_checkout_transaction(transaction_id)
        except Exception as exc:
            logger.error("Error executing verify_checkout_transaction for %s: %s", transaction_id, exc)
            raise HTTPException(status_code=502, detail="Failed to verify transaction status with provider.")

        status_from_nomba = verification.get("status")
        local_ref = verification.get("orderReference") or verification.get("merchantTxRef")

        if not local_ref:
            logger.error("Verification API response omitted order reference mapping for ID: %s", transaction_id)
            return {"status": "ignored", "message": "Could not map provider token to system order reference."}

        db_transaction = db.query(Transaction).filter(Transaction.reference == local_ref).first()

        if not db_transaction:
            logger.error("No record found in local database matching order reference: %s", local_ref)
            new_log = WebhookLog(request_id=payload.request_id, event_type=payload.event_type)
            db.add(new_log)
            db.commit()
            return {"status": "ignored", "message": "Transaction record reference not found."}

        if status_from_nomba == "SUCCESS":
            db_transaction.status = TransactionStatus.SUCCESS.value
            db_transaction.payment_method = transaction_data.get("type")

            invoice = db_transaction.invoice
            if invoice:
                received_amount = transaction_data.get("transactionAmount") or verification.get("amount") or 0

                # Ensure float/int safely converts to Decimal via String initialization to prevent TypeError
                invoice.paid_amount += Decimal(str(received_amount))

                if invoice.paid_amount >= invoice.total_amount:
                    invoice.status = InvoiceStatus.PAID
                else:
                    invoice.status = InvoiceStatus.PARTIAL
        else:
            db_transaction.status = TransactionStatus.FAILED.value

    elif payload.event_type == "payment_failed":
        try:
            # Step up lookup to discover your original transaction record context safely
            verification = payments.verify_checkout_transaction(transaction_id)
            local_ref = verification.get("orderReference") or verification.get("merchantTxRef")
        except Exception as exc:
            logger.error("Failed to verify failed transaction %s via API: %s", transaction_id, exc)
            local_ref = None

        if local_ref:
            db_transaction = db.query(Transaction).filter(Transaction.reference == local_ref).first()
            if db_transaction:
                db_transaction.status = TransactionStatus.FAILED.value
                logger.info("Updated status to FAILED for transaction reference: %s", local_ref)
            else:
                logger.warning("No matching local transaction for failed reference: %s", local_ref)
        else:
            logger.warning("Payment failure notification received; could not resolve order mapping for: %s", transaction_id)


    elif payload.event_type == "payment_reversal":
        try:
            # Fetch details via API to confirm exact target of the reversal
            verification = payments.verify_checkout_transaction(transaction_id)
            local_ref = verification.get("orderReference") or verification.get("merchantTxRef")
        except Exception as exc:
            logger.error("Failed to verify reversed transaction %s via API: %s", transaction_id, exc)
            local_ref = None

        if local_ref:
            db_transaction = db.query(Transaction).filter(Transaction.reference == local_ref).first()
            if db_transaction:
                db_transaction.status = TransactionStatus.REVERSED.value
                
                # Rollback invoice payment amounts conditionally if the invoice state was altered
                invoice = db_transaction.invoice
                if invoice:
                    reversed_amount = transaction_data.get("transactionAmount") or verification.get("amount") or 0
                    # Safeguard calculation against float runtime mismatches via direct casting 
                    invoice.paid_amount -= Decimal(str(reversed_amount))
                    
                    if invoice.paid_amount < 0:
                        invoice.paid_amount = Decimal("0.00")
                        
                    invoice.status = InvoiceStatus.PARTIAL if invoice.paid_amount > 0 else InvoiceStatus.UNPAID
                logger.info("Processed reversal for transaction reference: %s", local_ref)
            else:
                logger.warning("No matching local transaction found for reversal reference: %s", local_ref)
        else:
            logger.warning("Payment reversal notification received; could not resolve order mapping for: %s", transaction_id)

    # 4. WRITE FINAL IDEMPOTENCY LOG & COMMIT TRANSACTION
    new_log = WebhookLog(request_id=payload.request_id, event_type=payload.event_type)
    db.add(new_log)
    db.commit()

    return {"status": "success"}