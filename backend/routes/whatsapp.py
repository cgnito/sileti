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


# --- TOOL 1: VERIFY STUDENT RECORD ---
def verify_student_by_id(student_id: str, db: Session) -> dict:
    """
    Queries the database to find a student by their unique human-readable silete_id.
    Returns a dictionary containing the student's full name, their unique identifier, 
    and the school (organization) name they belong to.
    """
    # Normalize inputs (e.g., KWA-2026-0001 -> KWA/2026/0001)
    normalized_id = student_id.replace("-", "/").strip()
    
    # Look up the student record in the database
    student = db.query(models.Student).filter(models.Student.silete_id == normalized_id).first()
    if not student:
        return {"error": f"No student found with ID {student_id}"}
    
    # Fetch the linked organization to get the school name
    school = db.query(models.Organization).filter(models.Organization.id == student.org_id).first()
    school_name = school.school_name if school else "Unknown School"
    
    return {
        "student_name": f"{student.first_name} {student.last_name}",
        "silete_id": student.silete_id,
        "school_name": school_name,
        "student_uuid": str(student.id)
    }


# --- TOOL 2: LINK PARENT TO STUDENT ---
def link_parent_to_student(student_id: str, phone_number: str, db: Session) -> dict:
    """
    Registers or finds a parent by their phone number and securely links them 
    to the student record in the database via the many-to-many relationship.
    Returns the unpaid invoice amount for the student.
    """
    normalized_id = student_id.replace("-", "/").strip()
    
    student = db.query(models.Student).filter(models.Student.silete_id == normalized_id).first()
    if not student:
        return {"error": f"Student matching {student_id} not found during link phase"}
        
    # Check if a parent with this phone number already exists
    parent = db.query(models.Parent).filter(models.Parent.primary_phone == phone_number).first()
    
    if not parent:
        # Create a new parent record mapped to the same school ecosystem organization
        parent = models.Parent(
            org_id=student.org_id,
            primary_phone=phone_number,
            is_verified=True
        )
        db.add(parent)
        db.flush() 
        
    # Associate the student with the parent if not already linked
    if student not in parent.students:
        parent.students.append(student)
        
    # Fetch outstanding unpaid or partially paid invoices for this student
    unpaid_invoice = db.query(models.Invoice).filter(
        models.Invoice.student_id == student.id,
        models.Invoice.status != models.InvoiceStatus.PAID
    ).first()
    
    total_due = float(unpaid_invoice.total_amount - unpaid_invoice.paid_amount) if unpaid_invoice else 0.00
    term_info = f"{unpaid_invoice.term} ({unpaid_invoice.session})" if unpaid_invoice else "current term"

    db.commit()
    
    return {
        "success": True,
        "student_name": f"{student.first_name} {student.last_name}",
        "total_due": total_due,
        "term_info": term_info
    }


# --- TOOL 3: GENERATE SECURE PAYMENT LINK ---
def generate_payment_link(student_id: str, amount_to_pay: float, db: Session) -> dict:
    """
    Generates a secure Nomba checkout URL for a specific student's payment event.
    Accepts the amount as a float/integer representing standard Naira.
    """
    normalized_id = student_id.replace("-", "/").strip()
    student = db.query(models.Student).filter(models.Student.silete_id == normalized_id).first()
    if not student:
        return {"error": "Student record missing during payment initialization."}
        
    # Fixed lookup logic: Join through bank_settlement table relationship defined in Organization model
    settlement = db.query(models.BankSettlement).filter(models.BankSettlement.org_id == student.org_id).first()
    subaccount_id = settlement.nomba_subaccount_id if settlement else None

    order_ref = f"SIL-{uuid.uuid4().hex[:12].upper()}"
    
    # Convert standard Naira input into absolute integer Kobo for Nomba processing
    amount_kobo = int(amount_to_pay * 100)
    
    try:
        checkout_url = payments.create_checkout_order(
            amount_kobo=amount_kobo,
            order_ref=order_ref,
            school_subaccount_id=subaccount_id,
            customer_email=student.parent_email
        )
        return {"success": True, "checkout_url": checkout_url, "amount": amount_to_pay}
    except Exception as e:
        logger.error(f"Nomba order generation caught an exception: {str(e)}")
        return {"error": f"Could not generate secure session link: {str(e)}"}


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
   - action: you MUST call the tool function `link_parent_to_student` using the current active conversation context.
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
    From: str = Form(...),      # incoming parent phone number identifier
    Body: str = Form(...),      # the raw text content sent by the user
    db: Session = Depends(get_db)
):
    user_message = Body.strip()
    parent_phone = From.replace("whatsapp:", "").strip()

    try:
        # inject all three tools into the model configuration block
        ai_response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.2, 
                tools=[verify_student_by_id, link_parent_to_student, generate_payment_link]
            )
        )
        
        reply_content = ai_response.text

        # --- DYNAMIC FUNCTION PROCESSING ---
        if ai_response.function_calls:
            for call in ai_response.function_calls:
                
                # Handle Tool 1: Lookup record
                if call.name == "verify_student_by_id":
                    student_id_arg = call.args.get("student_id")
                    tool_result = verify_student_by_id(student_id=student_id_arg, db=db)
                    
                    if "error" in tool_result:
                        reply_content = f"sorry, i couldn't find any student with id '{student_id_arg}' in our system. please double-check the id and try again."
                    else:
                        reply_content = (
                            f"i found a record for {tool_result['student_name']} at {tool_result['school_name']}.\n\n"
                            f"is this your child? please reply with 'yes' or 'no'."
                        )

                # Handle Tool 2: Linking profile rows
                elif call.name == "link_parent_to_student":
                    student_id_arg = call.args.get("student_id")
                    tool_result = link_parent_to_student(
                        student_id=student_id_arg, 
                        phone_number=parent_phone, 
                        db=db
                    )
                    
                    if "error" in tool_result:
                        reply_content = "something went wrong verifying the record profile. please try entering your child's student id again."
                    else:
                        reply_content = (
                            f"thank you! i have securely linked your phone number to {tool_result['student_name']}'s profile.\n\n"
                            f"their total outstanding fee for {tool_result['term_info']} is ₦{tool_result['total_due']:,}. "
                            "would you like to pay this balance in full or make a part payment?"
                        )

                # Handle Tool 3: Generate dynamic checkout links
                elif call.name == "generate_payment_link":
                    student_id_arg = call.args.get("student_id")
                    amount_arg = float(call.args.get("amount_to_pay"))
    
                    payment_result = generate_payment_link(student_id=student_id_arg, amount_to_pay=amount_arg, db=db)
                    if "error" in payment_result:
                        reply_content = "i couldn't generate your payment session link at the moment. please try again."
                    else:
                        reply_content = (
                            f"here is your secure payment link for ₦{payment_result['amount']:,}:\n\n"
                            f"{payment_result['checkout_url']}\n\n"
                            "you can complete this transaction safely via bank transfer, ussd, or card payment methods."
                        )

    except Exception as error:
        logger.error(f"Webhook processing error context: {str(error)}")
        reply_content = "i am experiencing a slight network glitch. please try messaging me again shortly!"

    # Format response into raw TwiML XML string block for Twilio
    twiml_payload = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{reply_content}</Message>
</Response>"""

    return Response(content=twiml_payload, media_type="application/xml")