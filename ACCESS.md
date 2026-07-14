# API Access Summary

This file summarizes the backend routes under the routes folder and the access level for each endpoint.

## Access Legend
- Admin + Staff: accessible to both admin and staff users
- Admin only: accessible only to admin users
- Public: accessible without authentication

---

## backend/routes/auth.py

### Public routes
- GET /verify
  - Access: Public
  - Purpose: Email verification for a school organization account

- POST /auth/login
  - Access: Public
  - Purpose: Login for either an organization admin or a staff user

- POST /auth/resend-verification
  - Access: Public
  - Purpose: Resend verification email for a school organization account

---

## backend/routes/orgs.py

### Public routes
- POST /orgs
  - Access: Public
  - Purpose: Register a new school organization

### Admin only routes
- GET /orgs/my-school
  - Access: Admin only

- PATCH /orgs/my-school
  - Access: Admin only

- GET /orgs/onboarding-status
  - Access: Admin only

- GET /orgs/banks
  - Access: Admin only

- POST /orgs/bank-lookup
  - Access: Admin only

- GET /orgs/bank-settlement
  - Access: Admin only

- POST /orgs/bank-settlement
  - Access: Admin only

- PATCH /orgs/bank-settlement
  - Access: Admin only

---

## backend/routes/classes.py

### Admin + Staff routes
- POST /classes/
  - Access: Admin + Staff
  - Purpose: Create a new class

- GET /classes/
  - Access: Admin + Staff
  - Purpose: List classes for the organization

- PATCH /classes/{class_id}
  - Access: Admin + Staff
  - Purpose: Update a class

### Admin only routes
- DELETE /classes/{class_id}
  - Access: Admin only
  - Purpose: Delete a class

---

## backend/routes/fees.py

### Admin only routes
- POST /billing/templates/
  - Access: Admin only
  - Purpose: Create a fee template

### Admin + Staff routes
- GET /billing/templates/
  - Access: Admin + Staff
  - Purpose: List fee templates

- GET /billing/templates/{template_id}
  - Access: Admin + Staff
  - Purpose: Get one fee template

### Admin only routes
- DELETE /billing/templates/{template_id}
  - Access: Admin only
  - Purpose: Delete a fee template

---

## backend/routes/students.py

### Admin + Staff routes
- POST /students/
  - Access: Admin + Staff
  - Purpose: Create a single student

- POST /students/bulk-upload/{class_id}
  - Access: Admin + Staff
  - Purpose: Bulk upload students from CSV

- GET /students/
  - Access: Admin + Staff
  - Purpose: List students, optionally filtered by class

- GET /students/{student_id}
  - Access: Admin + Staff
  - Purpose: Get one student profile

- PATCH /students/{student_id}
  - Access: Admin + Staff
  - Purpose: Update a student record

### Admin only routes
- POST /students/bulk-promotion
  - Access: Admin only
  - Purpose: Promote or graduate students in bulk

- DELETE /students/{student_id}
  - Access: Admin only
  - Purpose: Delete a student profile

---

## backend/routes/users.py

### Public routes
- POST /users/set-password
  - Access: Public
  - Purpose: Set a password for an invited staff account

### Admin only routes
- POST /users/staff
  - Access: Admin only
  - Purpose: Invite a new staff member

- GET /users/staff
  - Access: Admin only
  - Purpose: List staff members for the organization

- PATCH /users/staff/{user_id}
  - Access: Admin only
  - Purpose: Update a staff member

- DELETE /users/staff/{user_id}
  - Access: Admin only
  - Purpose: Remove a staff member

- POST /users/staff/{user_id}/resend-invite
  - Access: Admin only
  - Purpose: Resend invitation email to a staff member

---

## backend/routes/billing.py

### Admin + Staff routes
- POST /billing/generate
  - Access: Admin + Staff
  - Purpose: Generate invoices for a class

- POST /billing/invoices/{invoice_id}/void
  - Access: Admin + Staff
  - Purpose: Void a single invoice

- POST /billing/classes/{class_id}/void
  - Access: Admin + Staff
  - Purpose: Void invoices for a class/session/term

- POST /billing/invoices/{invoice_id}/items
  - Access: Admin + Staff
  - Purpose: Add an optional fee line item to an invoice

- DELETE /billing/invoices/{invoice_id}/items/{item_id}
  - Access: Admin + Staff
  - Purpose: Remove an optional fee line item from an invoice

- GET /billing/invoices
  - Access: Admin + Staff
  - Purpose: List invoices with filters

- GET /billing/invoices/{invoice_id}
  - Access: Admin + Staff
  - Purpose: Get one invoice details view

---

## backend/routes/payments.py

- No active API endpoints are currently defined in this file.
- It currently contains placeholder/comment content only.
