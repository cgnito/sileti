# Sileti Flow

This file describes the current product flow as implemented in the codebase after the recent backend and frontend updates.

## Product Goal

- Sileti is a school finance and administration app.
- The main job of the app is to create and manage schools, classes, students, fee templates, invoices, staff, and parent notifications.
- The payment flow is centered on checkout-based invoice settlement.
- The notification flow is centered on outbound WhatsApp alerts to parents after invoices are generated or payments are confirmed.

## Supported Roles

- Admin.
- Staff.
- Admins can manage school setup, billing, students, staff, and notifications.
- Staff access is restricted on the frontend through role guards.

## Onboarding Flow

- A school registers with school name, short code, email, and password.
- The backend creates the organization record and sends a verification email.
- The school verifies the email before completing setup.
- The school then configures bank settlement details.
- The school creates classes.
- The school adds students.
- The school creates fee templates.
- The onboarding status endpoint checks those milestones and marks onboarding complete when all are done.

## School Profile Flow

- The school profile page loads the organization record.
- The email field is read-only in the frontend.
- The school can update other profile fields, but not the email address.
- The backend remains the source of truth for the organization profile.

## Classes Flow

- Classes can be created, listed, edited, and deleted.
- Classes are used to group students and drive invoice generation.
- Class creation is part of the onboarding checklist.

## Students Flow

- Students can be created, listed, viewed, edited, and deleted.
- Student detail pages exist instead of relying on inline editing.
- Student edit screens are separate pages.
- The student record now supports parent contact details so WhatsApp notifications can be sent reliably.
- The frontend no longer treats class selection in the create-student area as a list filter.

## Fee Template Flow

- Fee templates can be created, listed, viewed, edited, and deleted.
- Template details now show line rows in a table instead of a cluttered card stack.
- The main templates page uses a table layout with a count of items instead of dumping all line rows on the page.
- Template search exists on the main page.
- Line-row search exists on the details page.
- Optional fee allocation now follows the school invoice/student selection style instead of a vague all-students assumption.

## Invoice Flow

- Invoice generation starts from billing.
- The backend can generate invoices for a class or a specific invoice record.
- Invoice lists now display real student name and class data.
- Invoice details include the nested student and class information.
- Optional fees on the invoice detail page are selected from the available template line items.
- Invoices remain the core object that payment reconciliation and notifications attach to.

## Payment Flow

- The active payment flow is checkout-based.
- Direct virtual-account transfer handling has been removed from the active path.
- Nomba payment creation uses the checkout route and callback configuration.
- Webhook processing validates payment events and updates invoice/payment state.
- Payment events are audited in the backend.
- The system is built to avoid guessing the latest transaction or applying a payment to the wrong invoice.

## Notification Flow

- Parent WhatsApp numbers are stored with students.
- When an invoice is generated, an outbound WhatsApp notification can be sent to the parent.
- When a payment is confirmed, a payment notification can be sent to the parent.
- Notification logs are stored in the database.
- Notification history can be viewed in the frontend.
- Failed notification sends can be resent from the notification history page.
- Notification sending is idempotent so the same invoice event is not spammed repeatedly.

## WhatsApp Flow

- The legacy inbound WhatsApp assistant route is not active.
- The app now uses outbound WhatsApp notifications instead of a chatbot-style assistant flow.
- Twilio sends the notifications from the backend.
- If Twilio is not configured, the notification records can still be stored, but live delivery will fail gracefully.

## Staff Flow

- Staff members can be invited from the frontend.
- Invitation emails are sent by the backend.
- Staff can accept the invite, set a password, and log in.
- Staff edit pages and invite pages are separate from admin-only school setup pages.

## Dashboard Flow

- The dashboard focuses on money-related reporting.
- Dashboard metrics are backed by the backend and used by the frontend for summary cards and charts.
- The dashboard is allowed to have a more polished, more responsive layout.
- The mobile layout now needs to remain usable on smaller screens.

## Access Flow

- Admin-only backend routes use permission checks.
- The frontend blocks restricted pages for staff using role-aware guards.
- Staff should not see admin-only actions that they cannot complete.

## What Is No Longer Part of the Active Flow

- The old direct virtual-account transfer flow is not active.
- The legacy WhatsApp assistant route is not mounted.
- Inline editing on several detail cards has been replaced by proper edit pages.
- The old `fixes.md` log was intentionally removed and should not be treated as the current source of truth.

## Current High-Level Sequence

- Register school.
- Verify email.
- Set up bank details.
- Create classes.
- Add students and parent WhatsApp numbers.
- Create fee templates.
- Generate invoices.
- Send checkout links and invoice notifications.
- Receive payment webhooks.
- Reconcile payment status.
- Notify parents.
- Track notification and payment history.

