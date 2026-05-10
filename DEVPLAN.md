# Kọ́ Platform: Comprehensive Implementation Roadmap (v1.1)

This document serves as the master step-by-step guide for building Kọ́, a professional multi-tenant fintech solution for African schools. The plan follows a vertical-slice approach to ensure functional milestones at every stage.

---

## Phase 1: Environment and Infrastructure Setup
**Goal:** Establish the foundation for the monorepo and database connectivity.

1.  **Project Structure:**
    * Initialize a root directory `Ko`.
    * Create `/backend` (FastAPI) and `/frontend` (Next.js).
2.  **Backend Initialization:**
    * Set up a Python virtual environment.
    * Install core dependencies: `fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `psycopg2-binary`, `pydantic-settings`, `python-jose`, `passlib`.
    * Initialize Alembic: `alembic init migrations`.
3.  **Frontend Initialization:**
    * Initialize Next.js: `npx create-next-app@latest frontend --typescript --tailwind --eslint`.
    * Install Shadcn/UI: `npx shadcn-ui@latest init`.
4.  **Environment Variables:**
    * Create `.env` in the backend for `DATABASE_URL`, `SECRET_KEY`, and `PAYSTACK_SECRET`.

---

## Phase 2: Multi-tenant Core and Identity
**Goal:** Enable school registration and secure administrative access.

1.  **Database Models (SQLAlchemy):**
    * Define `Organization` with `short_code` and `slug`.
    * Define `User` with `password_hash` and `role` (ADMIN, BURSAR).
    * Ensure all models include an `org_id` column for data isolation.
2.  **Authentication Service:**
    * Implement password hashing using Passlib (Bcrypt).
    * Build JWT generation and validation logic.
    * Create a FastAPI dependency `get_current_active_user` to enforce RBAC.
3.  **Organization API:**
    * POST `/orgs`: Public endpoint for school onboarding.
    * GET `/orgs/me`: Protected endpoint for school settings management.

---

Onboarding (The "Owner" arrives)
Action: A School Proprietor or Head IT person visits your website and fills out the "Register School" form.

Backend: When they hit submit, the POST /orgs endpoint we just wrote does two things simultaneously:

It creates the Organization (e.g., "Greenwood Academy").

It creates the User (e.g., "Ade Smith") and links him to that Org ID with the role ADMIN.

Result: Ade Smith is now the "God Mode" user for Greenwood Academy.

Phase 2: Building the Team (Adding the Bursar)
Action: Ade Smith (Admin) logs into the dashboard. He goes to a "Staff Management" page.

Process: He enters the email of the school accountant, "Chidi Okafor," and selects the role BURSAR.

Backend: We will create a POST /users endpoint that is protected. Only someone with an ADMIN token can call it. This endpoint creates a new user linked to the same org_id as Ade.

Access: Chidi (Bursar) can now log in. Because his role is BURSAR, your code will let him see the Billing section but might hide the School Settings section.

---

## Phase 3: Student Management and Bulk Onboarding
**Goal:** Automate student creation and unique ID generation.

1.  **Student and Parent Models:**
    * Add `Student` table with `status` enum (ACTIVE, PROMOTED, GRADUATED, WITHDRAWN).
    * Add `Parent` table with `primary_phone` (WhatsApp No).
2.  **Koyon ID Generator:**
    * Logic: Combine `Organization.short_code` + `current_year` + `auto_increment_integer`.
    * Example: KWA-2026-0001.
3.  **CSV Import Service:**
    * POST `/students/upload`: Accepts a multipart/form-data CSV file.
    * Logic: Parse with `csv` module, validate headers, generate `ko_id` for each row, and use SQLAlchemy `bulk_save_objects`.
4.  **UI - Management Dashboard:**
    * Build a data table in Next.js to list students with filtering by Class and Status.

---

## Phase 4: Billing Engine and Snapshotting
**Goal:** Create class-wide invoices with historical price protection.

1.  **Fee Configuration Models:**
    * Define `FeeTemplate` (The package) and `FeeLineItem` (Individual costs).
2.  **Batch Invoicing Service:**
    * POST `/billing/generate`: Takes `class_id` and `template_id`.
    * Logic: Find all students with status `ACTIVE` in the class. Generate an `Invoice` for each.
    * Snapshot Logic: For every `FeeLineItem` in the template, create a corresponding `InvoiceDetail` record linked to the new invoice.
3.  **Payment Link Integration:**
    * Integrate Paystack SDK to initialize transactions.
    * Display the unique Virtual Account (Bank Name + Account Number) on the invoice UI.

---

## Phase 5: WhatsApp Integration and State Machine
**Goal:** Provide a low-data interface for parents.

1.  **WhatsApp Webhook:**
    * POST `/webhooks/whatsapp`: Verify incoming requests from Meta Cloud API.
2.  **Conversation Logic:**
    * New User: Prompt for `ko_id` and Student Date of Birth.
    * Validation: If verified, link the WhatsApp sender's phone to the `Parent` record.
    * Existing User: Respond to keywords like "Balance", "Pay", or "Receipt".
3.  **Automated Responses:**
    * Query the database for outstanding invoices and return the Virtual Account details via chat.

---

## Phase 6: Payment Reconciliation and Webhooks
**Goal:** Ensure financial records are updated automatically without manual entry.

1.  **Paystack Webhook:**
    * POST `/webhooks/paystack`: Must implement `X-Paystack-Signature` verification.
2.  **Reconciliation Logic:**
    * Find the `VirtualAccount` by the account reference provided in the webhook.
    * Update `Invoice.paid_amount` and increment based on the transaction value.
    * Automatically move `Invoice.status` to `PAID` if the balance is cleared.
3.  **Ledger Entry:**
    * Insert a record into the `Transactions` table for every successful webhook event.

---

## Phase 7: Lifecycle Management and Reporting
**Goal:** Handle the transition of academic terms and sessions.

1.  **Promotion Service:**
    * POST `/students/promote`: Batch update student `class_id` and set `status` to PROMOTED.
2.  **Financial Export Service:**
    * GET `/reports/export`: Query `Transactions` and `Invoices` for the current term.
    * Generate a downloadable `.csv` or `.xlsx` file for school accounting.
3.  **Admin Analytics UI:**
    * Build dashboard cards in Next.js showing: Total Revenue, Outstanding Debt, and Collection Rate percentage.

---

## Final Security Audit
1.  **Multi-tenancy:** Review all repository patterns to ensure `org_id` is always present in the SQL `WHERE` clause.
2.  **Constraints:** Verify SQL `CHECK` constraints on all amount columns to prevent negative values.
3.  **Audit Logs:** Ensure every manual adjustment to an invoice is recorded in the `audit_logs` table with the user ID and timestamp.