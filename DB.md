# ṣilẹti Database Schema Specification (v1.1)

This document defines the relational database schema for **ṣilẹti**. The system uses **PostgreSQL** with **UUID v4** for all primary keys to ensure multi-tenant security and prevent ID enumeration.

---

## 1. Core Identity & Organization

### Table: `organizations`
**Description:** The top-level tenant. All data in the system is isolated by the `org_id`.  
**Relationships:** - Has many `Users`.
- Has many `Classes`.
- Has many `Students`.
- Has many `Parents`.
- Has many `FeeTemplates`.
- Has many `Invoices`.

| Column | Data Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier (v4). |
| `name` | VARCHAR(255) | Name of the school/institution. |
| `short_code` | VARCHAR(10) | Unique human-readable code (e.g., 'KWA'). |
| `slug` | VARCHAR(100) | URL-friendly unique identifier. |
| `settings` | JSON | Flexible school-specific configurations (JSONB). |
| `created_at` | TIMESTAMPTZ | Automatic creation timestamp. |
| `updated_at` | TIMESTAMPTZ | Automatic timestamp on record update. |
| `deleted_at` | TIMESTAMPTZ | Nullable field for soft-delete logic. |

### Table: `users`
**Description:** School staff members. Isolated by `org_id`.  
**Relationships:** - Belongs to an `Organization`.
- Controlled by `UserRole` permissions.

| Column | Data Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier for the user. |
| `org_id` | UUID (FK) | Multi-tenant link to `organizations.id`. |
| `full_name` | VARCHAR(255) | Full name of the staff member. |
| `email` | VARCHAR(255) | Unique login identifier (Indexed). |
| `password_hash` | VARCHAR | Hashed credential storage. |
| `role` | ENUM | `SUPER_ADMIN`, `ADMIN`, or `BURSAR`. |
| `is_active` | BOOLEAN | Account status toggle. |

---

## 2. Academic Structure

### Table: `classes`
**Description:** Represents specific classrooms or cohorts. Used for academic grouping.  
**Relationships:** - Belongs to an `Organization`.
- Contains many `Students`.

| Column | Data Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier for the class. |
| `org_id` | UUID (FK) | Multi-tenant link to `organizations.id`. |
| `name` | VARCHAR(50) | Display name (e.g., "JSS 1 Gold"). |
| `level` | INTEGER | Numeric rank used for promotion logic. |

---

## 3. Student & Parent Management

### Table: `student_parents` (Association Table)
**Description:** Junction table for many-to-many relationship between Students and Parents.  
**Logic:** Uses composite primary keys to ensure unique student-parent links.

| Column | Data Type | Description |
| :--- | :--- | :--- |
| `student_id` | UUID (PK, FK) | Link to `students.id`. |
| `parent_id` | UUID (PK, FK) | Link to `parents.id`. |

### Table: `students`
**Description:** The individual student record.  
**Relationships:** - Belongs to an `Organization`.
- Assigned to a `SchoolClass`.
- Linked to many `Parents` via `student_parents`.
- Linked to many `Invoices`.

| Column | Data Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier. |
| `org_id` | UUID (FK) | Multi-tenant link to `organizations.id`. |
| `class_id` | UUID (FK) | Current link to `classes.id`. |
| `silete_id` | VARCHAR(20) | Unique human-readable ID (Indexed). |
| `first_name` | VARCHAR(100) | Student's given name. |
| `last_name` | VARCHAR(100) | Student's family name. |
| `date_of_birth` | DATE | Student's birth date. |
| `status` | ENUM | `ACTIVE`, `PROMOTED`, `GRADUATED`, `WITHDRAWN`. |
| `created_at` | TIMESTAMPTZ | Record creation timestamp. |

### Table: `parents`
**Description:** Parent/Guardian records.  
**Relationships:** - Belongs to an `Organization`.
- Linked to many `Students` via `student_parents`.

| Column | Data Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier. |
| `org_id` | UUID (FK) | Multi-tenant link to `organizations.id`. |
| `primary_phone` | VARCHAR(20) | Unique contact number (Indexed). |
| `is_verified` | BOOLEAN | Verification status of contact info. |

---

## 4. Billing & Financials (The Engine)

### Table: `fee_templates`
**Description:** Blueprints for recurring fees (e.g., "First Term Tuition").  
**Relationships:** - Belongs to an `Organization`.
- Has many `FeeLineItems` (with cascade delete).

| Column | Data Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier for the template. |
| `org_id` | UUID (FK) | Multi-tenant link to `organizations.id`. |
| `name` | VARCHAR(255) | Template name (e.g., "JSS1 Fees"). |
| `description` | VARCHAR | Optional contextual notes. |
| `created_at` | TIMESTAMPTZ | Creation timestamp. |

### Table: `fee_line_items`
**Description:** Individual fee components within a template.  
**Relationships:** - Belongs to a `FeeTemplate`.

| Column | Data Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier. |
| `template_id` | UUID (FK) | Link to the parent `fee_templates.id`. |
| `name` | VARCHAR(255) | Component name (e.g., "Tuition"). |
| `amount` | NUMERIC(12,2) | Financial value of the item. |

### Table: `invoices`
**Description:** The actual bill issued to a student.  
**Relationships:** - Belongs to an `Organization` and a `Student`.
- Has many `InvoiceDetails` (snapshots).
- Has many `Transactions`.

| Column | Data Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier. |
| `student_id` | UUID (FK) | Link to `students.id`. |
| `status` | ENUM | `UNPAID`, `PARTIAL`, `PAID`, `VOIDED`. |
| `session` | VARCHAR(20) | Academic year (e.g., "2025/2026"). |
| `term` | VARCHAR(20) | Academic term (e.g., "First Term"). |
| `total_amount` | NUMERIC(12,2) | Total billed amount. |
| `paid_amount` | NUMERIC(12,2) | Total amount received so far. |
| `due_date` | DATE | Deadline for payment. |

### Table: `invoice_details`
**Description:** A snapshot of billed items. Records the exact price at the time of invoicing.  
**Relationships:** - Belongs to an `Invoice`.

| Column | Data Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier. |
| `invoice_id` | UUID (FK) | Link to parent `invoices.id`. |
| `name` | VARCHAR(255) | Snapshot of the item name. |
| `amount` | NUMERIC(12,2) | Snapshot of the item amount. |

### Table: `transactions`
**Description:** Immutable ledger of every payment received.  
**Relationships:** - Belongs to an `Organization`.
- Linked to an `Invoice`.

| Column | Data Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier. |
| `org_id` | UUID (FK) | Multi-tenant separator. |
| `invoice_id` | UUID (FK) | Reference to the specific bill. |
| `amount` | NUMERIC(12,2) | Precise value received. |
| `reference` | VARCHAR(100) | Unique gateway reference (e.g., Paystack). |
| `channel` | VARCHAR(50) | Method (e.g., "transfer", "card"). |
| `created_at` | TIMESTAMPTZ | Automatic payment timestamp. |

### Table: `payment_ledger_entries`
**Description:** Gateway-backed payment history table that records webhook events for checkout payments.  
**Relationships:** - Belongs to an `Organization`.
- Optionally linked to an `Invoice`.

| Column | Data Type | Description |
| :--- | :--- | :--- |
| `request_id` | VARCHAR(100) (PK) | Nomba webhook request id used for dedupe. |
| `org_id` | UUID (FK, nullable) | School owner for the event when it can be resolved. |
| `invoice_id` | UUID (FK, nullable) | Linked invoice for checkout-based school fee payments. |
| `payment_flow` | VARCHAR(30) | Checkout payment flow label. |
| `event_type` | VARCHAR(50) | Nomba event type, such as `payment_success`. |
| `gateway_reference` | VARCHAR(120) | Local reconciliation reference such as `orderReference`. |
| `transaction_id` | VARCHAR(120) | Nomba transaction id from the webhook. |
| `amount` | NUMERIC(12,2) | Amount reported by Nomba or the local invoice amount. |
| `status` | VARCHAR(20) | Normalized event status: `SUCCESS`, `FAILED`, `REVERSED`, or `IGNORED`. |
| `payment_method` | VARCHAR(50) | Method reported by the gateway when available. |
| `customer_name` | VARCHAR(255) | Sender/customer label captured from the webhook. |
| `raw_payload` | JSON | Full webhook payload for audit/debugging. |
| `created_at` | TIMESTAMPTZ | Ledger entry creation timestamp. |
| `updated_at` | TIMESTAMPTZ | Last update timestamp. |

---

## Data Integrity Rules
1. **Multi-tenant Enforcement:** Every query must include `WHERE org_id = current_org_id`.
2. **Immutability:** Once a `transaction` is recorded, the row cannot be edited or deleted.
3. **Financial Precision:** All currency values use `NUMERIC(12,2)` to prevent floating-point errors.
4. **Soft Deletes:** Key entities use a `deleted_at` column to maintain audit trails while hiding records from UI.
