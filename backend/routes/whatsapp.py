import os
import logging
import uuid 
from fastapi import APIRouter, Depends, Form, Response
from sqlalchemy.orm import Session
from google import genai
from google.genai import types

import models
from database import get_db
from . import payments 

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Assistant"])
logger = logging.getLogger(__name__)

ai_client = genai.Client()

# in-memory cache to persist conversational history across separate webhook requests
conversation_sessions = {}

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
    user_message = Body.strip()
    parent_phone = From.replace("whatsapp:", "").strip()
    logger.info(f"incoming webhook raw phone number string: {parent_phone}")

    def verify_student_by_id(student_id: str) -> dict:
        normalized_id = student_id.replace("-", "/").strip()
        student = db.query(models.Student).filter(models.Student.silete_id == normalized_id).first()
        if not student:
            return {"error": f"No student found with ID {student_id}"}
        school = db.query(models.Organization).filter(models.Organization.id == student.org_id).first()
        school_name = school.school_name if school else "Unknown School"
        return {
            "student_name": f"{student.first_name} {student.last_name}",
            "silete_id": student.silete_id,
            "school_name": school_name,
            "student_uuid": str(student.id)
        }

    
    def link_parent_to_student(student_id: str) -> dict:
        normalized_id = student_id.replace("-", "/").strip()
        student = db.query(models.Student).filter(models.Student.silete_id == normalized_id).first()
        if not student:
            return {"error": f"Student matching {student_id} not found during link phase"}
        
        # Securely use parent_phone from the outer FastAPI request scope directly!
        parent = db.query(models.Parent).filter(models.Parent.primary_phone == parent_phone).first()
        if not parent:
            parent = models.Parent(org_id=student.org_id, primary_phone=parent_phone, is_verified=True)
            db.add(parent)
            db.flush() 
        if student not in parent.students:
            parent.students.append(student)
            
        unpaid_invoice = db.query(models.Invoice).filter(
            models.Invoice.student_id == student.id, models.Invoice.status != models.InvoiceStatus.PAID
        ).first()
        total_due = float(unpaid_invoice.total_amount - unpaid_invoice.paid_amount) if unpaid_invoice else 0.00
        term_info = f"{unpaid_invoice.term} ({unpaid_invoice.session})" if unpaid_invoice else "current term"
        db.commit()
        return {"success": True, "student_name": f"{student.first_name} {student.last_name}", "total_due": total_due, "term_info": term_info}

    def generate_payment_link(student_id: str, amount_to_pay: float) -> dict:
        normalized_id = student_id.replace("-", "/").strip()
        student = db.query(models.Student).filter(models.Student.silete_id == normalized_id).first()
        if not student:
            return {"error": "Student record missing during payment initialization."}
        settlement = db.query(models.BankSettlement).filter(models.BankSettlement.org_id == student.org_id).first()
        subaccount_id = settlement.nomba_subaccount_id if settlement else None
        order_ref = f"SIL-{uuid.uuid4().hex[:12].upper()}"
        amount_kobo = int(amount_to_pay * 100)
        try:
            checkout_url = payments.create_checkout_order(
                amount_kobo=amount_kobo, order_ref=order_ref, school_subaccount_id=subaccount_id, customer_email=student.parent_email
            )
            return {"success": True, "checkout_url": checkout_url, "amount": amount_to_pay}
        except Exception as e:
            logger.error(f"Nomba order generation caught an exception: {str(e)}")
            return {"error": f"Could not generate secure session link: {str(e)}"}

    # --- EXECUTE GEMINI CALL ---
    try:
        # retrieve session history or create a new one if it does not exist
        if parent_phone not in conversation_sessions:
            conversation_sessions[parent_phone] = []
            
        chat_history = conversation_sessions[parent_phone]
        
        # append the incoming message from the user to the session timeline
        chat_history.append(
            types.Content(role="user", parts=[types.Part.from_text(text=user_message)])
        )
        
        ai_response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=chat_history,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.2, 
                tools=[verify_student_by_id, link_parent_to_student, generate_payment_link]
            )
        )
        
        # process execution loop if the model requires data parameters from internal tools
        if ai_response.function_calls:
            # append model tool call intent to the context timeline history
            chat_history.append(ai_response.candidates[0].content)
            
            tool_responses = []
            for call in ai_response.function_calls:
                if call.name == "verify_student_by_id":
                    student_id_arg = call.args.get("student_id")
                    tool_result = verify_student_by_id(student_id=student_id_arg)
                    
                elif call.name == "link_parent_to_student":
                    student_id_arg = call.args.get("student_id")
                    tool_result = link_parent_to_student(student_id=student_id_arg)
                    
                elif call.name == "generate_payment_link":
                    student_id_arg = call.args.get("student_id")
                    amount_arg = float(call.args.get("amount_to_pay"))
                    tool_result = generate_payment_link(student_id=student_id_arg, amount_to_pay=amount_arg)
                
                # package tool payload structures back into gemini format
                tool_responses.append(
                    types.Part.from_function_response(
                        name=call.name,
                        response={"result": tool_result}
                    )
                )
            
            # append tool payload results directly to chat context history
            chat_history.append(types.Content(role="tool", parts=tool_responses))
            
            # make follow up turn call allowing gemini to process tool metrics and context instructions
            final_response = ai_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=chat_history,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.2,
                )
            )
            reply_content = final_response.text
            
            # append final response text to history to maintain multi turn context continuity
            if final_response.candidates and final_response.candidates[0].content:
                chat_history.append(final_response.candidates[0].content)
        else:
            # handle default text output conditions directly if no tools are invoked
            reply_content = ai_response.text
            if ai_response.candidates and ai_response.candidates[0].content:
                chat_history.append(ai_response.candidates[0].content)

    except Exception as error:
        logger.error(f"Webhook processing error context: {str(error)}")
        reply_content = "i am experiencing a slight network glitch. please try messaging me again shortly!"

    twiml_payload = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{reply_content}</Message>
</Response>"""

    return Response(content=twiml_payload, media_type="application/xml")