# Webhooks And Transaction Verification Guide

This document is the working guide for implementing and debugging Nomba webhooks in this repo.
It is based on the current backend code, the checkout-order flow, and the webhook / verification docs you shared.

## 1. What Each URL Is For

There are two different URLs in this integration and they must not be confused:

- `callbackUrl` in checkout order creation is the customer redirect URL after payment.
- The Nomba webhook URL is the server-to-server POST endpoint that Nomba calls when payment events occur.

In this repo:

- Checkout callback currently points to the frontend route `/payment-success`.
- Webhooks are handled by the backend route `POST /webhooks/nomba`.

That means these are separate concerns:

- Customer redirect after checkout: frontend.
- Payment event delivery and verification: backend.

## 2. Current Endpoint Shape In This Repo

The webhook router is mounted in `backend/main.py` and the route is defined in `backend/routes/webhooks.py`.

Current public path:

- `POST /webhooks/nomba`

If you are using ngrok, the full webhook URL should look like this:

- `https://<your-ngrok-domain>/webhooks/nomba`

The checkout callback URL is different and should remain the frontend route:

- `https://<your-frontend-domain>/payment-success`

## 3. What The Current Webhook Code Already Does

The current `backend/routes/webhooks.py` already has the right high-level pieces:

- It reads `nomba-signature` and `nomba-timestamp` headers.
- It builds the HMAC payload from the request body.
- It verifies the signature with `NOMBA_WEBHOOK_SECRET`.
- It stores webhook delivery records in `WebhookLog`.
- It stores ledger records in `PaymentLedger`.
- It uses the payment verification helpers from `backend/routes/payments.py`.
- It updates invoices and transactions on `payment_success`, `payment_failed`, and `payment_reversal`.

That means the remaining work is not "invent webhook support from scratch".
It is to make sure the delivery path, the signature input, and the verification logic match the real Nomba payloads and the actual deployment URL.

## 4. Important Runtime Dependencies

`backend/routes/webhooks.py` depends on these imports and helpers:

- `payments.verify_transaction_by_id(transaction_id)`
- `payments.verify_checkout_transaction(order_reference)`
- `database.get_db`
- SQLAlchemy models: `Transaction`, `Invoice`, `PaymentLedger`, `WebhookLog`
- `services.notifications.notify_payment_received`

It also depends on these environment variables:

- `NOMBA_WEBHOOK_SECRET`
- `NOMBA_BASE_URL`
- `NOMBA_ACCOUNT_ID`
- `NOMBA_CLIENT_ID`
- `NOMBA_CLIENT_SECRET`
- `NOMBA_HACKATHON_SUBACCOUNT`
- `NOMBA_CHECKOUT_CALLBACK_URL`
- `FRONTEND_URL`

## 5. How Checkout Order Creation Fits Into Webhooks

`backend/routes/payments.py` creates the checkout order and returns the checkout link.

- The checkout order uses a merchant-side reference that the webhook layer should later use to match the payment to the local `Transaction` row.
- In this repo, that canonical checkout reference is now treated as `merchantTxRef` first, with `orderReference` still accepted as a fallback when Nomba returns it that way.
- The webhook layer should always verify the payment with Nomba before granting any value.

The relevant verification endpoint is:

- `GET /v1/transactions/accounts/single?orderReference=...`
- or `GET /v1/transactions/accounts/single?transactionRef=...`

The key success field from Nomba is:

- `data.status == "SUCCESS"`

## 6. How The Current Webhook Verification Flow Should Work

For `payment_success`, the intended flow is:

1. Receive webhook POST at `POST /webhooks/nomba`.
2. Validate the Nomba signature with `nomba-signature` and `nomba-timestamp`.
3. Reject anything that does not pass signature validation.
4. Extract the transaction ID and the order reference from the webhook payload.
5. Verify the payment with Nomba using either `transactionRef` or `orderReference`.
6. Confirm the returned status is `SUCCESS`.
7. Find the local `Transaction` row by the resolved checkout reference, preferring `merchantTxRef` first.
8. Update the `Transaction` and linked `Invoice`.
9. Write a `WebhookLog` row and a `PaymentLedger` row.
10. Return a 2xx response.

This verification step is mandatory.
The docs explicitly say to verify with the API before giving value to the customer.

## 7. What The Webhook Payload Must Contain

The current handler is written around these fields:

- `event_type`
- `requestId`
- `data.merchant.userId`
- `data.merchant.walletId`
- `data.transaction.transactionId`
- `data.transaction.type`
- `data.transaction.time`
- `data.transaction.responseCode`
- `data.order.orderReference`
- `data.transaction.merchantTxRef`

The current schema in `backend/schemas/webhooks.py` is intended to accept the docs payload shape:

- `event_type` from Nomba, with `requestId` for the request identifier
- `data` as a dictionary

Because the model uses field aliases and `populate_by_name = True`, it should be checked against both the docs shape and any locally generated test payloads before we rely on it in code.

That means the payload parser should be checked carefully against the exact Nomba payload shape before we change the handler further.

## 8. Known Problems In The Current Implementation

These are the main things that can make webhook handling look broken even when Nomba is sending events:

### 8.1 Wrong endpoint target

If Nomba is configured to send webhooks to the wrong URL, the backend will never see the request.

Check that the webhook URL in Nomba is the public ngrok URL plus `/webhooks/nomba`, not the checkout callback URL.

### 8.2 Server unreachable when the event fires

Nomba can only deliver a webhook if the endpoint is reachable at that moment.

If the local server, tunnel, or host is asleep or disconnected, the webhook will not land.

### 8.3 Signature mismatch

The current handler verifies the payload signature with:

- `event_type`
- `request_id`
- `merchant.userId`
- `merchant.walletId`
- `transaction.transactionId`
- `transaction.type`
- `transaction.time`
- normalized `responseCode`
- `nomba-timestamp`

The handler now accepts either the base64 HMAC output or the hex HMAC output, because the training docs and the current integration notes have shown both styles in the wild.

If any of those fields are missing, differently named, or transformed before verification, the request will be rejected.

### 8.4 Missing webhook secret

If `NOMBA_WEBHOOK_SECRET` is not configured, the handler raises a 500 immediately.

### 8.5 Wrong event subscription

The webhook must be subscribed to the correct event type.

For checkout payments, the key event is `payment_success`.

### 8.6 Using the callback page as if it were the webhook

The success page at `/payment-success` is only for redirecting the customer.
It is not the payment confirmation source of truth.

### 8.7 Verification result shape assumptions

The webhook code expects Nomba verification responses to include fields such as:

- `status`
- `orderReference` or `merchantTxRef`
- `amount`
- `paymentMethod`

If the response shape changes or a field is absent, the handler can still work, but the reconciliation path needs to handle the missing value safely.

### 8.8 Idempotency and duplicate deliveries

Nomba can retry failed deliveries and webhook replay can resend events.

The current handler already checks `WebhookLog.request_id` and returns early when the same request has already been processed.
That is the right basic direction, but it should be preserved during later edits.

## 9. How To Test Webhooks Properly

### 9.1 Test endpoint reachability first

Before debugging Nomba, send your own POST request to the webhook URL.

Your goal is to confirm:

- The URL is reachable.
- The server responds.
- The route is mounted and accessible.

If you cannot reach it yourself, Nomba cannot either.

I ran a real curl probe against the live ngrok URL in this repo:

- `https://proscholastic-delphine-unmuscled.ngrok-free.dev/webhooks/nomba`

The result was `HTTP/1.1 401 Unauthorized` with `{"detail":"Signature mismatch."}`.

That confirms all of the following:

- the ngrok tunnel is up
- the webhook route is mounted
- the backend is receiving the request
- the handler reaches signature verification and rejects an invalid signature correctly

For a reachability check, a fake-signature POST should produce a clean HTTP response such as `401` or `422`.
If you get a network/TLS error instead, the endpoint is not reachable.

### 9.2 Keep the endpoint alive

If you are using ngrok or another dev tunnel, remember that the tunnel can die when the process stops or the machine sleeps.

Webhook delivery happens in real time.
If the endpoint is offline at that instant, the event is lost unless Nomba retries later.

### 9.3 Verify the route is actually mounted

In this repo, `backend/main.py` includes `webhooks_router`, so the endpoint should be available at:

- `/webhooks/nomba`

### 9.4 Confirm event delivery in the Nomba dashboard

If a webhook does not arrive, use the dashboard event logs or webhook repush tools to confirm whether Nomba delivered it and what response it received.

### 9.5 Re-push using Nomba logs

Use the webhook event logs and repush endpoints from the docs when you need to confirm delivery or trigger a resend.

Useful admin flow:

- inspect webhook delivery logs
- confirm the event type is `payment_success`
- repush the event if necessary

## 10. How To Verify Transactions Safely

When a webhook indicates success, the app should still verify the payment by API before it finalizes anything.

Use one of these verification routes from `backend/routes/payments.py`:

- `verify_transaction_by_id(transaction_id)`
- `verify_checkout_transaction(order_reference)`

Recommended decision rule:

- if verification returns `status == "SUCCESS"`, continue processing
- if verification returns anything else, do not mark the invoice as paid

## 11. How The Local Database Should Be Used

The webhook handler should treat these local tables as the source of your internal reconciliation:

- `Transaction` stores the checkout order reference, amount, status, and customer phone.
- `Invoice` stores the billing state and payment totals.
- `PaymentLedger` stores a durable audit trail of payment events.
- `WebhookLog` stores the raw webhook request metadata for deduplication and debugging.

The key local lookup is:

- find `Transaction` by `Transaction.reference == merchantTxRef` first
- fall back to `orderReference` only if the verified payload does not include a merchant reference

If that lookup fails, the webhook should not invent a match.
It should log and ignore the event safely.

## 12. Recommended Implementation Order

When we start code changes, do them in this order:

1. Confirm the public webhook URL in Nomba is correct.
2. Confirm `NOMBA_WEBHOOK_SECRET` is configured.
3. Confirm the endpoint is reachable through ngrok.
4. Confirm the request payload matches `WebhookPayload` and the signature fields.
5. Confirm verification works against `verify_transaction_by_id` and `verify_checkout_transaction`.
6. Confirm the local `Transaction.reference` matches the checkout order reference.
7. Confirm duplicate deliveries are ignored safely.
8. Confirm invoice updates only happen after successful verification.

## 13. What Should Be Fixed Next In Code

This document is intentionally not changing code yet, but it identifies the next code-level areas to inspect:

- the exact webhook payload schema in `schemas/webhooks.py`
- the signature verification code path in `routes/webhooks.py`
- the verification response handling in `routes/payments.py`
- the local transaction lookup by `orderReference`
- the invoice status update path after successful verification

## 14. Summary Of The Current Situation

At the moment, the most likely webhook issues are not "Nomba is not sending anything".
They are usually one of these:

- the endpoint is not publicly reachable
- the wrong URL was configured in Nomba
- the webhook secret does not match
- the event is not subscribed
- the payload verification fails
- the webhook arrives, but the local `orderReference` lookup cannot find a matching transaction

This guide is the baseline for the next step: we will use it to make the webhook implementation match the docs and the current repo structure.

## 15. Session Handoff Notes

This section is the short version of the work already done in this chat so the next session can continue without re-discovering the same facts.

### 15.1 What Has Already Been Verified

- The checkout callback page exists at `frontend/src/app/payment-success/page.tsx`.
- The frontend callback route is separate from the webhook route.
- The webhook route is mounted at `POST /webhooks/nomba`.
- A fake-signature POST to the ngrok URL returned `401 Signature mismatch`, which proves the endpoint is reachable and the handler is receiving traffic.
- The webhook route is not the problem of being completely offline; the live issue is now signature/payload correctness and real Nomba event delivery.
- `payments.py` already exposes the helpers we need:
	- `create_checkout_order(...)`
	- `verify_transaction_by_id(transaction_id)`
	- `verify_checkout_transaction(order_reference)`
- `create_checkout_order(...)` resolves the sub-account ID from `NOMBA_HACKATHON_SUBACCOUNT` and does not need a missing private helper.

### 15.2 What Was Fixed In Code

- `backend/schemas/webhooks.py`
	- The webhook payload model was made more tolerant of Nomba field naming.
	- It now accepts both `event_type` and `eventType`.
	- It now accepts both `request_id` and `requestId`.
	- `data` remains a generic dictionary because Nomba payloads can vary by event type.

- `backend/routes/webhooks.py`
	- Added resilient checkout-reference resolution.
	- Prioritized `merchantTxRef` as the checkout reference source of truth.
	- Added more defensive handling for verification response shapes.
	- Accepts both base64 and hex representations of the computed HMAC signature.
	- Updated invoice status assignment to use enum values consistently.
	- Kept webhook deduplication by `requestId`.
	- Preserved signature verification as the first gate before processing anything.

- `backend/WEBHOOKS.md`
	- Expanded into a working guide and handoff document.
	- Captures the separation between checkout callback and webhook delivery.
	- Documents the live curl probe result.
	- Describes the verification flow and the database update flow.

### 15.3 What Is Confirmed About The Live Endpoint

- Endpoint submitted to Nomba: `https://proscholastic-delphine-unmuscled.ngrok-free.dev/webhooks/nomba`
- A fake signature POST returned `401 Signature mismatch`.
- That means the ngrok tunnel was live at least during the successful probe and the route was reachable.
- A later curl probe returned a transport-level failure / `000`, which points to tunnel instability rather than route logic.

### 15.4 What Still Needs To Be Done Next

The next session should continue with the following steps, in order:

1. Capture a real webhook payload and headers from Nomba dashboard logs or webhook repush logs.
2. Recompute the HMAC signature from that real payload and confirm the backend verification string matches exactly.
3. Confirm which event fields are actually present for checkout success in your account.
4. Verify the transaction using `verify_transaction_by_id(transaction_id)` when `transactionId` is present.
5. Verify the transaction using `verify_checkout_transaction(order_reference)` when `orderReference` is present.
6. Confirm that the returned verification payload contains `data.status == "SUCCESS"` before updating money-related state.
7. Confirm that local `Transaction.reference` matches Nomba `orderReference` or the equivalent returned checkout reference.
8. Confirm that `Invoice`, `Transaction`, `WebhookLog`, and `PaymentLedger` are updated only after verified success.
9. Use webhook replay / repush from Nomba only after idempotency is confirmed to be working.

### 15.5 Current Business Rules To Preserve

- Never treat the frontend success page as proof of payment.
- Never credit value to a customer until Nomba verification confirms success.
- Always process webhooks idempotently.
- Always prefer the real verified `orderReference` / `transactionRef` returned by Nomba over assumptions.
- For sandbox + production verification, prefer `/v1/transactions/accounts/single`.
- Use `/v1/checkout/transaction` only when you specifically need production-only checkout detail output.

### 15.6 If You Start A New Chat

If you attach this file again and say continue, the next step should be to:

- inspect `backend/routes/webhooks.py` and `backend/routes/payments.py` together,
- use the documented Nomba payload shape instead of assumptions,
- wire the webhook verification flow to the actual payload fields from the dashboard logs,
- and validate the webhook with a real signed payload or a repushed payload from Nomba.

That is the correct continuation point.
