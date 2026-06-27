import resend
import os
import re
from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")

def sanitize_text(text: str) -> str:
    if not text: return text
    return re.sub(r'\s+', ' ', text.strip()).title()

def sanitize_short_code(text: str) -> str:
    if not text: return text
    return re.sub(r'\s+', '', text).upper()

def sanitize_email(email: str) -> str:
    if not email: return email
    return email.strip().lower()

def generate_short_code(name: str) -> str:
    # Remove special characters and split into words
    words = re.sub(r'[^a-zA-Z\s]', '', name).split()
    if len(words) >= 3:
        code = "".join([word[0] for word in words[:4]])
    elif len(words) == 2:
        code = words[0][:3] + words[1][0]
    else:
        code = words[0][:4]
    return code.upper()


#send verification email to admin on registration
def send_verification_email(email: str, token: str):
    #link points back to server's verify route
    verify_link = f"http://127.0.0.1:8000/verify?token={token}" #TODO: change to production URL
    
    try:
        resend.Emails.send({
            "from": "ṣilẹti App <onboarding@resend.dev>", #TODO: change to production email
            "to": email, 
            "subject": "Verify your ṣilẹti account",
            "html": f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                    <h2>Welcome to ṣilẹti!</h2>
                    <p>Thank you for registering your school. Please click the button below to verify your account:</p>
                    <a href="{verify_link}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        Verify My Account
                    </a>
                    <p style="margin-top: 20px; font-size: 0.8em; color: #666;">
                        If the button doesn't work, copy and paste this link: <br>
                        {verify_link}
                    </p>
                </div>
            """
        })
        print(f"Successfully sent Resend email to {email}")
    except Exception as e:
        print(f"Resend error: {e}")


#send invitation email to staff on invitation
def send_staff_invitation_email(email: str, token: str, admin_name: str, org_name: str):
    #link points back to server's set-password route
    invite_link = f"http://127.0.0.1:8000/set-password?token={token}" #TODO: change to production URL
    
    try:
        resend.Emails.send({
            "from": "ṣilẹti App <onboarding@resend.dev>", #TODO: change to production email
            "to": email, 
            "subject": f"Invitation to join {org_name} on ṣilẹti",
            "html": f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                    <h2>You've been invited!</h2>
                    <p>{admin_name} has invited you to join <strong>{org_name}</strong> as a staff member.</p>
                    <p>Please click the button below to set your password and activate your account:</p>
                    <a href="{invite_link}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Accept Invitation
                    </a>
                </div>
            """
        })
    except Exception as e:
        print(f"Invite email error: {e}")

#TODO: MAKE EMAILS FOLLOW DESIGN.MD