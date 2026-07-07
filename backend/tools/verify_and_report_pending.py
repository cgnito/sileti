import os
import sys
import uuid
from decimal import Decimal

# ensure backend package imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models
from routes import payments


def verify_pending(dry_run=True):
    db: Session = SessionLocal()
    try:
        pending = db.query(models.Transaction).filter(models.Transaction.status == models.TransactionStatus.PENDING.value).all()
        if not pending:
            print("No pending transactions found.")
            return

        for t in pending:
            print("---")
            print(f"Transaction: ref={t.reference} invoice_id={t.invoice_id} amount={t.amount} checkout_url={t.checkout_url}")
            try:
                verification = payments.verify_checkout_transaction(t.reference)
            except Exception as e:
                print(f"  Verification error: {e}")
                continue

            status = (verification.get('status') or '').upper()
            print(f"  Nomba status: {status}")
            print(f"  Nomba data keys: {list(verification.keys())}")
            amount = verification.get('amount') or verification.get('onlineCheckoutAmount') or verification.get('transactionAmount')
            print(f"  Verified amount: {amount}")

            if status == 'SUCCESS':
                print("  -> Would mark transaction and invoice as paid")
                if not dry_run:
                    # update transaction
                    t.status = models.TransactionStatus.SUCCESS.value
                    # update invoice
                    invoice = db.query(models.Invoice).filter(models.Invoice.id == t.invoice_id).first()
                    if invoice:
                        try:
                            invoice.paid_amount += Decimal(str(amount or t.amount))
                        except Exception:
                            invoice.paid_amount += amount or t.amount

                        if invoice.paid_amount >= invoice.total_amount:
                            invoice.status = models.InvoiceStatus.PAID.value
                        else:
                            invoice.status = models.InvoiceStatus.PARTIAL.value

                    # add ledger and webhook log
                    req_id = f"manual-verify-{uuid.uuid4().hex}"
                    db.add(models.WebhookLog(request_id=req_id, event_type='payment_success', payment_flow='checkout', gateway_reference=t.reference, transaction_id=verification.get('id') or verification.get('transactionRef'), raw_payload=verification))
                    db.add(models.PaymentLedger(request_id=req_id, org_id=t.org_id, invoice_id=t.invoice_id, payment_flow='checkout', event_type='payment_success', gateway_reference=t.reference, transaction_id=verification.get('id') or verification.get('transactionRef'), amount=Decimal(str(amount or t.amount)), status=models.PaymentLedgerStatus.SUCCESS.value, payment_method=verification.get('paymentMethod') or verification.get('onlineCheckoutPaymentMethod')))
                    db.commit()
                    print("  -> Applied changes to DB")
            else:
                print("  -> No action: transaction not successful")
    finally:
        db.close()


if __name__ == '__main__':
    apply_flag = '--apply' in sys.argv
    if apply_flag:
        print("Running in APPLY mode: will update DB for confirmed successes.")
    else:
        print("Running in DRY-RUN mode: use --apply to commit changes.")
    verify_pending(dry_run=not apply_flag)
