import resend
import os
import re
from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:3000").rstrip("/")

def sanitize_text(text: str) -> str:
    if not text: 
        return text
    # collapse spaces and transform to title case format
    return re.sub(r'\s+', ' ', text.strip()).title()

def sanitize_short_code(text: str) -> str:
    if not text: 
        return text
    # strict spaces stripping and capitalization alignment
    return re.sub(r'\s+', '', text).upper()

def sanitize_email(email: str) -> str:
    if not email: 
        return email
    return email.strip().lower()


def normalize_phone_number(phone: str | None) -> str | None:
    """
    Normalizes a local or international phone number into a Twilio-friendly E.164 string.
    """
    if not phone:
        return None

    cleaned = phone.strip().replace("whatsapp:", "")
    cleaned = re.sub(r"[\s\-\(\)]", "", cleaned)
    if not cleaned:
        return None

    if cleaned.startswith("+"):
        digits = re.sub(r"\D", "", cleaned[1:])
        return f"+{digits}" if digits else None

    digits = re.sub(r"\D", "", cleaned)
    if not digits:
        return None

    if digits.startswith("0") and len(digits) == 11:
        return f"+234{digits[1:]}"

    if digits.startswith("234") and len(digits) >= 13:
        return f"+{digits}"

    return f"+{digits}"

def generate_short_code(name: str) -> str:
    # structural blueprint for generating short code acronym fallback sequences
    words = re.sub(r'[^a-zA-Z\s]', '', name).split()
    if len(words) >= 3:
        code = "".join([word[0] for word in words[:4]])
    elif len(words) == 2:
        code = words[0][:3] + words[1][0]
    else:
        code = words[0][:4]
    return code.upper()



def send_verification_email(email: str, token: str):
    # verification onboarding pipeline email sequence
    verify_link = f"{FRONTEND_URL}/verify-email?token={token}"
    try:
        resend.Emails.send({
            "from": "ṣilẹti App <onboarding@resend.dev>",
            "to": email,
            "subject": "Verify your school account on ṣilẹti",
            "html": f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                    <h2>Welcome to ṣilẹti!</h2>
                    <p>Please click the link below to verify your school's official email address:</p>
                    <a href="{verify_link}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Account</a>
                </div>
            """
        })
        print(f"successfully sent verification email to {email}")
    except Exception as e:
        print(f"verification email route failure: {e}")

def send_staff_invitation_email(email: str, token: str, admin_name: str, org_name: str):
    # set-password link strategy for delegated staff workflows
    invite_link = f"{FRONTEND_URL}/set-password?token={token}"
    try:
        resend.Emails.send({
            "from": "ṣilẹti App <onboarding@resend.dev>",
            "to": email,
            "subject": f"Invitation to join {org_name} on ṣilẹti",
            "html": f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                    <h2>You've been invited!</h2>
                    <p>{admin_name} has invited you to join <strong>{org_name}</strong> as a staff member.</p>
                    <p>Click the button below to establish your profile access password:</p>
                    <a href="{invite_link}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Set My Password</a>
                </div>
            """
        })
        print(f"successfully sent invitation email to {email}")
    except Exception as e:
        print(f"staff profile activation transmission failed: {e}")


#TODO: MAKE EMAILS FOLLOW DESIGN.MD
