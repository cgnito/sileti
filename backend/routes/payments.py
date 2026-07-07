import os
import time
import logging
from datetime import datetime, timezone
import requests
from fastapi import HTTPException, status

from services.utils import FRONTEND_URL

logger = logging.getLogger(__name__)

# In-memory token cache store to prevent redundant token initialization requests
_token_cache = {
    "access_token": None,
    "refresh_token": None,
    "expires_at": 0,
    "business_id": None,
}


def _normalize_base_url() -> str:
    return os.environ.get("NOMBA_BASE_URL", "https://sandbox.nomba.com").rstrip("/")

def _get_hackathon_subaccount_id() -> str | None:
    return os.environ.get("NOMBA_HACKATHON_SUBACCOUNT")

def _resolve_checkout_callback_url() -> str:
    """
    Resolve the public callback URL that Nomba should redirect back to after checkout.
    Prefer an explicit env override, then fall back to the app's frontend origin.
    """
    callback_url = os.environ.get("NOMBA_CHECKOUT_CALLBACK_URL")
    if callback_url:
        return callback_url.rstrip("/")

    return f"{FRONTEND_URL}/payment-success"


def _parse_expiry_timestamp(value: str | None) -> float:
    if not value:
        return 0

    if isinstance(value, (int, float)):
        return float(value)

    if not isinstance(value, str):
        return 0

    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value).astimezone(timezone.utc).timestamp()
    except ValueError:
        return 0


def _get_required_config() -> tuple[str, str, str]:
    account_id = os.environ.get("NOMBA_ACCOUNT_ID")
    client_id = os.environ.get("NOMBA_CLIENT_ID")
    client_secret = os.environ.get("NOMBA_CLIENT_SECRET")

    if not account_id or not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nomba sandbox credentials are not configured.",
        )
    return account_id, client_id, client_secret


def _store_token_response(result: dict, current_time: float) -> None:
    data = result.get("data") or {}
    access_token = data.get("access_token") or data.get("accessToken")
    refresh_token = data.get("refresh_token") or data.get("refreshToken")

    if not access_token:
        raise ValueError("Nomba authentication response did not contain an access token.")

    expires_at = _parse_expiry_timestamp(data.get("expiresAt"))
    if not expires_at:
        expires_at = current_time + 1500

    _token_cache["access_token"] = access_token
    _token_cache["refresh_token"] = refresh_token
    _token_cache["expires_at"] = expires_at
    _token_cache["business_id"] = data.get("businessId")


def get_nomba_access_token(force_refresh: bool = False) -> str:
    """
    Retrieve a valid Nomba access token for the sandbox environment.
    The token is cached and refreshed safely before expiry.
    """
    current_time = time.time()

    if not force_refresh and _token_cache["access_token"] and _token_cache["expires_at"] > current_time + 30:
        return _token_cache["access_token"]

    account_id, client_id, client_secret = _get_required_config()
    base_url = _normalize_base_url()
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "accountId": account_id,
    }

    if not force_refresh and _token_cache["refresh_token"] and _token_cache["expires_at"] <= current_time:
        logger.info("Nomba access token expired. Attempting token refresh.")
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": _token_cache["refresh_token"],
        }
        token_url = f"{base_url}/v1/auth/token/refresh"
    else:
        logger.info("Requesting a fresh Nomba access token from the sandbox.")
        payload = {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        }
        token_url = f"{base_url}/v1/auth/token/issue"

    try:
        response = requests.post(token_url, headers=headers, json=payload, timeout=10)

        if response.status_code != 200:
            logger.error("Failed to issue Nomba access token: %s", response.text)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Authentication failed with the Nomba sandbox gateway.",
            )

        result = response.json()
        if result.get("code") != "00":
            description = result.get("description") or "Unknown authentication error"
            raise ValueError(f"Token generation rejected: {description}")

        _store_token_response(result, current_time)
        return _token_cache["access_token"]

    except HTTPException:
        raise
    except Exception as error:
        logger.error("Outbound Nomba token request failed: %s", error)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to execute the Nomba authentication sequence.",
        ) from error


def make_nomba_request(method: str, endpoint: str, payload: dict | None = None) -> dict:
    """
    Utility wrapper to execute authenticated HTTP operations against the Nomba sandbox backend.
    It injects the account header and bearer token for each call.
    """
    token = get_nomba_access_token()
    base_url = _normalize_base_url()
    url = f"{base_url}/{endpoint.lstrip('/')}"

    account_id, _, _ = _get_required_config()
    headers = {
        "Authorization": f"Bearer {token}",
        "accountId": account_id,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        method_name = method.upper()
        if method_name == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method_name == "POST":
            response = requests.post(url, headers=headers, json=payload, timeout=10)
        else:
            raise ValueError(f"Unsupported HTTP method parameter structure: {method}")

        if response.status_code not in {200, 201}:
            logger.error("Nomba API request failed [%s] for %s: %s", response.status_code, endpoint, response.text)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Nomba service communication layer error: {response.text}",
            )

        result = response.json()
        if isinstance(result, dict) and result.get("code") not in {None, "00", 0}:
            description = result.get("description") or "Unknown Nomba API error"
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Nomba API returned an error: {description}",
            )

        return result

    except HTTPException:
        raise
    except Exception as error:
        logger.error("Outbound connection failure targeting endpoint %s: %s", endpoint, error)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment engine connectivity matrix dropped. Try again.",
        ) from error


def create_checkout_order(amount_kobo: int, order_ref: str, school_subaccount_id: str | None = None, customer_email: str | None = None) -> str:
    """
    Create an online checkout order with Nomba and return the generated checkout link.

    Args:
        amount_kobo: Total amount in kobo (e.g. 150000 for ₦1,500.00).
        order_ref: Order reference to identify the checkout order.
        school_subaccount_id: Optional Nomba sub-account ID to credit the payment.
        customer_email: Optional customer email to attach to the order.

    Returns:
        The checkout URL returned by Nomba.
    """

    endpoint = "v1/checkout/order"
    amount_string = f"{(amount_kobo / 100):.2f}"

    resolved_account_id = school_subaccount_id or _get_hackathon_subaccount_id()
    if not resolved_account_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nomba sub-account is not configured for checkout order creation.",
        )

    order_payload = {
        "amount": amount_string,
        "currency": "NGN",
        "orderReference": order_ref,
        "merchantTxRef": order_ref,
        "callbackUrl": _resolve_checkout_callback_url(),
        "allowedPaymentMethods": ["Card", "Transfer"],
        "accountId": resolved_account_id,
    }

    if customer_email:
        order_payload["customerEmail"] = customer_email

    payload = {
        "order": order_payload,
        "tokenizeCard": False,
    }

    logger.info(
        "Initializing Nomba checkout session. Reference=%s Amount=₦%s AccountId=%s",
        order_ref,
        amount_string,
        resolved_account_id,
    )

    result = make_nomba_request(method="POST", endpoint=endpoint, payload=payload)

    if result.get("code") != "00":
        description = result.get("description") or "Unknown error"
        logger.error("Checkout initialization failed with code %s: %s", result.get("code"), description)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Checkout creation failed: {description}",
        )

    data = result.get("data")
    if not isinstance(data, dict) or not isinstance(data.get("checkoutLink"), str):
        logger.error("Invalid checkout order response from Nomba: %s", result)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid response from Nomba while creating checkout order.",
        )

    return data["checkoutLink"]


def verify_transaction_by_id(transaction_id: str) -> dict:
    """
    Verify a transaction using Nomba's transactionRef lookup path.
    This is useful for webhook payloads that only expose the gateway transaction id.
    """
    if not transaction_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="transaction_id required")

    endpoint = f"v1/transactions/accounts/single?transactionRef={transaction_id}"
    result = make_nomba_request(method="GET", endpoint=endpoint)

    data = result.get("data")
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid response from Nomba while verifying transaction by id.",
        )

    return data


def verify_checkout_transaction(order_reference: str) -> dict:
    """
    Verify a checkout transaction with Nomba using the `orderReference`.

    Calls `GET /v1/transactions/accounts/single?orderReference=...` and returns
    the `data` block from Nomba. Raises HTTPException on errors.
    """
    if not order_reference:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="order_reference required")

    endpoint = f"v1/transactions/accounts/single?orderReference={order_reference}"
    result = make_nomba_request(method="GET", endpoint=endpoint)

    data = result.get("data")
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid response from Nomba while verifying transaction.",
        )

    return data
