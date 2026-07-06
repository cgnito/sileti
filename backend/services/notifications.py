from __future__ import annotations

import json
import logging
import os
from decimal import Decimal
from typing import Iterable
from uuid import UUID

from dotenv import load_dotenv
from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, selectinload
from twilio.rest import Client

import models
from database import SessionLocal
import utils

load_dotenv()

logger = logging.getLogger(__name__)

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM")
TWILIO_WHATSAPP_INVOICE_GENERATED_CONTENT_SID = os.getenv("TWILIO_WHATSAPP_INVOICE_GENERATED_CONTENT_SID")
TWILIO_WHATSAPP_PAYMENT_RECEIVED_CONTENT_SID = os.getenv("TWILIO_WHATSAPP_PAYMENT_RECEIVED_CONTENT_SID")


def _format_currency(value: Decimal | float | int | None) -> str:
    if value is None:
        return "0.00"
    try:
        return f"{Decimal(str(value)):.2f}"
    except Exception:
        return "0.00"


def _normalize_whatsapp_address(phone: str | None) -> str | None:
    normalized = utils.normalize_phone_number(phone)
    if not normalized:
        return None
    return f"whatsapp:{normalized}"


def _get_twilio_client() -> Client | None:
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        return None
    return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def _build_invoice_message(invoice: models.Invoice) -> str:
    student = invoice.student
    student_name = f"{student.first_name} {student.last_name}" if student else "the student"
    class_name = student.school_class.name if student and student.school_class else "their class"
    due_date = invoice.due_date.strftime("%d %b %Y") if invoice.due_date else "no due date"
    return (
        f"A new invoice has been generated for {student_name} in {class_name}. "
        f"Total due is ₦{_format_currency(invoice.total_amount)} and the due date is {due_date}."
    )


def _build_payment_message(invoice: models.Invoice) -> str:
    student = invoice.student
    student_name = f"{student.first_name} {student.last_name}" if student else "the student"
    balance = Decimal(str(invoice.total_amount)) - Decimal(str(invoice.paid_amount))
    return (
        f"Payment received for {student_name}. "
        f"Paid: ₦{_format_currency(invoice.paid_amount)} of ₦{_format_currency(invoice.total_amount)}. "
        f"Outstanding balance: ₦{_format_currency(balance)}."
    )


def _build_notification_payload(invoice: models.Invoice, event_type: str) -> dict:
    student = invoice.student
    student_name = f"{student.first_name} {student.last_name}" if student else "the student"

    if event_type == "payment_received":
        return {
            "1": student_name,
            "2": _format_currency(invoice.paid_amount),
            "3": _format_currency(invoice.total_amount),
        }

    class_name = student.school_class.name if student and student.school_class else "their class"
    return {
        "1": student_name,
        "2": class_name,
        "3": _format_currency(invoice.total_amount),
    }


def _build_notification_log_payload(invoice: models.Invoice, event_type: str, *, body: str, extra: dict | None = None) -> dict:
    student = invoice.student
    payload = {
        "invoice_id": str(invoice.id),
        "event_type": event_type,
        "student_name": f"{student.first_name} {student.last_name}" if student else "the student",
        "class_name": student.school_class.name if student and student.school_class else "their class",
        "amount": _format_currency(invoice.total_amount),
        "paid_amount": _format_currency(invoice.paid_amount),
        "body": body,
        **_build_notification_payload(invoice, event_type),
    }
    if extra:
        payload.update(extra)
    return payload


def _resolve_twilio_content_sid(event_type: str) -> str | None:
    if event_type == "payment_received":
        return TWILIO_WHATSAPP_PAYMENT_RECEIVED_CONTENT_SID

    if event_type == "invoice_generated":
        return TWILIO_WHATSAPP_INVOICE_GENERATED_CONTENT_SID

    return None


def _build_notification_body(invoice: models.Invoice, event_type: str) -> str:
    if event_type == "payment_received":
        return _build_payment_message(invoice)
    return _build_invoice_message(invoice)


def _record_notification(
    db,
    *,
    idempotency_key: str,
    org_id,
    student_id,
    invoice_id,
    channel: str,
    event_type: str,
    recipient_phone: str,
    status: str,
    message_sid: str | None = None,
    error_message: str | None = None,
    payload: dict | None = None,
) -> None:
    db.add(
        models.NotificationLog(
            idempotency_key=idempotency_key,
            org_id=org_id,
            student_id=student_id,
            invoice_id=invoice_id,
            channel=channel,
            event_type=event_type,
            recipient_phone=recipient_phone,
            message_sid=message_sid,
            status=status,
            error_message=error_message,
            payload=payload,
        )
    )


def _notification_idempotency_key(event_type: str, invoice_id: UUID, recipient_phone: str) -> str:
    return f"{event_type}:{invoice_id}:{utils.normalize_phone_number(recipient_phone) or recipient_phone}"


def _notification_already_sent(db, *, event_type: str, invoice_id: UUID, recipient_phone: str) -> bool:
    normalized_phone = utils.normalize_phone_number(recipient_phone)
    if not normalized_phone:
        return False

    return (
        db.query(models.NotificationLog)
        .filter(
            and_(
                models.NotificationLog.event_type == event_type,
                models.NotificationLog.invoice_id == invoice_id,
                models.NotificationLog.recipient_phone == normalized_phone,
                models.NotificationLog.status == "sent",
            )
        )
        .first()
        is not None
    )


def _send_whatsapp_message(
    recipient_phone: str,
    body: str,
    payload: dict | None = None,
    *,
    content_sid: str | None = None,
) -> tuple[str | None, str | None]:
    client = _get_twilio_client()
    sender = _normalize_whatsapp_address(TWILIO_WHATSAPP_FROM)
    recipient = _normalize_whatsapp_address(recipient_phone)

    if not client or not sender or not recipient:
        return None, "Twilio WhatsApp is not configured."

    try:
        message_kwargs: dict[str, object] = {
            "from_": sender,
            "to": recipient,
        }
        if content_sid:
            message_kwargs["content_sid"] = content_sid
            message_kwargs["content_variables"] = json.dumps(payload or {})
        else:
            message_kwargs["body"] = body

        message = client.messages.create(**message_kwargs)
        return getattr(message, "sid", None), None
    except Exception as exc:
        return None, str(exc)


def _send_invoice_notification(
    db,
    invoice: models.Invoice,
    event_type: str,
    recipient_phone: str,
    *,
    allow_existing: bool = False,
    notification_log: models.NotificationLog | None = None,
    payload: dict | None = None,
) -> tuple[str | None, str | None]:
    body = _build_notification_body(invoice, event_type)
    payload = payload or _build_notification_payload(invoice, event_type)
    normalized_phone = utils.normalize_phone_number(recipient_phone)
    if not normalized_phone:
        return None, "Invalid recipient phone number."

    if not allow_existing and _notification_already_sent(db, event_type=event_type, invoice_id=invoice.id, recipient_phone=normalized_phone):
        return None, None

    return _send_whatsapp_message(
        normalized_phone,
        body,
        payload=payload,
        content_sid=_resolve_twilio_content_sid(event_type),
    )


def _notify_invoice_event(db, invoice: models.Invoice, event_type: str) -> None:
    student = invoice.student
    if not student:
        logger.warning("Skipping notification for invoice %s because the student relation is missing.", invoice.id)
        return

    phones = list(dict.fromkeys(parent.primary_phone for parent in student.parents if parent.primary_phone))
    if not phones and getattr(student, "parent_phone", None):
        phones = [student.parent_phone]

    if not phones:
        _record_notification(
            db,
            org_id=invoice.org_id,
            student_id=student.id,
            invoice_id=invoice.id,
            idempotency_key=_notification_idempotency_key(event_type, invoice.id, ""),
            channel="whatsapp",
            event_type=event_type,
            recipient_phone="",
            status="skipped",
            error_message="No parent WhatsApp number is stored for this student.",
            payload=_build_notification_log_payload(invoice, event_type, body=_build_notification_body(invoice, event_type)),
        )
        db.commit()
        return

    body = _build_invoice_message(invoice) if event_type == "invoice_generated" else _build_payment_message(invoice)
    payload = _build_notification_payload(invoice, event_type)
    log_payload = _build_notification_log_payload(invoice, event_type, body=body)

    for phone in phones:
        normalized_phone = utils.normalize_phone_number(phone)
        if not normalized_phone:
            _record_notification(
                db,
                org_id=invoice.org_id,
                student_id=student.id,
                invoice_id=invoice.id,
                idempotency_key=_notification_idempotency_key(event_type, invoice.id, phone),
                channel="whatsapp",
                event_type=event_type,
                recipient_phone=phone,
                status="skipped",
                error_message="Invalid recipient phone number.",
                payload=log_payload,
            )
            continue

        if _notification_already_sent(db, event_type=event_type, invoice_id=invoice.id, recipient_phone=normalized_phone):
            continue

        idempotency_key = _notification_idempotency_key(event_type, invoice.id, normalized_phone)
        message_sid, error_message = _send_invoice_notification(
            db,
            invoice,
            event_type,
            normalized_phone,
            payload=payload,
        )

        with db.begin_nested():
            try:
                _record_notification(
                    db,
                    org_id=invoice.org_id,
                    student_id=student.id,
                    invoice_id=invoice.id,
                    idempotency_key=idempotency_key,
                    channel="whatsapp",
                    event_type=event_type,
                    recipient_phone=normalized_phone,
                    status="sent" if message_sid else "failed",
                    message_sid=message_sid,
                    error_message=error_message,
                    payload=log_payload,
                )
                db.flush()
            except IntegrityError:
                continue

    db.commit()


def resend_notification_attempt(db, notification_log_id: UUID, org_id: UUID) -> models.NotificationLog:
    notification_log = db.query(models.NotificationLog).filter(
        models.NotificationLog.id == notification_log_id,
        models.NotificationLog.org_id == org_id,
    ).first()
    if not notification_log:
        raise ValueError("Notification log not found.")

    if notification_log.status == "sent":
        raise ValueError("This notification was already sent.")

    invoice = db.query(models.Invoice).options(
        joinedload(models.Invoice.student).joinedload(models.Student.parents),
        joinedload(models.Invoice.student).joinedload(models.Student.school_class),
        selectinload(models.Invoice.items),
    ).filter(
        models.Invoice.id == notification_log.invoice_id,
        models.Invoice.org_id == org_id,
    ).first()

    if not invoice:
        raise ValueError("Invoice record not found for this notification.")

    message_sid, error_message = _send_invoice_notification(
        db,
        invoice,
        notification_log.event_type,
        notification_log.recipient_phone,
        allow_existing=True,
        notification_log=notification_log,
        payload=_build_notification_payload(invoice, notification_log.event_type),
    )

    notification_log.message_sid = message_sid
    notification_log.status = "sent" if message_sid else "failed"
    notification_log.error_message = error_message
    notification_log.payload = _build_notification_log_payload(
        invoice,
        notification_log.event_type,
        body=_build_notification_body(invoice, notification_log.event_type),
        extra={"resent_from_notification_id": str(notification_log.id)},
    )

    db.commit()
    db.refresh(notification_log)
    return notification_log


def notify_invoices_created(invoice_ids: Iterable[UUID]) -> None:
    invoice_ids = [invoice_id for invoice_id in invoice_ids if invoice_id]
    if not invoice_ids:
        return

    db = SessionLocal()
    try:
        invoices = db.query(models.Invoice).options(
            joinedload(models.Invoice.student).joinedload(models.Student.parents),
            joinedload(models.Invoice.student).joinedload(models.Student.school_class),
            selectinload(models.Invoice.items),
        ).filter(
            models.Invoice.id.in_(invoice_ids)
        ).all()

        for invoice in invoices:
            _notify_invoice_event(db, invoice, "invoice_generated")
    except Exception:
        db.rollback()
        logger.exception("Failed to queue invoice notifications.")
    finally:
        db.close()


def notify_payment_received(invoice_id: UUID) -> None:
    db = SessionLocal()
    try:
        invoice = db.query(models.Invoice).options(
            joinedload(models.Invoice.student).joinedload(models.Student.parents),
            joinedload(models.Invoice.student).joinedload(models.Student.school_class),
            selectinload(models.Invoice.items),
        ).filter(
            models.Invoice.id == invoice_id
        ).first()

        if not invoice:
            return

        _notify_invoice_event(db, invoice, "payment_received")
    except Exception:
        db.rollback()
        logger.exception("Failed to send payment receipt notification for invoice %s.", invoice_id)
    finally:
        db.close()
