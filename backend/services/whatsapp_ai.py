"""
Gemini AI client and helpers for the WhatsApp assistant.

This module owns:
- Gemini client initialisation
- In-memory conversation session cache
- The system prompt
- Low-level AI call utilities (_call_gemini, _classify_gemini_error, etc.)

The FastAPI router and webhook handler live in routes/whatsapp.py.
"""
import asyncio
import logging
import os
import time
from importlib.metadata import PackageNotFoundError, version as package_version

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

DEBUG_MODE = os.getenv("DEBUG_MODE", "").strip().lower() in {"1", "true", "yes", "on"}
GEMINI_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "20"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

try:
    GOOGLE_GENAI_VERSION = package_version("google-genai")
except PackageNotFoundError:
    GOOGLE_GENAI_VERSION = "unknown"

if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY is missing. Gemini requests will fail until configured.")

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

# In-memory conversation history — keyed by parent phone number.
# Note: this cache is process-local and will reset on cold starts / scale-out.
conversation_sessions: dict = {}

# ── System prompt ─────────────────────────────────────────────────────────────

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

# ── Helpers ───────────────────────────────────────────────────────────────────

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
    """Wrap a Gemini SDK call with timeout handling and structured logging."""
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
            label, elapsed, type(exc).__name__, exc,
        )
        raise
    except Exception as exc:
        elapsed = time.perf_counter() - start
        error_type = _classify_gemini_error(exc)
        logger.exception(
            "%s: Gemini call failed [%s] after %.3fs | type=%s repr=%r",
            label, error_type, elapsed, type(exc).__name__, exc,
        )
        raise
