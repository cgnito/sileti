# Update Log

This document captures the implemented changes and the configuration needed before testing the app.

## What Changed

- Added parent contact capture to student records so the backend can send WhatsApp notifications to the correct number.
- Added outbound Twilio WhatsApp notification support for invoice generation and payment confirmation events.
- Added notification logging in the backend so each message send is tracked and auditable.
- Added resend support for failed notification logs.
- Hardened notification idempotency so the same invoice event does not trigger duplicate sends.
- Added the frontend notification history page with search, filters, counters, and resend actions.
- Added frontend role blocking for staff-restricted areas using a reusable `RequireRole` guard.
- Removed the legacy WhatsApp assistant route from the active router so it no longer participates in the app flow.
- Kept the active payment flow centered on checkout and webhook reconciliation.
- Updated checkout creation to send `merchantTxRef` alongside `orderReference` so the backend can reconcile payments using the stable merchant reference first.
- Hardened webhook reconciliation to prefer `merchantTxRef` when matching a payment back to the local transaction record.
- Added a safer webhook signature check that accepts both base64 and hex HMAC output while still requiring a valid Nomba secret.
- Expanded invoice responses so the frontend can show real student and class data instead of fallback labels.
- Updated the invoices list and invoice details UI to use the nested student and class data.
- Adjusted student, fee, invoice, and staff tables to be more responsive on smaller screens.
- Improved the dashboard direction toward money-centered metrics and cleaner UI structure.
- Improved the students page top area so search and create controls are not visually mixed together.
- Changed the fee template creation flow to align with the expected per-student optional allocation behavior.
- Moved several edits out of inline card expansion and into dedicated edit pages.
- Disabled school email editing on the school profile page.
- Added parent email support to student create, edit, detail, and bulk CSV upload flows.
- Switched invoice-generated and payment-received outbound notifications to email-first delivery.
- Added branded email templates for invoice generation and payment confirmation in a dedicated service module.
- Made the invoice email explicitly route parents into the WhatsApp chatbot instead of sending a payment link directly by email.
- Updated notification logging so email attempts are stored, searchable, and resubmittable from the frontend.
- Added a new frontend notifications channel filter and updated the audit table to surface email recipients.
- Updated student create/edit/detail screens to capture and display parent email.

## Backend Changes

- Added notification persistence and resend endpoints under the organization routes.
- Added notification service helpers for email delivery with legacy WhatsApp resend fallback.
- Added a dedicated email template module for invoice and payment notifications.
- Added notification log storage and idempotency support in the database layer.
- Added support for invoice-related notification payloads that include student and class context.
- Expanded payment and webhook handling to better audit and reconcile incoming payment events.
- Added or updated tests for Nomba auth, Nomba webhooks, student contact handling, and student email contact handling.
- Added a regression test proving webhook reconciliation still works when `orderReference` and `merchantTxRef` differ.
- Kept the checkout flow as the active payment path and removed the direct virtual-account transfer flow from the active router.
- Commented out the legacy WhatsApp assistant router so it is not mounted.

## Frontend Changes

- Added the notifications page in the dashboard area.
- Added a reusable frontend role guard component for restricted pages.
- Updated dashboard layout handling for cleaner navigation and access control.
- Updated the students, fees, invoices, and staff screens for better mobile behavior.
- Updated invoice and fee template views to rely on the new nested data returned by the backend.
- Updated school profile UI so the email field is read-only.
- Updated the notifications page so it can search, filter, and resend email attempts.
- Updated the student create/edit/detail pages so parent email can be captured and displayed.

## New or Updated Environment Variables

### Backend Required

- `DATABASE_URL` - PostgreSQL connection string used by SQLAlchemy and Alembic.
- `SECRET_KEY` - Secret used for authentication and token signing.
- `ALGORITHM` - JWT signing algorithm used by the auth layer.
- `FRONTEND_URL` - Base frontend URL used in verification and redirect links.
- `NOMBA_BASE_URL` - Base URL for Nomba API requests.
- `NOMBA_ACCOUNT_ID` - Nomba account identifier used for authenticated API calls.
- `NOMBA_CLIENT_ID` - Nomba API client id.
- `NOMBA_CLIENT_SECRET` - Nomba API client secret.
- `NOMBA_WEBHOOK_SECRET` - Secret used to verify Nomba webhook signatures.
- `RESEND_API_KEY` - API key used for verification and invitation emails.
- `CHATBOT_PHONE_NUMBER` - WhatsApp number shown in email notifications for continuing the payment flow.

### Backend Optional

- `NOMBA_CHECKOUT_CALLBACK_URL` - Explicit checkout callback URL if you do not want to rely on a generated default.
- `NOMBA_HACKATHON_SUBACCOUNT` - Fallback subaccount reference used by the checkout flow in this setup.
- `TWILIO_ACCOUNT_SID` - Twilio account SID for WhatsApp delivery.
- `TWILIO_AUTH_TOKEN` - Twilio auth token for WhatsApp delivery.
- `TWILIO_WHATSAPP_FROM` - WhatsApp sender address in Twilio format, usually `whatsapp:+...`.
- `TWILIO_WHATSAPP_CONTENT_SID` - Optional Twilio content template SID for templated WhatsApp messages.
- `DEBUG_NOMBA_HOOKS` - Optional debug flag that logs webhook signature and payload details while testing.

### Frontend Required

- `NEXT_PUBLIC_API_URL` - Public backend API base URL used by the frontend client.

## Before Testing

- Set the backend database connection and run migrations against the correct database.
- Make sure the auth secrets are present before starting the backend.
- Set the Nomba variables if you want payment and webhook features to work.
- Make sure `NOMBA_WEBHOOK_SECRET` matches the secret configured in the Nomba dashboard before testing webhook delivery.
- Set the Resend key if you want verification, invitation, and payment notification emails to send.
- Set `CHATBOT_PHONE_NUMBER` before testing invoice email notifications so the call-to-action points to the chatbot.
- Set the Twilio variables only if you still want the legacy WhatsApp resend fallback to work.
- Set `FRONTEND_URL` correctly so email links and redirects point to the correct frontend origin.
- Set `NEXT_PUBLIC_API_URL` before starting the frontend.

## Validation Performed

- Backend Python compile check passed with `python3 -m py_compile` over the touched backend modules.
- Frontend TypeScript check passed with `npx tsc --noEmit`.
- The current code state is consistent with the new docs in this file.

## Notes

- The old `fixes.md` log was intentionally removed and is not being recreated here.
- The legacy WhatsApp assistant route remains quarantined and should stay out of the active router unless the product direction changes.
