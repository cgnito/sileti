import hmac
import hashlib
import json
import os
import uuid
from decimal import Decimal
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.orm import Session

import models
import schemas
import security
from database import get_db
from routes.billing import sync_invoice_status

router = APIRouter(prefix="/billing/payments", tags=["Payment Engine"])

# Load keys safely from your environment configuration variables
PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "sk_test_mock_secret_key_change_me")


# 1. INITIALIZE PAYSTACK PAYMENT LINK (FALLBACK EMAIL ARCHITECTURE)
@router.post("/initialize/{invoice_id}", response_model=schemas.InitializePaymentResponse)
async def initialize_invoice_payment(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """
    Generates a secure, tracked Paystack checkout payment hyperlink for an invoice.
    Uses an automated fallback email string using the student's unique ID to maximize UX over WhatsApp.
    """
    # 1. Locate targeted invoice statement with multi-tenant guards
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.org_id == current_user.org_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice statement not found.")

    if invoice.status in [models.InvoiceStatus.PAID, models.InvoiceStatus.VOIDED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Cannot initiate payment against an invoice with status '{invoice.status}'."
        )

    # 2. Extract child information to resolve or build the mandatory Paystack email string
    student = db.query(models.Student).filter(models.Student.id == invoice.student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated student profile missing.")

    # FALLBACK ENGINE: Use real parent email if present, otherwise auto-generate a valid layout string
    if student.parent_email:
        paystack_email = student.parent_email
    else:
        # Replaces characters like slashes to keep the email string clean (e.g., KWA/2026/0001 -> KWA-2026-0001)
        cleaned_ko_id = student.ko_id.replace("/", "-")
        paystack_email = f"student-{cleaned_ko_id}@whatsapp-billing.local"

    # Calculate remaining outstanding debt balance total
    remaining_balance = invoice.total_amount - invoice.paid_amount
    
    # Paystack parses monetary units strictly as integers in Kobo (e.g., ₦150,000.00 = 15000000 kobo)
    amount_in_kobo = int(remaining_balance * 100)
    
    # Generate an explicit custom payment trace record string identifier
    custom_reference = f"INV-{invoice.id.hex[:8]}-{uuid.uuid4().hex[:8]}"

    # Prepare outbound connection payload packet
    paystack_payload = {
        "email": paystack_email,
        "amount": amount_in_kobo,
        "reference": custom_reference,
        "metadata": {
            "invoice_id": str(invoice.id),
            "org_id": str(invoice.org_id)
        }
    }

    headers = {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json"
    }

    # 3. Transmit payment gateway link creation request packet via httpx
    import httpx
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.paystack.co/transaction/initialize",
                json=paystack_payload,
                headers=headers,
                timeout=10.0
            )
            res_data = response.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Payment gateway communication timeout. Please retry momentarily."
            )

    if response.status_code != 200 or not res_data.get("status"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res_data.get("message", "Paystack payment initialization sequence rejected.")
        )

    return {
        "authorization_url": res_data["data"]["authorization_url"],
        "reference": custom_reference
    }


# 2. PAYSTACK WEBHOOK LISTENER (AUTHENTICATED VIA CRYPTO SIGNATURES)
@router.post("/webhook")
async def paystack_webhook_handler(
    request: Request,
    x_paystack_signature: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Public webhook endpoint. Receives secure background processing callbacks straight from Paystack.
    Verifies data authenticity cryptographically using HMAC SHA512 signatures to prevent spoofing.
    """
    # 1. Cryptographic Validation Layer: Protect against system spoofing attacks
    payload_body = await request.body()
    
    if not x_paystack_signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization tracking hash.")

    computed_signature = hmac.new(
        PAYSTACK_SECRET_KEY.encode('utf-8'),
        msg=payload_body,
        digestmod=hashlib.sha512
    ).hexdigest()

    if computed_signature != x_paystack_signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid origin signature identifier.")

    # 2. Parse payload dictionary body safely
    event_packet = json.loads(payload_body)
    
    # We only process successful charges
    if event_packet.get("event") != "charge.success":
        return {"message": "Event type parsed and safely skipped."}

    data_payload = event_packet["data"]
    reference = data_payload["reference"]

    # Idempotency Guard: Ensure this payment record reference hasn't already been processed
    existing_tx = db.query(models.Transaction).filter(models.Transaction.reference == reference).first()
    if existing_tx:
        return {"message": "Transaction trace reference processed previously. Skipping."}

    # Extract our contextual indicators hidden inside metadata blocks
    metadata = data_payload.get("metadata", {})
    invoice_id_str = metadata.get("invoice_id")
    org_id_str = metadata.get("org_id")

    if not invoice_id_str or not org_id_str:
        return {"message": "Missing contextual indexing definitions. Event dropped."}

    invoice_id = uuid.UUID(invoice_id_str)
    org_id = uuid.UUID(org_id_str)

    # 3. Locate target invoice row
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.org_id == org_id
    ).first()

    if not invoice:
        return {"message": "Associated internal invoice document tracking reference not located."}

    # Convert incoming kobo value back into database standard decimal format
    received_amount = Decimal(str(data_payload["amount"])) / 100
    channel = data_payload.get("channel")

    # 4. Write immutable ledger record and update balances within a safe atomic operation
    new_transaction = models.Transaction(
        id=uuid.uuid4(),
        org_id=org_id,
        invoice_id=invoice.id,
        amount=received_amount,
        reference=reference,
        channel=channel
    )
    db.add(new_transaction)

    # Accumulate paid internal tracking balances
    invoice.paid_amount += received_amount
    
    # Re-evaluate payment status adjustments automatically (UNPAID -> PARTIAL -> PAID)
    sync_invoice_status(invoice)

    db.commit()





    # WHATSAPP DIGITAL RECEIPT TRIGGER (FUTURE EXPANSION HOOK)

    # TODO: Trigger an asynchronous background worker task to query the parent phone 
    # number associated with invoice.student_id, generate a custom text layout receipt, 
    # and transmit it straight down their WhatsApp chat thread instantly!
    #===============================================================================

    return {"message": "Ledger and invoice tracking updated successfully."}