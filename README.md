# sileti user guide and technical walkthrough

welcome to sileti, our school payment platform that makes tuition collection smooth for parents, simple for school admins.

### 1. school onboarding and tenant setup

this section explains how a school signs up and becomes its own tenant inside sileti.

- registration: a school admin creates an account by entering their email, password, and school information. they also add staff users and assign access rights so teachers and administrators can manage students, fees, and invoices.
- financial routing: the admin provides the school settlement bank account details during setup. the backend verifies and stores those details so the school has a payout profile on file, while checkout payments are routed through the configured Nomba sub-account used for billing.
- academic setup: after onboarding, the school creates its academic structure by adding classroom tiers such as jss1, sss3, and other active class lists. this helps the system organize students and apply billing to the correct groups.
- student management: the school adds students individually or uses a bulk csv upload tool to populate the roster quickly. each student profile stores the parent or guardian phone number and is assigned a unique student id. this student id is the key that links the parent to the correct student, school, and billing records.

### 2. the billing and invoicing engine

this section explains how schools create fees and charge parents.

- fee templates: schools create reusable fee templates for standard recurring costs. examples include first term tuition, school bus logistics, textbooks, or exam fees. templates are itemized so the fees are clear and consistent across many students.
- batch invoice generation: when a school needs to bill a whole class tier, they select a fee template and map it to that class. the system loops through every student in the selected grade and programmatically creates an individual invoice record for each student. every invoice is stored with a status of `pending` and a unique merchant transaction reference so it can be tracked securely.

### 3. parent notification and payment flow

this section describes how parents are notified about invoices and how payment is completed.

- outbound notification: when a new invoice is created, the school can notify the parent through whatsapp or another messaging channel using the stored parent contact details.
- payment initiation: the parent receives a secure nomba checkout link for the specific invoice reference.
- webhook ingestion: once nomba confirms the payment, it triggers an asynchronous webhook to our fastapi backend. this webhook notifies us that the payment event has happened.
- cryptographic verification: our backend verifies the incoming `nomba-signature` header using hmac-sha256. this confirms the webhook event is authentic and prevents spoofed payment notifications.
- ledger reconciliation: after verification, we find the invoice in the database using the merchant transaction reference. we verify the amount matches exactly, update the invoice status to `paid`, and refresh the school's admin dashboard metrics in real time so the school sees the latest collection status.
- receipt emission: finally, the backend records the settlement and can send a structured receipt message to the parent.
