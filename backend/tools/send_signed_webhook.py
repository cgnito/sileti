#!/usr/bin/env python3
import json
import hmac
import hashlib
import base64
import urllib.request
import sys

# Config -- edit as needed
NGROK_URL = "https://proscholastic-delphine-unmuscled.ngrok-free.dev/webhooks/nomba"
SECRET = "NombaHackathon2026"
TIMESTAMP = "2026-07-06T12:00:00Z"

# Sample payment_success payload from docs (trimmed)
payload = {
  "event_type": "payment_success",
  "requestId": "test-request-001",
  "data": {
    "merchant": {
      "walletId": "1ef33774-6d95-411c-b5aaaaaaa",
      "walletBalance": 259.47,
      "userId": "1ef33774-6d95-411c-b5bbbbbbb"
    },
    "transaction": {
      "fee": 2.8,
      "type": "online_checkout",
      "transactionId": "WEB-ONLINE_C-TEST-0001",
      "cardIssuer": "Visa",
      "responseCode": "",
      "originatingFrom": "web",
      "merchantTxRef": "mref-001",
      "transactionAmount": 202.8,
      "time": "2026-07-06T11:59:00Z"
    },
    "order": {
      "orderReference": "order-ref-test-0001",
      "amount": 202.8
    }
  }
}

# Build hashing payload same as backend/_build_signature_payload
merchant = (payload.get("data") or {}).get("merchant") or {}
transaction = (payload.get("data") or {}).get("transaction") or {}

def normalize_response_code(value):
    if value is None:
        return ""
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned.lower() == "null":
            return ""
        return cleaned
    return str(value)

parts = [
    payload.get("event_type", ""),
    payload.get("requestId", payload.get("request_id", "")),
    merchant.get("userId", ""),
    merchant.get("walletId", ""),
    transaction.get("transactionId", ""),
    transaction.get("type", ""),
    transaction.get("time", ""),
    normalize_response_code(transaction.get("responseCode")),
    TIMESTAMP,
]
hashing_payload = ":".join(parts)

digest = hmac.new(SECRET.encode("utf-8"), hashing_payload.encode("utf-8"), hashlib.sha256).digest()
signature = base64.b64encode(digest).decode()

print("Hashing payload:")
print(hashing_payload)
print("\nComputed nomba-signature:", signature)
print("nomba-timestamp:", TIMESTAMP)

# Post
data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(NGROK_URL, data=data, method="POST")
req.add_header("Content-Type", "application/json")
req.add_header("nomba-signature", signature)
req.add_header("nomba-timestamp", TIMESTAMP)

try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        print("\nResponse:", resp.getcode())
        print(body)
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8", errors="replace")
    print("\nHTTPError:", e.code)
    print(body)
except Exception as ex:
    print("\nError sending request:", ex)
    sys.exit(1)
