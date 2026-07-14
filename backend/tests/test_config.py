import os
import unittest

from app.config import Settings, get_settings


class SettingsDefaultsTest(unittest.TestCase):
    """Settings fields have the right defaults when not overridden by env."""

    def setUp(self):
        get_settings.cache_clear()

    def tearDown(self):
        get_settings.cache_clear()

    def test_algorithm_default(self):
        s = Settings(database_url="sqlite:///test.db", secret_key="test")
        self.assertEqual(s.algorithm, "HS256")

    def test_access_token_expire_minutes_default(self):
        s = Settings(database_url="sqlite:///test.db", secret_key="test")
        self.assertEqual(s.access_token_expire_minutes, 30)

    def test_frontend_url_default(self):
        s = Settings(database_url="sqlite:///test.db", secret_key="test")
        self.assertEqual(s.frontend_url, "http://localhost:3000")

    def test_nomba_base_url_default(self):
        s = Settings(database_url="sqlite:///test.db", secret_key="test")
        self.assertEqual(s.nomba_base_url, "https://sandbox.nomba.com")

    def test_empty_string_defaults_for_secrets(self):
        # Pass values explicitly to isolate from any live .env file.
        s = Settings(
            database_url="sqlite:///test.db",
            secret_key="test",
            resend_api_key="",
            gemini_api_key="",
            chatbot_phone_number="",
        )
        self.assertEqual(s.resend_api_key, "")
        self.assertEqual(s.gemini_api_key, "")
        self.assertEqual(s.chatbot_phone_number, "")

    def test_constructor_kwargs_override_env(self):
        s = Settings(
            database_url="postgresql://user:pass@host/db",
            secret_key="super-secret",
            algorithm="HS512",
            frontend_url="https://myapp.example.com",
        )
        self.assertEqual(s.algorithm, "HS512")
        self.assertEqual(s.frontend_url, "https://myapp.example.com")


class GetSettingsCacheTest(unittest.TestCase):
    """get_settings() returns the same cached instance on repeated calls."""

    def setUp(self):
        get_settings.cache_clear()
        os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")
        os.environ.setdefault("SECRET_KEY", "test-key")

    def tearDown(self):
        get_settings.cache_clear()

    def test_same_object_returned_twice(self):
        s1 = get_settings()
        s2 = get_settings()
        self.assertIs(s1, s2)

    def test_cache_clear_returns_fresh_instance(self):
        s1 = get_settings()
        get_settings.cache_clear()
        s2 = get_settings()
        # They should be equal in values but are different objects
        self.assertEqual(s1.algorithm, s2.algorithm)


if __name__ == "__main__":
    unittest.main()
