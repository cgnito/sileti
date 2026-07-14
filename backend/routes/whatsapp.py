"""
WhatsApp assistant route.

The Twilio webhook handler lives here. Business logic helpers that depend on
the request's DB session and caller phone number are defined as closures
inside the handler — they are passed directly to Gemini as callable tools.
"""
import html
import logging
import time
import uuid

from fastapi import APIRouter, Depends, Form, Response
from google.genai import types
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from services import nomba
from services.whatsapp_ai import (
    SYSTEM_INSTRUCTION,
    _call_gemini,
    _debug,
    _log_exception,
    ai_client,
    conversation_sessions,
)

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Assistant"])
logger = logging.getLogger(__name__)


@router.post("/webhook")
async def whatsapp_assistant_webhook(
    From: str = Form(...),
    Body: str = Form(...),
    db: Session = Depends(get_db),
):
    logger.info("whatsapp webhook entered")
    user_message = Body.strip()
    parent_phone = From.replace("whatsapp:", "").strip()
    logger.info("incoming phone number: %s", parent_phone)
    logger.info("incoming message: %s", user_message)
    _debug("debug mode enabled")

    if not ai_client:
        logger.warning("Gemini client unavailable — GEMINI_API_KEY missing or init failed.")
        safe_reply = "i am experiencing a slight network glitch. please try messaging me again shortly!"
        twiml = f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{html.escape(safe_reply, quote=False)}</Message></Response>'
        return Response(content=twiml, media_type="application/xml")

    # ── Tool 1: verify_student_by_id ─────────────────────────────────────────
    def verify_student_by_id(student_id: str) -> dict:
        logger.info("verify_student_by_id called | student_id=%s", student_id)
        try:
            normalized_id = (student_id or "").replace("-", "/").strip()
            _debug("verify_student_by_id normalized_id=%s", normalized_id)

            t0 = time.perf_counter()
            student = db.query(models.Student).filter(models.Student.silete_id == normalized_id).first()
            logger.info("verify_student_by_id student lookup took %.3fs", time.perf_counter() - t0)

            if not student:
                logger.info("verify_student_by_id no match for %s", normalized_id)
                return {"error": f"No student found with ID {student_id}"}

            t0 = time.perf_counter()
            school = db.query(models.Organization).filter(models.Organization.id == student.org_id).first()
            logger.info("verify_student_by_id school lookup took %.3fs", time.perf_counter() - t0)

            result = {
                "student_name": f"{student.first_name} {student.last_name}",
                "silete_id": student.silete_id,
                "school_name": school.school_name if school else "Unknown School",
                "student_uuid": str(student.id),
            }
            logger.info("verify_student_by_id result: %s", result)
            return result
        except Exception as exc:
            db.rollback()
            _log_exception("verify_student_by_id failed", exc)
            return {"error": f"verify_student_by_id failed: {type(exc).__name__}: {repr(exc)}"}

    # ── Tool 2: link_parent_to_student ───────────────────────────────────────
    def link_parent_to_student(student_id: str) -> dict:
        logger.info("link_parent_to_student called | student_id=%s", student_id)
        try:
            normalized_id = (student_id or "").replace("-", "/").strip()
            student = db.query(models.Student).filter(models.Student.silete_id == normalized_id).first()
            if not student:
                return {"error": f"Student matching {student_id} not found during link phase"}

            parent = db.query(models.Parent).filter(models.Parent.primary_phone == parent_phone).first()
            if not parent:
                parent = models.Parent(org_id=student.org_id, primary_phone=parent_phone, is_verified=True)
                db.add(parent)
                db.flush()

            if student not in parent.students:
                parent.students.append(student)

            unpaid_invoice = db.query(models.Invoice).filter(
                models.Invoice.student_id == student.id,
                models.Invoice.status != models.InvoiceStatus.PAID,
            ).first()

            total_due = (
                float(getattr(unpaid_invoice, "total_amount", 0) or 0)
                - float(getattr(unpaid_invoice, "paid_amount", 0) or 0)
            ) if unpaid_invoice else 0.0
            term_info = f"{unpaid_invoice.term} ({unpaid_invoice.session})" if unpaid_invoice else "current term"

            db.commit()

            result = {
                "success": True,
                "student_name": f"{student.first_name} {student.last_name}",
                "total_due": total_due,
                "term_info": term_info,
            }
            logger.info("link_parent_to_student result: %s", result)
            return result
        except Exception as exc:
            db.rollback()
            _log_exception("link_parent_to_student failed", exc)
            return {"error": f"link_parent_to_student failed: {type(exc).__name__}: {repr(exc)}"}

    # ── Tool 3: generate_payment_link ────────────────────────────────────────
    def generate_payment_link(student_id: str, amount_to_pay: float) -> dict:
        logger.info("generate_payment_link called | student_id=%s amount=%s", student_id, amount_to_pay)
        try:
            normalized_id = (student_id or "").replace("-", "/").strip()
            student = db.query(models.Student).filter(models.Student.silete_id == normalized_id).first()
            if not student:
                return {"error": "Student record missing during payment initialization."}

            invoice = db.query(models.Invoice).filter(
                models.Invoice.student_id == student.id,
                models.Invoice.status != models.InvoiceStatus.PAID,
            ).first()
            if not invoice:
                return {"error": "No outstanding invoice found for this student."}

            subaccount_id = nomba._get_hackathon_subaccount_id()
            order_ref = f"SIL-{uuid.uuid4().hex[:12].upper()}"
            amount_kobo = int(amount_to_pay * 100)
            customer_email = f"{student.silete_id.replace('/', '_')}@sileti.internal"

            t0 = time.perf_counter()
            checkout_url = nomba.create_checkout_order(
                amount_kobo=amount_kobo,
                order_ref=order_ref,
                school_subaccount_id=subaccount_id,
                customer_email=customer_email,
            )
            logger.info("generate_payment_link Nomba latency %.3fs", time.perf_counter() - t0)

            db.add(models.Transaction(
                org_id=student.org_id,
                invoice_id=invoice.id,
                amount=amount_to_pay,
                reference=order_ref,
                status=models.TransactionStatus.PENDING.value,
                checkout_url=checkout_url,
                customer_phone=parent_phone,
            ))
            db.commit()

            result = {"success": True, "checkout_url": checkout_url, "amount": amount_to_pay}
            logger.info("generate_payment_link result: %s", result)
            return result
        except Exception as exc:
            db.rollback()
            _log_exception("generate_payment_link failed", exc)
            return {"error": f"Could not generate secure session link: {type(exc).__name__}: {repr(exc)}"}

    # ── Execute Gemini conversation turn ─────────────────────────────────────
    try:
        if parent_phone not in conversation_sessions:
            logger.warning(
                "Creating new in-memory session for %s. This cache is process-local.",
                parent_phone,
            )
            conversation_sessions[parent_phone] = []

        chat_history = conversation_sessions[parent_phone]
        client = ai_client
        if client is None:
            raise RuntimeError("Gemini client unavailable")

        logger.info("session retrieved | phone=%s history_len=%s", parent_phone, len(chat_history))
        chat_history.append(
            types.Content(role="user", parts=[types.Part.from_text(text=user_message)])
        )

        ai_response = await _call_gemini(
            "first Gemini call",
            lambda: client.models.generate_content(
                model="gemini-2.5-flash",
                contents=chat_history,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.2,
                    tools=[verify_student_by_id, link_parent_to_student, generate_payment_link],
                ),
            ),
        )
        logger.info("Gemini text response: %r", ai_response.text)
        logger.info("Gemini function_calls: %s", bool(ai_response.function_calls))

        if ai_response.function_calls:
            logger.info("Gemini returned %s function call(s)", len(ai_response.function_calls))
            if ai_response.candidates and ai_response.candidates[0].content:
                chat_history.append(ai_response.candidates[0].content)

            tool_responses = []
            for call in ai_response.function_calls:
                logger.info("Gemini tool call: %s args=%s", call.name, call.args)
                if call.name == "verify_student_by_id":
                    tool_result = verify_student_by_id(student_id=call.args.get("student_id") or "")
                elif call.name == "link_parent_to_student":
                    tool_result = link_parent_to_student(student_id=call.args.get("student_id") or "")
                elif call.name == "generate_payment_link":
                    tool_result = generate_payment_link(
                        student_id=call.args.get("student_id") or "",
                        amount_to_pay=float(call.args.get("amount_to_pay") or 0),
                    )
                else:
                    tool_result = {"error": f"Unknown tool: {call.name}"}
                    logger.warning("Unknown Gemini function call: %s", call.name)

                logger.info("Tool result for %s: %s", call.name, tool_result)
                tool_responses.append(
                    types.Part.from_function_response(name=call.name, response={"result": tool_result})
                )

            chat_history.append(types.Content(role="tool", parts=tool_responses))

            final_response = await _call_gemini(
                "second Gemini call",
                lambda: client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=chat_history,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        temperature=0.2,
                    ),
                ),
            )
            reply_content = final_response.text or "i am experiencing a slight network glitch. please try messaging me again shortly!"
            if final_response.candidates and final_response.candidates[0].content:
                chat_history.append(final_response.candidates[0].content)
        else:
            reply_content = ai_response.text or "i am experiencing a slight network glitch. please try messaging me again shortly!"
            if ai_response.candidates and ai_response.candidates[0].content:
                chat_history.append(ai_response.candidates[0].content)

    except Exception as error:
        _log_exception("Webhook processing error", error)
        reply_content = "i am experiencing a slight network glitch. please try messaging me again shortly!"

    if reply_content is None:
        reply_content = "i am experiencing a slight network glitch. please try messaging me again shortly!"

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{html.escape(reply_content, quote=False)}</Message>
</Response>"""

    logger.info("TwiML response: %s", twiml)
    return Response(content=twiml, media_type="application/xml")
