"""
services/utils — email delivery helpers and re-exported string utilities.

String functions (sanitize_text, normalize_phone_number, etc.) live in
core/strings. They are re-exported here so legacy `from services import utils`
call-sites continue to work without modification.
"""
import logging
import os

import resend

from app.config import get_settings
from core.strings import (  # noqa: F401 — re-exported for callers that do utils.sanitize_text etc.
    generate_short_code,
    normalize_phone_number,
    sanitize_email,
    sanitize_short_code,
    sanitize_text,
)

logger = logging.getLogger(__name__)

# Module-level FRONTEND_URL used by services/nomba.py and patched in tests.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _get_resend_api_key() -> str:
    return get_settings().resend_api_key


def send_verification_email(email: str, token: str) -> None:
    resend.api_key = _get_resend_api_key()
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
            """,
        })
        logger.info("Verification email sent to %s", email)
    except Exception as exc:
        logger.error("Verification email failed for %s: %s", email, exc)


def send_staff_invitation_email(email: str, token: str, admin_name: str, org_name: str) -> None:
    resend.api_key = _get_resend_api_key()
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
                    <p>Click the button below to set your password:</p>
                    <a href="{invite_link}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Set My Password</a>
                </div>
            """,
        })
        logger.info("Invitation email sent to %s", email)
    except Exception as exc:
        logger.error("Invitation email failed for %s: %s", email, exc)


def send_verification_email_background_task(email: str, token: str) -> None:
    """Background-task-safe wrapper — catches and logs exceptions instead of raising."""
    try:
        send_verification_email(email, token)
    except Exception as exc:
        logger.error("Background verification email failed for %s: %s", email, exc)
