import os
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
import schemas
from routes import orgs, payments


class FakeResponse:
    def __init__(self, status_code=200, json_data=None, text=""):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.text = text

    def json(self):
        return self._json_data


class NombaAuthTests(unittest.TestCase):
    def setUp(self):
        os.environ["NOMBA_ACCOUNT_ID"] = "11111111-1111-1111-1111-111111111111"
        os.environ["NOMBA_CLIENT_ID"] = "client-id"
        os.environ["NOMBA_CLIENT_SECRET"] = "client-secret"
        payments._token_cache = {"access_token": None, "refresh_token": None, "expires_at": 0}
        os.environ["NOMBA_BASE_URL"] = "https://sandbox.nomba.com"

    @patch("routes.payments.requests.post")
    def test_get_nomba_access_token_issues_and_caches_token(self, mock_post):
        mock_post.return_value = FakeResponse(
            200,
            {
                "code": "00",
                "description": "Success",
                "data": {
                    "businessId": "business-123",
                    "access_token": "token-123",
                    "refresh_token": "refresh-123",
                    "expiresAt": "2030-01-01T00:00:00Z",
                },
            },
        )

        first = payments.get_nomba_access_token()
        second = payments.get_nomba_access_token()

        self.assertEqual(first, "token-123")
        self.assertEqual(second, "token-123")
        self.assertEqual(mock_post.call_count, 1)

    @patch("routes.payments.get_nomba_access_token", return_value="token-123")
    @patch("routes.payments.requests.get")
    def test_make_nomba_request_uses_bearer_auth_header(self, mock_get, _mock_token):
        mock_get.return_value = FakeResponse(200, {"code": "00", "data": {"ok": True}})

        result = payments.make_nomba_request("GET", "/v1/test")

        self.assertEqual(result["data"]["ok"], True)
        self.assertEqual(mock_get.call_args.kwargs["headers"]["Authorization"], "Bearer token-123")
        self.assertEqual(mock_get.call_args.kwargs["headers"]["accountId"], os.environ["NOMBA_ACCOUNT_ID"])

    def test_bank_lookup_normalization_handles_nomba_response_shape(self):
        response = {
            "code": "00",
            "description": "Success",
            "data": {
                "results": [
                    {"code": "058", "name": "Guaranty Trust Bank"},
                ]
            },
        }

        self.assertEqual(orgs._normalize_nomba_bank_list(response), [{"bank_name": "Guaranty Trust Bank", "bank_code": "058"}])
        self.assertEqual(orgs._extract_lookup_account_name({"data": {"accountName": "Ada Lovelace"}}), "Ada Lovelace")

    @patch("routes.orgs.payments.make_nomba_request")
    def test_verify_bank_account_name_uses_v2_lookup_endpoint(self, mock_make_request):
        mock_make_request.return_value = {"data": {"accountName": "Ada Lovelace"}}

        result = orgs.verify_bank_account_name(
            lookup_input=schemas.BankAccountLookupRequest(bank_code="058", account_number="0123456789"),
            current_admin=None,
        )

        self.assertEqual(result["account_name"], "Ada Lovelace")
        self.assertEqual(mock_make_request.call_args.kwargs["endpoint"], "v1/transfers/bank/lookup")

    @patch("routes.orgs.payments.create_virtual_account_for_school")
    def test_submit_bank_settlement_creates_virtual_account_and_saves_record(self, mock_create_va):
        mock_create_va.return_value = {
            "accountRef": "va-greenwood-123",
            "bankAccountNumber": "1234567890",
            "accountName": "Greenwood Academy",
            "bankName": "Nomba MFB",
        }

        engine = create_engine("sqlite:///:memory:")
        models.Base.metadata.create_all(engine)
        session_factory = sessionmaker(bind=engine)
        db = session_factory()

        org = models.Organization(
            school_name="Greenwood Academy",
            short_code="GREEN",
            school_email="greenwood@example.com",
            hashed_password="hash",
            slug="greenwood-academy",
        )
        db.add(org)
        db.commit()
        db.refresh(org)

        class DummyCurrentAdmin:
            def __init__(self, org):
                self.organization = org
                self.org_id = org.id

        current_admin = DummyCurrentAdmin(org)
        payload = schemas.BankSettlementCreate(
            bank_name="Nomba Bank",
            bank_code="058",
            account_number="0123456789",
            account_name="Greenwood Academy",
        )

        result = orgs.submit_bank_settlement(bank_input=payload, current_admin=current_admin, db=db)

        self.assertEqual(result.bank_name, "Nomba Bank")
        self.assertEqual(result.nomba_virtual_account_ref, "va-greenwood-123")
        self.assertTrue(org.has_setup_bank)
        self.assertEqual(mock_create_va.call_count, 1)

        saved = db.query(models.BankSettlement).filter(models.BankSettlement.org_id == org.id).first()
        self.assertIsNotNone(saved)
        self.assertEqual(saved.nomba_virtual_account_number, "1234567890")

    @patch("routes.payments.make_nomba_request")
    def test_create_virtual_account_for_school_uses_hackathon_sub_account(self, mock_make_request):
        mock_make_request.return_value = {"code": "00", "data": {"bankAccountNumber": "1234567890"}}
        os.environ["NOMBA_HACKATHON_SUBACCOUNT"] = "sub-account-123"

        result = payments.create_virtual_account_for_school(None, "Greenwood Academy")

        self.assertEqual(result["bankAccountNumber"], "1234567890")
        self.assertEqual(mock_make_request.call_args.kwargs["endpoint"], "v1/accounts/virtual/sub-account-123")
        payload = mock_make_request.call_args.kwargs["payload"]
        self.assertEqual(payload["accountName"], "Greenwood Academy")
        self.assertNotIn("currency", payload)
        self.assertNotIn("expiryDate", payload)
        self.assertNotIn("expectedAmount", payload)


if __name__ == "__main__":
    unittest.main()
