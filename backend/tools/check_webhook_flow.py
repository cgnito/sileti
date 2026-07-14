from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

# Run from backend/ directory so imports resolve
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.models import Transaction, WebhookLog
from app.database import DATABASE_URL

if not DATABASE_URL:
    print("No DATABASE_URL configured in environment.")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def main():
    db = SessionLocal()
    try:
        print("Recent Transactions (latest 20):")
        txs = db.query(Transaction).order_by(Transaction.created_at.desc()).limit(20).all()
        for t in txs:
            print(f"- ref={t.reference} amount={t.amount} status={t.status} invoice_id={t.invoice_id} created_at={t.created_at} checkout_url={t.checkout_url}")

        print("\nRecent WebhookLog entries (latest 20):")
        logs = db.query(WebhookLog).order_by(WebhookLog.processed_at.desc()).limit(20).all()
        for l in logs:
            print(f"- request_id={l.request_id} event_type={l.event_type} gateway_ref={l.gateway_reference} txn_id={l.transaction_id} processed_at={l.processed_at}")

    finally:
        db.close()

if __name__ == '__main__':
    main()
