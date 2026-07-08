import asyncio
import html
import logging
import os
import time
import traceback
import uuid
from importlib.metadata import PackageNotFoundError, version as package_version
from fastapi import APIRouter, Depends, Form, Response
from sqlalchemy.orm import Session
from google import genai
from google.genai import types

from app import models
from app.database import get_db

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Assistant"])
logger = logging.getLogger(__name__)

DEBUG_MODE = os.getenv("DEBUG_MODE", "").strip().lower() in {"1", "true", "yes", "on"}
GEMINI_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "20"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

try:
    GOOGLE_GENAI_VERSION = package_version("google-genai")
except PackageNotFoundError:
    GOOGLE_GENAI_VERSION = "unknown"

if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY is missing. Gemini requests will fail until it is configured.")

try:
    ai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
except Exception as exc:
    ai_client = None
    logger.exception(
        "Failed to initialize Gemini client | type=%s repr=%r",
        type(exc).__name__,
        exc,
    )

logger.info("Loaded google-genai version: %s", GOOGLE_GENAI_VERSION)

# in-memory cache to persist conversational history across separate webhook requests
conversation_sessions = {}


def _debug(message: str, *args) -> None:
    if DEBUG_MODE:
        logger.debug(message, *args)


def _log_exception(context: str, exc: Exception) -> None:
    logger.exception(
        "%s | type=%s repr=%r",
        context,
        type(exc).__name__,
        exc,
    )


def _classify_gemini_error(exc: Exception) -> str:
    error_text = f"{type(exc).__name__} {repr(exc)} {exc}".lower()
    status_code = getattr(exc, "status_code", None)
    response = getattr(exc, "response", None)
    if status_code is None and response is not None:
        status_code = getattr(response, "status_code", None)

    if status_code == 429 or "resource_exhausted" in error_text or "quota exceeded" in error_text:
        return "quota_exhausted"

    if status_code in {401, 403} or "invalid api key" in error_text or "api key" in error_text or "permission_denied" in error_text:
        return "invalid_api_key"

    return "unknown"


async def _call_gemini(label: str, call_fn):
    start = time.perf_counter()
    logger.info("%s: starting Gemini call", label)
    _debug("%s: Gemini request payload prepared", label)
    try:
        response = await asyncio.wait_for(asyncio.to_thread(call_fn), timeout=GEMINI_TIMEOUT_SECONDS)
        elapsed = time.perf_counter() - start
        logger.info("%s: Gemini call completed in %.3fs", label, elapsed)
        _debug("%s: raw Gemini response repr=%r", label, response)
        return response
    except asyncio.TimeoutError as exc:
        elapsed = time.perf_counter() - start
        logger.exception(
            "%s: Gemini timeout after %.3fs | type=%s repr=%r",
            label,
            elapsed,
            type(exc).__name__,
            exc,
        )
        raise
    except Exception as exc:
        elapsed = time.perf_counter() - start
        error_type = _classify_gemini_error(exc)
        if error_type == "quota_exhausted":
            logger.exception(
                "%s: Gemini quota exhausted detected after %.3fs | type=%s repr=%r",
                label,
                elapsed,
                type(exc).__name__,
                exc,
            )
        elif error_type == "invalid_api_key":
            logger.exception(
                "%s: Gemini invalid API key detected after %.3fs | type=%s repr=%r",
                label,
                elapsed,
                type(exc).__name__,
                exc,
            )
        else:
            logger.exception(
                "%s: Gemini call failed after %.3fs | type=%s repr=%r",
                label,
                elapsed,
                type(exc).__name__,
                exc,
            )
        raise

# --- SYSTEM PROMPT TEMPLATE ---
SYSTEM_INSTRUCTION = """
# ROLE & PERSONALITY
you are sileti ai, an administrative assistant built to help parents find invoices and make school fee payments on the sileti platform. your tone is warm, secure, professional, and strictly concise (never reply with more than 3 lines of text).

# STATE MACHINE & CONVERSATION FLOW
you must guide the parent step-by-step through this exact sequence. do not skip steps:

1. THE GREETING & SECURITY TIP
   - trigger condition: when a parent sends their initial message ("hi", "hello", etc.).
   - action: greet them warmly, state your name, and briefly explain your purpose. 
   - critical security rule: you must explicitly warn them in this first message: "never type or share sensitive credentials like your bank pin, card digits, or passwords in this chat."
   - prompt: ask them to provide their child's unique student id in the standard format (e.g., KWA/2026/0001).

2. RECORD RECONCILIATION & CONFIRMATION
   - trigger condition: when the user provides a student code or id structure. 
   - action: you MUST call the tool function `verify_student_by_id` to check the database records.
   - state handling: once the tool returns the student's details, present the student's name and school name to the parent, and ask for absolute confirmation (e.g., "i found a record for 'adebayo jnr' at 'greenwood academy'. is this your child? reply yes or no").

3. PARENT-STUDENT LINKING (ACCOUNT CREATION)
   - trigger condition: when the parent explicitly responds "yes" confirming the child's identity match.
   - action: you MUST call the tool function `link_parent_to_student` passing ONLY the student_id parameter.
   - next prompt: after the tool finishes running successfully, display the outstanding invoice balance and term details returned by the tool, then ask: "would you like to pay this balance in full or make a part payment?"

4. AMOUNT CAPTURE (PART PAYMENT NEGOTIATION)
   - trigger condition: if the user chooses "part payment".
   - action: ask them: "please reply with the exact amount you want to pay right now."
   - processing: wait for them to type a numerical value (e.g., 50000 or N50,000).

5. NOMBA SECURE CHECKOUT GENERATION
   - trigger condition: when you have a finalized amount (either the full balance or the custom part payment amount specified by the parent).
   - action: you MUST call the tool function `generate_payment_link`, passing the student_id and the finalized numerical amount.
   - response: display the final secure payment URL link directly in the chat window, advising them that they can pay securely via transfer, ussd, or card.

# CONVERSATION GUARDRAILS & DRIFT CONTROL
- STRICT FOCUS CONSTRAINT: if the user tries to drift from the flow, asks general questions ("how is the weather?"), asks you to write code, or inputs random chat gibberish, ignore the drift. politely but firmly pull them back to the active conversation state (e.g., "i can only assist you with sileti fee payments. please reply with your child's student id to proceed.").
- FORMAT RECTIFICATION: if they type a student id with dashes (like KWA-2026-0001), normalize it or accept it gracefully, but always display it back to them using the system's preferred path separator format (KWA/2026/0001).
- NO INVENTIONS: never hallucinate, assume, or guess a student's name, an invoice total, or a checkout URL. if a lookup tool throws an error or returns empty data, politely inform them that no matching records were found and ask them to verify the id code with the school management office.
"""


# --- THE WEBHOOK ROUTE WITH DYNAMIC EXECUTION ENGINE ---
@router.post("/webhook")
async def whatsapp_assistant_webhook(
    From: str = Form(...),      
    Body: str = Form(...),      
    db: Session = Depends(get_db)
):
    logger.info("whatsapp webhook entered")
    user_message = Body.strip()
    parent_phone = From.replace("whatsapp:", "").strip()
    logger.info("incoming phone number: %s", parent_phone)
    logger.info("incoming message: %s", user_message)
    _debug("debug mode enabled: %s", DEBUG_MODE)

    if not ai_client:
        logger.warning("Gemini client unavailable because GEMINI_API_KEY is missing or client initialization failed.")
        safe_reply = "i am experiencing a slight network glitch. please try messaging me again shortly!"
        twiml_payload = f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{html.escape(safe_reply, quote=False)}</Message></Response>'
        logger.info("TwiML response: %s", twiml_payload)
        return Response(content=twiml_payload, media_type="application/xml")


    # tool 1: verify_student_by_id
    def verify_student_by_id(student_id: str) -> dict:
        logger.info("verify_student_by_id called | student_id=%s", student_id)
        try:
            normalized_id = (student_id or "").replace("-", "/").strip()
            _debug("verify_student_by_id normalized_id=%s", normalized_id)

            query_start = time.perf_counter()
            student = db.query(models.Student).filter(models.Student.silete_id == normalized_id).first()
            logger.info("verify_student_by_id student lookup took %.3fs", time.perf_counter() - query_start)

            if not student:
                logger.info("verify_student_by_id found no student for normalized_id=%s", normalized_id)
                return {"error": f"No student found with ID {student_id}"}

            query_start = time.perf_counter()
            school = db.query(models.Organization).filter(models.Organization.id == student.org_id).first()
            logger.info("verify_student_by_id school lookup took %.3fs", time.perf_counter() - query_start)

            school_name = school.school_name if school else "Unknown School"
            result = {
                "student_name": f"{student.first_name} {student.last_name}",
                "silete_id": student.silete_id,
                "school_name": school_name,
                "student_uuid": str(student.id)
            }
            logger.info("verify_student_by_id return value: %s", result)
            return result
        except Exception as exc:
            db.rollback()
            _log_exception("verify_student_by_id failed", exc)
            return {"error": f"verify_student_by_id failed: {type(exc).__name__}: {repr(exc)}"}


    # tool 2: link_parent_to_student
    def link_parent_to_student(student_id: str) -> dict:
        logger.info("link_parent_to_student called | student_id=%s", student_id)
        try:
            normalized_id = (student_id or "").replace("-", "/").strip()
            _debug("link_parent_to_student normalized_id=%s", normalized_id)

            query_start = time.perf_counter()
            student = db.query(models.Student).filter(models.Student.silete_id == normalized_id).first()
            logger.info("link_parent_to_student student lookup took %.3fs", time.perf_counter() - query_start)
            if not student:
                return {"error": f"Student matching {student_id} not found during link phase"}

            query_start = time.perf_counter()
            parent = db.query(models.Parent).filter(models.Parent.primary_phone == parent_phone).first()
            logger.info("link_parent_to_student parent lookup took %.3fs", time.perf_counter() - query_start)
            if not parent:
                parent = models.Parent(org_id=student.org_id, primary_phone=parent_phone, is_verified=True)
                db.add(parent)
                flush_start = time.perf_counter()
                db.flush()
                logger.info("link_parent_to_student parent flush took %.3fs", time.perf_counter() - flush_start)
            if student not in parent.students:
                parent.students.append(student)

            query_start = time.perf_counter()
            unpaid_invoice = db.query(models.Invoice).filter(
                models.Invoice.student_id == student.id, models.Invoice.status != models.InvoiceStatus.PAID
            ).first()
            logger.info("link_parent_to_student invoice lookup took %.3fs", time.perf_counter() - query_start)

            total_due = (
                float(getattr(unpaid_invoice, "total_amount", 0) or 0)
                - float(getattr(unpaid_invoice, "paid_amount", 0) or 0)
            ) if unpaid_invoice else 0.00
            term_info = f"{unpaid_invoice.term} ({unpaid_invoice.session})" if unpaid_invoice else "current term"

            commit_start = time.perf_counter()
            db.commit()
            logger.info("link_parent_to_student commit took %.3fs", time.perf_counter() - commit_start)

            result = {"success": True, "student_name": f"{student.first_name} {student.last_name}", "total_due": total_due, "term_info": term_info}
            logger.info("link_parent_to_student return value: %s", result)
            return result
        except Exception as exc:
            db.rollback()
            _log_exception("link_parent_to_student failed", exc)
            return {"error": f"link_parent_to_student failed: {type(exc).__name__}: {repr(exc)}"}



    # tool 3: generate_payment_link and initialize a Transaction record in the database
    def generate_payment_link(student_id: str, amount_to_pay: float) -> dict:
        logger.info("generate_payment_link called | student_id=%s amount_to_pay=%s", student_id, amount_to_pay)
        try:
            import routes.payments as payments

            normalized_id = (student_id or "").replace("-", "/").strip()
            _debug("generate_payment_link normalized_id=%s", normalized_id)

            query_start = time.perf_counter()
            student = db.query(models.Student).filter(models.Student.silete_id == normalized_id).first()
            logger.info("generate_payment_link student lookup took %.3fs", time.perf_counter() - query_start)
            if not student:
                return {"error": "Student record missing during payment initialization."}

            query_start = time.perf_counter()
            invoice = db.query(models.Invoice).filter(
                models.Invoice.student_id == student.id,
                models.Invoice.status != models.InvoiceStatus.PAID
            ).first()
            logger.info("generate_payment_link invoice lookup took %.3fs", time.perf_counter() - query_start)

            if not invoice:
                return {"error": "No outstanding invoice found for this student."}

            subaccount_id = payments._get_hackathon_subaccount_id()
            order_ref = f"SIL-{uuid.uuid4().hex[:12].upper()}"
            amount_kobo = int(amount_to_pay * 100)
            customer_email = f"{student.silete_id.replace('/', '_')}@sileti.internal"

            logger.info("generate_payment_link Nomba checkout start | order_ref=%s amount_kobo=%s", order_ref, amount_kobo)
            nomba_start = time.perf_counter()
            checkout_url = payments.create_checkout_order(
                amount_kobo=amount_kobo,
                order_ref=order_ref,
                school_subaccount_id=subaccount_id,
                customer_email=customer_email
            )
            logger.info("generate_payment_link Nomba latency %.3fs", time.perf_counter() - nomba_start)

            new_transaction = models.Transaction(
                org_id=student.org_id,
                invoice_id=invoice.id,
                amount=amount_to_pay,
                reference=order_ref,
                status=models.TransactionStatus.PENDING.value,
                checkout_url=checkout_url,
                customer_phone=parent_phone
            )

            db.add(new_transaction)
            commit_start = time.perf_counter()
            db.commit()
            logger.info("generate_payment_link commit took %.3fs", time.perf_counter() - commit_start)

            result = {"success": True, "checkout_url": checkout_url, "amount": amount_to_pay}
            logger.info("generate_payment_link return value: %s", result)
            return result
        except Exception as exc:
            db.rollback()
            _log_exception("generate_payment_link failed", exc)
            return {"error": f"Could not generate secure session link: {type(exc).__name__}: {repr(exc)}"}



    # --- EXECUTE GEMINI CALL ---
    try:
        # retrieve session history or create a new one if it does not exist
        if parent_phone not in conversation_sessions:
            logger.warning(
                "Creating new in-memory conversation session for %s. This cache is process-local and unreliable on Vercel cold starts or scale-out.",
                parent_phone,
            )
            conversation_sessions[parent_phone] = []

        chat_history = conversation_sessions[parent_phone]
        client = ai_client
        if client is None:
            logger.warning("Gemini client is unavailable after initialization check.")
            raise RuntimeError("Gemini client unavailable")
        logger.info("session retrieved | parent_phone=%s history_length=%s", parent_phone, len(chat_history))
        _debug("chat history before append: %s", chat_history)
        
        # append the incoming message from the user to the session timeline
        chat_history.append(
            types.Content(role="user", parts=[types.Part.from_text(text=user_message)])
        )
        logger.info("user message appended to session history")
        _debug("chat history after append: %s", chat_history)
        
        ai_response = await _call_gemini(
            "first Gemini call",
            lambda: client.models.generate_content(
                model='gemini-2.0-flash',
                contents=chat_history,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.2,
                    tools=[verify_student_by_id, link_parent_to_student, generate_payment_link]
                )
            )
        )
        logger.info("after first Gemini call")
        logger.info("raw Gemini response: %r", ai_response)
        logger.info("Gemini text response: %r", ai_response.text)
        logger.info("Gemini function_calls exist: %s", bool(ai_response.function_calls))
        
        # process execution loop if the model requires data parameters from internal tools
        if ai_response.function_calls:
            logger.info("Gemini returned %s function call(s)", len(ai_response.function_calls))
            # append model tool call intent to the context timeline history
            if ai_response.candidates and ai_response.candidates[0].content:
                chat_history.append(ai_response.candidates[0].content)
                logger.info("Gemini tool-call content appended to history")
            
            tool_responses = []
            for call in ai_response.function_calls:
                logger.info("Gemini function call name: %s", call.name)
                logger.info("Gemini function call args: %s", call.args)
                if call.name == "verify_student_by_id":
                    student_id_arg = call.args.get("student_id") if call.args else None
                    tool_result = verify_student_by_id(student_id=student_id_arg or "")
                    
                elif call.name == "link_parent_to_student":
                    student_id_arg = call.args.get("student_id") if call.args else None
                    tool_result = link_parent_to_student(student_id=student_id_arg or "")
                    
                elif call.name == "generate_payment_link":
                    student_id_arg = call.args.get("student_id") if call.args else None
                    amount_arg = float(call.args.get("amount_to_pay")) if call.args and call.args.get("amount_to_pay") is not None else 0.0
                    tool_result = generate_payment_link(student_id=student_id_arg or "", amount_to_pay=amount_arg)
                else:
                    tool_result = {"error": f"Unknown tool call: {call.name}"}
                    logger.warning("Unknown Gemini function call requested: %s", call.name)
                logger.info("Tool return value for %s: %s", call.name, tool_result)
                
                # package tool payload structures back into gemini format
                tool_responses.append(
                    types.Part.from_function_response(
                        name=call.name,
                        response={"result": tool_result}
                    )
                )
            
            # append tool payload results directly to chat context history
            chat_history.append(types.Content(role="tool", parts=tool_responses))
            logger.info("tool responses appended to chat history")
            
            # make follow up turn call allowing gemini to process tool metrics and context instructions
            logger.info("before second Gemini call")
            final_response = await _call_gemini(
                "second Gemini call",
                lambda: client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=chat_history,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        temperature=0.2,
                    )
                )
            )
            logger.info("after second Gemini call")
            logger.info("raw second Gemini response: %r", final_response)
            logger.info("second Gemini text response: %r", final_response.text)
            reply_content = final_response.text or "i am experiencing a slight network glitch. please try messaging me again shortly!"
            
            # append final response text to history to maintain multi turn context continuity
            if final_response.candidates and final_response.candidates[0].content:
                chat_history.append(final_response.candidates[0].content)
                logger.info("final Gemini content appended to history")
        else:
            # handle default text output conditions directly if no tools are invoked
            reply_content = ai_response.text or "i am experiencing a slight network glitch. please try messaging me again shortly!"
            if ai_response.candidates and ai_response.candidates[0].content:
                chat_history.append(ai_response.candidates[0].content)
                logger.info("non-tool Gemini content appended to history")

    except Exception as error:
        _log_exception("Webhook processing error", error)
        reply_content = "i am experiencing a slight network glitch. please try messaging me again shortly!"

    if reply_content is None:
        reply_content = "i am experiencing a slight network glitch. please try messaging me again shortly!"

    escaped_reply = html.escape(reply_content, quote=False)
    twiml_payload = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{escaped_reply}</Message>
</Response>"""

    logger.info("TwiML response: %s", twiml_payload)

    return Response(content=twiml_payload, media_type="application/xml")