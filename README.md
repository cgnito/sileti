# Ṣilẹti

> A smart, multi-tenant school financial platform that automates tuition collection, splits processing via sub-accounts, and uses an AI WhatsApp assistant to bridge the gap between school administration and parents.

## Why did we build Ṣilẹti

School admins lose huge amounts of time to manual fee tracking, paper trails, fragmented payment records, and parents who never see the right message at the right time. Parents, meanwhile, face communication friction.

Ṣilẹti fixes both sides of the problem.

For schools, it turns fee collection into a structured workflow: onboard the tenant, verify bank details, build classes, upload students, generate invoices, and reconcile payments from a single dashboard.

For parents, it removes friction completely. The WhatsApp assistant is already available for guided payment help, while outbound notification delivery is still waiting on WhatsApp sender approval; email can fetch a secure checkout link and complete payment without hunting through a school portal.

### How Nomba Powers the Build

This project is built for the Nomba Hackathon track: Marketplace / Multi-vendor (Sub-accounts, Transfers, Webhooks, Reconciliation dashboard).

Nomba sits in the middle of the payment lifecycle:

- Checkout creation is handled through Nomba’s checkout order API.
- Bank routing is validated through Nomba’s bank lookup tools during onboarding.
- Payment verification is performed through Nomba transaction lookup endpoints.
- Incoming payment events are reconciled through signed webhooks using HMAC verification.
- A token cache prevents unnecessary authentication churn and reduces pressure on the gateway.

The result is a real financial workflow.

## Product Workflow

1. **School Signs Up** 
	 A school creates an account and becomes its own tenant.

2. **Sets Up Bank Details** 
	 The admin adds the school’s settlement account, and the backend checks the bank name with Nomba before saving it.

3. **Creates a Class & Uploads Students** 📊
	 The school builds classes and uploads students, including parent contact details and a unique student ID.

4. **Creates Fee Templates & Invoices** 
	 The school defines reusable fee templates and generates invoices for a class. As soon as an invoice exists, the notification service can alert the parent by WhatsApp or email.

5. **The Magic Fallback** 
	 If contact details are missing, the parent can use the child’s unique Student ID with the AI WhatsApp assistant. The assistant finds the student, links the parent, retrieves the outstanding balance, generates a secure Nomba checkout link, and sends the payment confirmation back through the same channel.

## Why Ṣilẹti Stands Out

### AI WhatsApp Assistant

Busy parents do not want another app. They already use WhatsApp.

Ṣilẹti uses an AI WhatsApp assistant to guide a parent through the payment flow without forcing them to remember a portal link or password combo. The assistant can:

- verify a student by ID,
- link the parent to the student,
- pull outstanding invoice context,
- generate a secure checkout link,
- and keep the interaction short, clean, and task-focused.

### Native Reconciliation Dashboard

Administrators get a live financial snapshot instead of a pile of manual spreadsheet updates. The dashboard is built around tenant-scoped invoice and ledger data so schools can immediately see what is unpaid, partially paid, paid, or voided.

## Product Architecture

### Role-Based Access Control

The backend splits the application into two major operating roles:

| Role | What it controls | Enforcement |
| --- | --- | --- |
| Admin | School onboarding, email verification, bank settlement setup, staff invites, dashboard oversight, and full billing control | `security.allow_admin_only` and `RoleChecker(["admin"])` |
| Staff | Class management, student management, fee templates, invoice generation, and dashboard access where allowed | `RoleChecker(["admin", "staff"])` |

The auth layer resolves the current user from the access token, then maps them back to either the school organization record or a staff user record. That keeps the backend aware of who is acting, which school they belong to, and what they are allowed to touch.

### Data Integrity Specs

The codebase uses a few guardrails to keep the tenant boundary clean:

- Every school-scoped record is tied to `org_id`.
- Primary identifiers are UUID v4, which makes guessing records impractical.
- Invoice references and webhook request IDs are stored independently to prevent duplicate processing.
- Payment ledgers and webhook logs are separate, so audit history stays intact even when a transaction is replayed or retried.
- Fee templates are soft-deletable, so historical invoices can still reference their original structure.

## Nomba Deep Dive

The payment stack is intentionally split into clear layers.

| Capability | Code path | Nomba endpoint / behavior | Why it matters |
| --- | --- | --- | --- |
| Token handling | `backend/routes/payments.py` | `POST /v1/auth/token/issue` and `POST /v1/auth/token/refresh` | A local `_token_cache` stores access and refresh tokens so repeated calls do not hammer the auth endpoint. |
| Bank list lookup | `backend/routes/orgs.py` | `GET /v1/transfers/banks` | Populates the onboarding dropdown with live banks from Nomba, with a fallback list if the provider is unavailable. |
| Bank account verification | `backend/routes/orgs.py` | `POST /v1/transfers/bank/lookup` | Confirms the account name before the school saves settlement details. |
| Checkout link generation | `backend/routes/payments.py` | `POST /v1/checkout/order` | Creates a secure payment URL tied to a transaction reference and invoice context. |
| Transaction verification | `backend/routes/payments.py` | `GET /v1/transactions/accounts/single?transactionRef=...` and `GET /v1/transactions/accounts/single?orderReference=...` | Confirms what Nomba actually saw before the database is updated. |
| Webhook reconciliation | `backend/routes/webhooks.py` | `nomba-signature` HMAC check with `nomba-timestamp` | Rejects spoofed or malformed payment callbacks. |

### 1) Bank Transfer API and Bank Lookup

Onboarding begins with bank discovery and account validation.

- `GET /orgs/banks` proxies Nomba’s supported bank list and maps it into the format the frontend expects.
- `POST /orgs/bank-lookup` sends the bank code and account number to Nomba and resolves the account name before the admin saves the settlement record.
- `POST /orgs/bank-settlement` stores the verified bank details and marks the organization as having set up bank routing.

This is the right pattern for a hackathon build: validate the destination first, then persist it.

Automated payout execution is not the live part of this build yet. The current implementation is intentionally positioned for immediate rollout of transfer flows after the settlement rails are finalized.

### 2) Sub-accounts and Token Handling

`backend/routes/payments.py` manages Nomba authentication and checkout access in a way that is practical for multi-tenant growth:

- it stores tokens in `_token_cache`,
- refreshes them when they are near expiry,
- and reuses a configured hackathon sub-account ID when a school-specific account ID is not supplied.

That keeps the checkout flow stable while the platform continues to evolve into a true multi-vendor system.

### 3) Checkout Payment Link Flow

When a parent is ready to pay, the backend:

1. builds a unique order reference like `SIL-...`,
2. converts the amount into kobo for the gateway,
3. calls Nomba’s checkout order API,
4. stores the resulting checkout URL with a database `Transaction`,
5. and uses that reference later when a webhook or transaction verification request arrives.

The checkout order includes a callback URL that defaults to the frontend payment-success page, plus the accepted payment methods required for the hackathon track.

### 4) Webhooks and Cryptographic Security

`backend/routes/webhooks.py` is the reconciliation engine.

It listens for `payment_success` events, then:

- extracts the transaction and order references,
- verifies the transaction back against Nomba,
- checks the incoming signature with HMAC-SHA256,
- accepts both base64 and hex signature forms,
- updates the transaction status,
- updates the invoice paid amount and invoice status,
- writes webhook and ledger records,
- and queues payment notifications.

That means the dashboard is not guessing. It is reconciling.

## The End-to-End Flow

1. **School signs up and verifies email.**
2. **Admin adds bank details and validates the account with Nomba.**
3. **Admin or staff creates classes and uploads students.**
4. **School creates fee templates and generates invoices.**
5. **Notifications go out by WhatsApp or email when contact data exists.**
6. **If contact data is missing, the parent can use the Student ID in WhatsApp.**
7. **The assistant generates a secure checkout link from Nomba.**
8. **Nomba sends a signed webhook on payment success.**
9. **The backend verifies the signature, updates the ledger, and refreshes the dashboard.**

## Technical Snapshot

| Layer | Stack |
| --- | --- |
| API | FastAPI |
| ORM | SQLAlchemy |
| Migrations | Alembic |
| Database | PostgreSQL |
| Payments | Nomba |
| Notifications | Twilio WhatsApp, Resend email |
| AI Assistant | Google GenAI |

## Repository Layout

```text
backend/
	app/
		main.py
		models.py
		database.py
		security.py
		utils.py
	routes/
		auth.py
		billing.py
		classes.py
		fees.py
		orgs.py
		payments.py
		students.py
		users.py
		webhooks.py
	services/
		notifications.py
		whatsapp.py
		email_templates.py
	schemas/
	migrations/
DB.md
WEBHOOKS.md
test_students.csv
frontend/
	src/
	public/
```

## Local Development

### Backend

```bash
cd backend
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

The backend expects configuration for database access, Nomba, notifications, and AI messaging.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret |
| `ALGORITHM` | JWT algorithm |
| `FRONTEND_URL` | Public frontend origin used in email and checkout redirects |
| `NOMBA_BASE_URL` | Nomba sandbox or production base URL |
| `NOMBA_ACCOUNT_ID` | Nomba account header value |
| `NOMBA_CLIENT_ID` | Nomba auth client ID |
| `NOMBA_CLIENT_SECRET` | Nomba auth client secret |
| `NOMBA_HACKATHON_SUBACCOUNT` | Fallback sub-account used for checkout creation |
| `NOMBA_CHECKOUT_CALLBACK_URL` | Optional override for checkout redirects |
| `NOMBA_WEBHOOK_SECRET` | Shared secret used to verify webhook signatures |
| `DEBUG_NOMBA_HOOKS` | Enables verbose webhook logging when set to `1` |
| `RESEND_API_KEY` | Outbound email delivery |
| `TWILIO_WHATSAPP_FROM` | WhatsApp sender number |
| `TWILIO_WHATSAPP_INVOICE_GENERATED_CONTENT_SID` | WhatsApp template for invoice alerts |
| `TWILIO_WHATSAPP_PAYMENT_RECEIVED_CONTENT_SID` | WhatsApp template for payment confirmations |
| `CHATBOT_PHONE_NUMBER` | Support/contact number used in message templates |

## Key API Surfaces

| Route | Purpose |
| --- | --- |
| `GET /orgs/onboarding-status` | Returns onboarding checklist progress |
| `GET /orgs/dashboard-metrics` | Returns financial metrics for the dashboard |
| `GET /orgs/banks` | Returns supported banks from Nomba |
| `POST /orgs/bank-lookup` | Validates a school bank account with Nomba |
| `POST /orgs/bank-settlement` | Saves verified settlement details |
| `POST /billing/generate` | Generates invoices for a class and template |
| `POST /webhooks/nomba` | Receives and reconciles payment events |
| `POST /whatsapp/webhook` | Powers the AI WhatsApp assistant |

## Future Horizon

- **Fully automated settlement transfers**: move from bank validation to complete split-payout distribution directly into school accounts through Nomba transfer endpoints.
- **Advanced reconciliation intelligence**: surface underpayments, duplicate attempts, and refund edge cases directly on the admin ledger.
- **Activation of outbound WhatsApp notifications**: once the sender approval is completed, turn on full invoice and receipt notifications through the same WhatsApp channel parents already use for the assistant.
- **Rich media receipts**: generate and deliver downloadable billing receipts directly in the parent’s WhatsApp session.

## Why This Is Built to Win

Ṣilẹti is not just “payments for schools.” It is a practical financial operating system for a real-world school admin workflow:

- multi-tenant by design,
- payment-first,
- reconciliation-aware,
- WhatsApp-native for parents,
- and engineered around Nomba’s actual infrastructure instead of a fake placeholder demo.

That is what makes it hackathon-grade and production-minded at the same time.
