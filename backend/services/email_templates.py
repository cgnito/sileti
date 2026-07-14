from __future__ import annotations

from dataclasses import dataclass
from html import escape
from decimal import Decimal
from typing import Iterable


def _format_currency(value: Decimal | float | int | str | None) -> str:
    if value is None:
        return "0.00"
    try:
        return f"{Decimal(str(value)):.2f}"
    except Exception:
        return "0.00"


def _join_text(lines: Iterable[str]) -> str:
    return "\n".join(line.strip() for line in lines if line is not None)


@dataclass(frozen=True)
class EmailTemplate:
    subject: str
    html: str
    text: str


def build_invoice_generated_email(
    *,
    student_name: str,
    student_id: str,
    class_name: str,
    session: str,
    term: str,
    due_date: str,
    total_amount: Decimal | float | int | str | None,
    chatbot_phone: str,
) -> EmailTemplate:
    amount = _format_currency(total_amount)
    safe_student_name = escape(student_name)
    safe_student_id = escape(student_id)
    safe_class_name = escape(class_name)
    safe_session = escape(session)
    safe_term = escape(term)
    safe_due_date = escape(due_date)
    safe_chatbot_phone = escape(chatbot_phone)

    subject = f"New invoice for {student_name} | Sileti"
    html = f"""
    <div style="margin:0;background:#f7f1e8;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1f1a17;">
      <div style="max-width:640px;margin:0 auto;background:#fff8f0;border:1px solid #e7d8c6;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(64,34,0,.08);">
        <div style="padding:28px 28px 20px;background:linear-gradient(135deg,#8f6234 0%,#b57c43 100%);color:#fff;">
          <div style="font-size:12px;letter-spacing:.26em;text-transform:uppercase;font-weight:700;opacity:.9;">Sileti</div>
          <h1 style="margin:14px 0 0;font-size:30px;line-height:1.1;">New invoice for {safe_student_name}</h1>
          <p style="margin:10px 0 0;font-size:15px;line-height:1.7;opacity:.95;">Hello, parent. A new fee invoice is ready for your child.</p>
        </div>
        <div style="padding:28px;">
          <div style="display:grid;gap:14px;">
            <div style="padding:16px 18px;border:1px solid #eddcc8;border-radius:18px;background:#fff;">
              <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#8f6234;font-weight:700;">Student</div>
              <div style="margin-top:6px;font-size:18px;font-weight:700;">{safe_student_name}</div>
              <div style="margin-top:4px;color:#6f5b49;font-size:14px;">ID: {safe_student_id}</div>
            </div>
            <div style="padding:16px 18px;border:1px solid #eddcc8;border-radius:18px;background:#fff;">
              <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#8f6234;font-weight:700;">Invoice</div>
              <div style="margin-top:6px;font-size:16px;font-weight:700;">{safe_class_name} · {safe_term}</div>
              <div style="margin-top:4px;color:#6f5b49;font-size:14px;">Session: {safe_session}</div>
            </div>
            <div style="padding:16px 18px;border:1px solid #eddcc8;border-radius:18px;background:#fff;">
              <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#8f6234;font-weight:700;">Amount due</div>
              <div style="margin-top:8px;font-size:32px;font-weight:800;color:#1f1a17;">₦{amount}</div>
              <div style="margin-top:4px;color:#6f5b49;font-size:14px;">Due date: {safe_due_date}</div>
            </div>
          </div>
          <div style="margin-top:24px;padding:18px;border-radius:20px;background:#f8efe3;border:1px solid #ead7bf;">
            <p style="margin:0;font-size:15px;line-height:1.75;color:#3d3026;">
              When you're ready to pay, please message our chatbot on WhatsApp at <strong>{safe_chatbot_phone}</strong>
              and paste the student ID <strong>{safe_student_id}</strong> to continue. We do not send the checkout link in this email.
            </p>
            <p style="margin:10px 0 0;font-size:14px;line-height:1.75;color:#5d4b3a;">
              That is the first step. The chatbot will guide you through the payment link when you are ready.
            </p>
          </div>
        </div>
      </div>
    </div>
    """

    text = _join_text(
        [
            f"New invoice for {student_name}",
            f"Hello parent, a new invoice is ready for {student_name}.",
            f"Student ID: {student_id}",
            f"Class: {class_name}",
            f"Term: {term}",
            f"Session: {session}",
            f"Amount due: ₦{amount}",
            f"Due date: {due_date}",
            "",
            f"When you're ready to pay, message our chatbot on WhatsApp at {chatbot_phone} and paste the student ID {student_id}.",
            "The checkout link is generated in WhatsApp, not in this email.",
        ]
    )

    return EmailTemplate(subject=subject, html=html, text=text)


def build_payment_received_email(
    *,
    student_name: str,
    student_id: str,
    class_name: str,
    session: str,
    term: str,
    total_amount: Decimal | float | int | str | None,
    paid_amount: Decimal | float | int | str | None,
    chatbot_phone: str,
) -> EmailTemplate:
    total = _format_currency(total_amount)
    paid = _format_currency(paid_amount)
    outstanding = _format_currency(Decimal(str(total_amount or 0)) - Decimal(str(paid_amount or 0)))

    safe_student_name = escape(student_name)
    safe_student_id = escape(student_id)
    safe_class_name = escape(class_name)
    safe_session = escape(session)
    safe_term = escape(term)
    safe_chatbot_phone = escape(chatbot_phone)

    subject = f"Payment received for {student_name} | Sileti"
    html = f"""
    <div style="margin:0;background:#f7f1e8;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1f1a17;">
      <div style="max-width:640px;margin:0 auto;background:#fff8f0;border:1px solid #e7d8c6;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(64,34,0,.08);">
        <div style="padding:28px;background:linear-gradient(135deg,#2d6a4f 0%,#40916c 100%);color:#fff;">
          <div style="font-size:12px;letter-spacing:.26em;text-transform:uppercase;font-weight:700;opacity:.9;">Sileti</div>
          <h1 style="margin:14px 0 0;font-size:30px;line-height:1.1;">Payment received for {safe_student_name}</h1>
          <p style="margin:10px 0 0;font-size:15px;line-height:1.7;opacity:.95;">Thank you. We have recorded the payment against the invoice.</p>
        </div>
        <div style="padding:28px;">
          <div style="display:grid;gap:14px;">
            <div style="padding:16px 18px;border:1px solid #d9ecdf;border-radius:18px;background:#fff;">
              <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#2d6a4f;font-weight:700;">Student</div>
              <div style="margin-top:6px;font-size:18px;font-weight:700;">{safe_student_name}</div>
              <div style="margin-top:4px;color:#6f5b49;font-size:14px;">ID: {safe_student_id}</div>
            </div>
            <div style="padding:16px 18px;border:1px solid #d9ecdf;border-radius:18px;background:#fff;">
              <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#2d6a4f;font-weight:700;">Invoice</div>
              <div style="margin-top:6px;font-size:16px;font-weight:700;">{safe_class_name} · {safe_term}</div>
              <div style="margin-top:4px;color:#6f5b49;font-size:14px;">Session: {safe_session}</div>
            </div>
            <div style="padding:16px 18px;border:1px solid #d9ecdf;border-radius:18px;background:#fff;">
              <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#2d6a4f;font-weight:700;">Payment summary</div>
              <div style="margin-top:8px;font-size:17px;font-weight:700;color:#1f1a17;">Paid: ₦{paid}</div>
              <div style="margin-top:4px;color:#6f5b49;font-size:14px;">Total due: ₦{total}</div>
              <div style="margin-top:4px;color:#6f5b49;font-size:14px;">Outstanding balance: ₦{outstanding}</div>
            </div>
          </div>
          <div style="margin-top:24px;padding:18px;border-radius:20px;background:#edf7f1;border:1px solid #d5eadf;">
            <p style="margin:0;font-size:15px;line-height:1.75;color:#294036;">
              If you need more assistance later, you can still message our chatbot on WhatsApp at <strong>{safe_chatbot_phone}</strong>
              and continue from the student ID.
            </p>
          </div>
        </div>
      </div>
    </div>
    """

    text = _join_text(
        [
            f"Payment received for {student_name}",
            f"Hello parent, payment has been recorded for {student_name}.",
            f"Student ID: {student_id}",
            f"Class: {class_name}",
            f"Term: {term}",
            f"Session: {session}",
            f"Paid: ₦{paid}",
            f"Total due: ₦{total}",
            f"Outstanding balance: ₦{outstanding}",
            "",
            f"If you need more assistance later, message our chatbot on WhatsApp at {chatbot_phone} and continue from the student ID.",
        ]
    )

    return EmailTemplate(subject=subject, html=html, text=text)
