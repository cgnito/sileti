# Nomba Payment Integration & WhatsApp Billing Architecture

This document outlines the end-to-end integration architecture for processing school fees using **Nomba API** and automated notification infrastructure within the Silete ecosystem.

---

## 1. High-Level System Architecture Flow

The payment journey spans across three separate environments: the WhatsApp conversational interface (Twilio), the core Silete backend database execution engine, and Nomba's hosted transaction settlement network.

```text
+------------------+                 +------------------------+                 +---------------------+
|                  |  (1) Request    |                        |  (2) Generate   |                     |
|  School Parent   | --------------->|   WhatsApp Assistant   | --------------->|   Silete Backend    |
|    (WhatsApp)    | <---------------|    (Twilio Sandbox)    | <---------------|   (FastAPI Engine)  |
|                  |   (4) Return LB |                        |   (3) URL/Ref   |          |          |
+------------------+                 +------------------------+                 +----------|----------+
         |                                                                                 |
         | (5) Click Checkout Link & Submit Funds                                          | (6) Reconcile
         v                                                                                 v
+------------------+                                                           +----------------------+
|    Nomba API     | --------------------- (7) Safe Webhook Trigger ---------> |  /webhooks/nomba     |
|   Hosted Page    |                                                           |  (HMAC Validated)    |
+------------------+                                                           +----------------------+
```

---

## 2. Dynamic WhatsApp Link Generation & Checkout Flow

When a parent interacts with the WhatsApp Assistant to pay school fees, the conversational layout executes the following functional cycle.

### 2.1 Operational Steps

1. **The Request**
   - A parent sends a WhatsApp message indicating they want to pay a specific amount for an invoice (for example, "I want to pay ₦50,000 for Invoice #123").

2. **Backend Interception & Invoice Mapping**
   - The system checks the database to verify the matching invoice record.
   - It tracks structural logic against the calculated `total_amount` and current `paid_amount`.
   - It registers a unique, secure financial reference tag mapped to your PostgreSQL transaction ledger (`Transaction.reference`).

3. **Nomba Link Generation**
   - The backend fires an authenticated outbound request to Nomba's API.
   - Nomba constructs a customized, single-use hosted checkout link preloaded with the parent's contextual input parameters and dynamic pricing variables.

4. **Response Payload**
   - Silete returns the generated `checkout_url`.
   - The backend records the generated URL on the corresponding `Transaction` row under a state of `PENDING`.

5. **Parent Handshake**
   - The parent receives the secure URL via WhatsApp.
   - They tap the hyperlink and finish the payment securely via bank transfer, USSD, or card on Nomba's checkout screen.

---

## 3. Technical Webhook Processing & Security Architecture

Once the parent completes the transaction, Nomba broadcasts an automated notification back to the system. Because this endpoint handles critical financial records, it employs strict defensive logic.

### 3.1 Cryptographic Signature Verification (HMAC-SHA256)

To protect against payload spoofing, the endpoint strictly authenticates every incoming packet.

- The logic parses internal payload fields along with custom headers.
- It builds a deterministic, colon-delimited string sequence exactly matching Nomba's structural standard:

```text
SignPayload =
    eventType : requestId : userId : walletId :
    transactionId : type : time : responseCode :
    nomba-timestamp
```

- The application hashes this reconstructed string using the server's private `NOMBA_WEBHOOK_SECRET` via HMAC-SHA256.
- The resulting signature is encoded in Base64.
- Using constant-time comparison (`hmac.compare_digest`), the backend verifies the calculated signature against the incoming `nomba-signature` header.

### 3.2 Enforcing Strict Idempotency

To prevent retries or replay attacks from double-crediting a user's balance:

- The backend tracks the unique `requestId` issued by Nomba.
- A dedicated `webhook_logs` table records every processed `request_id`.
- Before any financial update, the router queries `WebhookLog`.
- If the incoming `request_id` already exists, the process is safely aborted and the endpoint returns `200 OK` to prevent Nomba from retrying.

---

## 4. PostgreSQL State Management & Reconciliation

Once validation succeeds, the application handles database state transitions inside a single transaction block.

### 4.1 Transaction Entry Update

- The `Transaction` status switches from `PENDING` to `SUCCESS`.
- The chosen payment route (for example, `CARD` or `TRANSFER`) is logged in `payment_method`.

### 4.2 Invoice Reconciliation

- The parent’s payment amount is added to the invoice ledger:
  - `invoice.paid_amount += transaction_amount`

### 4.3 Dynamic Invoice Status Transitions

The code checks whether the invoice has been fully or partially settled:

- If `paid_amount >= total_amount`, the status updates to `PAID`.
- If `paid_amount < total_amount`, the status updates to `PARTIAL`.

---

## 5. Notes

- This workflow ensures secure checkout generation, reliable webhook validation, and consistent ledger reconciliation.
- The WhatsApp assistant acts as the customer-facing entry point while FastAPI and Nomba handle payment orchestration and settlement.
