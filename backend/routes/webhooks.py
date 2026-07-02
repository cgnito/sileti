import os
import hmac
import hashlib
import base64
import logging
from fastapi import APIRouter, Request, Header, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any
from sqlalchemy.orm import Session

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
        # Nomba sends back your original tracking reference inside merchantTxRef
        merchant_ref = transaction_data.get("merchantTxRef")
        received_amount = transaction_data.get("transactionAmount")

        # Find the pending transaction in your PostgreSQL DB
        db_transaction = db.query(Transaction).filter(Transaction.reference == merchant_ref).first()
        
        if db_transaction:
            # Update Transaction status
            db_transaction.status = TransactionStatus.SUCCESS.value
            db_transaction.payment_method = transaction_data.get("channel") # e.g. "CARD" or "TRANSFER"
            
            # Fetch and update the Invoice total paid metrics
            invoice = db_transaction.invoice
            if invoice:
                # Add the new payment amount to what was paid before
                invoice.paid_amount += received_amount
                
                # Check if full amount or partial amount has been reconciled
                if invoice.paid_amount >= invoice.total_amount:
                    invoice.status = InvoiceStatus.PAID
                else:
                    invoice.status = InvoiceStatus.PARTIAL

            # Log request ID to mark it processed permanently
            new_log = WebhookLog(request_id=payload.request_id, event_type=payload.event_type)
            db.add(new_log)
            
            
            db.commit()
            logger.info(f"Successfully processed payment for transaction ref: {merchant_ref}")
        else:
            logger.error(f"Transaction reference {merchant_ref} not found in database.")
            # We still want to log the webhook event or return 200 so Nomba doesn't keep retrying an unknown ref forever
            return {"status": "ignored", "message": "Transaction reference mismatch"}

    return {"status": "success"}