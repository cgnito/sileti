"""
Pure string utility functions.

This module has zero dependencies on the rest of the application.
It can be imported safely by any layer, including schemas/.
"""
import re


def sanitize_text(text: str) -> str:
    """Strip extra whitespace and apply title-case."""
    if not text:
        return text
    return re.sub(r"\s+", " ", text.strip()).title()


def sanitize_short_code(text: str) -> str:
    """Remove all whitespace and force uppercase."""
    if not text:
        return text
    return re.sub(r"\s+", "", text).upper()


def sanitize_email(email: str) -> str:
    """Strip whitespace and force lowercase."""
    if not email:
        return email
    return email.strip().lower()


def normalize_phone_number(phone: str | None) -> str | None:
    """
    Normalise a local or international phone number into E.164 format.

    Handles:
    - Nigerian local format: 0801... → +2348...
    - International with +: +234...
    - WhatsApp prefix: whatsapp:+234...
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
    """
    Derive a short alphabetic code from a school name.

    Examples:
        "Greenwood Academy"       → "GREA"
        "Kings College Lagos"     → "KCL"
        "Unity"                   → "UNIT"
    """
    words = re.sub(r"[^a-zA-Z\s]", "", name).split()
    if len(words) >= 3:
        code = "".join(word[0] for word in words[:4])
    elif len(words) == 2:
        code = words[0][:3] + words[1][0]
    else:
        code = words[0][:4]
    return code.upper()
