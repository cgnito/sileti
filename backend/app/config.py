"""
Centralized application configuration.

All environment variables are declared here once. Import `get_settings()`
anywhere in the app instead of calling os.getenv() directly.

Usage:
    from app.config import get_settings
    settings = get_settings()
    print(settings.frontend_url)
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = ""

    # ── Auth ─────────────────────────────────────────────────────────────────
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # ── App ──────────────────────────────────────────────────────────────────
    frontend_url: str = "http://localhost:3000"

    # ── Nomba ────────────────────────────────────────────────────────────────
    nomba_base_url: str = "https://sandbox.nomba.com"
    nomba_account_id: str = ""
    nomba_client_id: str = ""
    nomba_client_secret: str = ""
    nomba_webhook_secret: str = ""
    nomba_hackathon_subaccount: str = ""
    nomba_checkout_callback_url: str = ""

    # ── Email (Resend) ────────────────────────────────────────────────────────
    resend_api_key: str = ""

    # ── Twilio ───────────────────────────────────────────────────────────────
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = ""
    twilio_whatsapp_invoice_generated_content_sid: str = ""
    twilio_whatsapp_payment_received_content_sid: str = ""

    # ── Gemini ───────────────────────────────────────────────────────────────
    gemini_api_key: str = ""
    chatbot_phone_number: str = ""


@lru_cache
def get_settings() -> Settings:
    """Return the cached Settings singleton. Call get_settings.cache_clear() in tests."""
    return Settings()
