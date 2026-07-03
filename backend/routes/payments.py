import os
import time
import logging
import requests
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

# Sandbox URL used exclusively for the hackathon context
NOMBA_BASE_URL = "https://sandbox.api.nomba.com/"
NOMBA_ACCOUNT_ID = os.environ.get("NOMBA_ACCOUNT_ID")
NOMBA_CLIENT_ID = os.environ.get("NOMBA_CLIENT_ID")
NOMBA_CLIENT_SECRET = os.environ.get("NOMBA_CLIENT_SECRET")

# Fallback static hackathon sub-account id 
NOMBA_HACKATHON_SUBACCOUNT = os.environ.get("NOMBA_HACKATHON_SUBACCOUNT")

# In-memory token cache store to prevent redundant token initialization requests
_token_cache = {
    "access_token": None,
    "expires_at": 0
}

def get_nomba_access_token() -> str:
    """
    Retrieves a valid OAuth2 access token using client_credentials grant type.
    Caches the token for up to 25 minutes to comply with the 30-minute expiration rule safely.
    """
    current_time = time.time()
    
    # Reuse the cached token if it is still completely valid and hasn't expired yet
    if _token_cache["access_token"] and current_time < _token_cache["expires_at"]:
        return _token_cache["access_token"]
        
    logger.info("Nomba token expired or missing. Fetching fresh access token from sandbox.")
    
    url = f"{NOMBA_BASE_URL}v1/auth/token/issue"
    headers = {
        "content-type": "application/json",
        "accountid": NOMBA_ACCOUNT_ID
    }
    payload = {
        "grant_type": "client_credentials",
        "client_id": NOMBA_CLIENT_ID,
        "client_secret": NOMBA_CLIENT_SECRET
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        
        if response.status_code != 200:
            logger.error(f"Failed to issue token from Nomba sandbox: {response.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Authentication failed with the primary gateway provider."
            )
            
        result = response.json()
        if result.get('code') != '00':
            raise Exception(f"Token generation rejected: {result.get('description')}")
            
        access_token = result["data"]["access_token"]
        
        # Access tokens expire after 30 minutes. 
        # Caching for 25 minutes (1500 seconds) gives a safe 5-minute buffer before expiry.
        _token_cache["access_token"] = access_token
        _token_cache["expires_at"] = current_time + 1500
        
        return access_token
        
    except Exception as error:
        logger.error(f"Outbound Nomba token route request failed: {str(error)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to execute connection sequence with checkout merchant layer."
        )


def make_nomba_request(method: str, endpoint: str, payload: dict = None) -> dict:
    """
    Utility wrapper to execute authenticated HTTP operations against the Nomba sandbox backend.
    Injects appropriate security headers and bearer tokens seamlessly on every invocation.
    """
    token = get_nomba_access_token()
    url = f"{NOMBA_BASE_URL}{endpoint}"
    
    headers = {
        "authorization": f"bearer {token}",
        "accountid": NOMBA_ACCOUNT_ID,
        "content-type": "application/json"
    }
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=payload, timeout=10)
        else:
            raise ValueError(f"Unsupported HTTP method parameter structure: {method}")
            
        if response.status_code not in [200, 201]:
            logger.error(f"Nomba API endpoint returned failure state [{response.status_code}]: {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Nomba service communication layer error: {response.text}"
            )
            
        return response.json()
        
    except Exception as error:
        logger.error(f"Outbound connection failure targeting endpoint {endpoint}: {str(error)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment engine connectivity matrix dropped. Try again."
        )

# -- TO FIX --
def create_virtual_account_for_school(sub_account_id: str, school_name: str) -> dict:
    """
    Creates a permanent, static virtual account number (NUBAN) for a specific school sub-account.
    All funds paid into this virtual account will be collected in the designated sub-account.
    """
    
    endpoint = f"v1/accounts/virtual/{sub_account_id}"
    
    # Generate a unique account reference for this virtual account (Must be 16-64 characters)
    # Using timestamp and safe truncation to ensure uniqueness and compliance
    clean_name = school_name.lower().replace(" ", "")[:10]
    account_ref = f"va_{clean_name}_{int(time.time())}"
    
    payload = {
        "accountRef": account_ref,
        "accountName": f"{school_name} - Collection",
        "currency": "NGN"
        # Omit expiryDate and expectedAmount so it acts as a permanent Static Virtual Account
    }
    
    logger.info(f"Requesting static virtual account for sub-account: {sub_account_id}")
    
    # Execute the authenticated HTTP POST operation
    result = make_nomba_request(method="POST", endpoint=endpoint, payload=payload)
    
    if result.get('code') != '00':
        logger.error(f"Nomba Virtual Account creation failed: {result.get('description')}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create school virtual bank account: {result.get('description')}"
        )
        
    return result['data']


# GOTTA FIX LATER
def create_checkout_order(amount_kobo: int, order_ref: str, school_subaccount_id: str = None, customer_email: str = None) -> str:
    """
    POSTs an online checkout order session request to Nomba.
    
    Args:
        amount_kobo: The total charge amount explicitly in integer kobo (e.g. 150000 for ₦1,500.00)
        order_ref: A unique identifier code tracking this payment attempt (UUID v4 format)
        school_subaccount_id: The dynamic or fallback sub-account ID where the funds will be deposited
        customer_email: The parent's email address to route transaction receipt copies to
        
    Returns:
        The secure checkoutLink URL string generated by Nomba.
    """
    
    endpoint = "v1/checkout/order"
    
    # safely transform the total kobo integer into string representation with two decimal places (e.g. "1500.00")
    amount_string = f"{(amount_kobo / 100):.2f}"
    
    order_payload = {
        "amount": amount_string,
        "currency": "NGN",
        "orderReference": order_ref,
        "callbackUrl": "https://sileti.vercel.app/payment-success", #change to production url later
        "allowedPaymentMethods": ["Card", "Transfer"]
    }
    
    # scope layout tracking: Pass sub-account id inside the order object body parameters block
    if school_subaccount_id:
        order_payload["accountId"] = school_subaccount_id
    elif NOMBA_HACKATHON_SUBACCOUNT:
        order_payload["accountId"] = NOMBA_HACKATHON_SUBACCOUNT
        
    if customer_email:
        order_payload["customerEmail"] = customer_email

    payload = {
        "order": order_payload,
        "tokenizeCard": False
    }
    
    logger.info(f"Initializing Nomba checkout session. Reference: {order_ref} | Amount: ₦{amount_string}")
    
    result = make_nomba_request(method="POST", endpoint=endpoint, payload=payload)
    
    if result.get('code') != '00':
        logger.error(f"Checkout initialization failed with code {result.get('code')}: {result.get('description')}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_GATEWAY,
            detail=f"Checkout creation failed: {result.get('description')}"
        )
        
    # Extract the checkout link
    return result['data']['checkoutLink']