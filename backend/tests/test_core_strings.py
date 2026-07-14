import unittest

from core.strings import (
    generate_short_code,
    normalize_phone_number,
    sanitize_email,
    sanitize_short_code,
    sanitize_text,
)


class SanitizeTextTest(unittest.TestCase):
    def test_strips_and_title_cases(self):
        self.assertEqual(sanitize_text("  greenwood academy  "), "Greenwood Academy")

    def test_collapses_internal_whitespace(self):
        self.assertEqual(sanitize_text("kings   college"), "Kings College")

    def test_returns_original_on_empty_string(self):
        self.assertEqual(sanitize_text(""), "")

    def test_returns_original_on_none_like_empty(self):
        # function accepts str; passing falsy string returns it unchanged
        self.assertFalse(sanitize_text(""))


class SanitizeShortCodeTest(unittest.TestCase):
    def test_removes_spaces_and_uppercases(self):
        self.assertEqual(sanitize_short_code("  grea  "), "GREA")

    def test_already_correct(self):
        self.assertEqual(sanitize_short_code("KWA"), "KWA")

    def test_empty_string_passthrough(self):
        self.assertEqual(sanitize_short_code(""), "")


class SanitizeEmailTest(unittest.TestCase):
    def test_strips_and_lowercases(self):
        self.assertEqual(sanitize_email("  Test@Example.COM  "), "test@example.com")

    def test_already_clean(self):
        self.assertEqual(sanitize_email("user@domain.com"), "user@domain.com")


class NormalizePhoneNumberTest(unittest.TestCase):
    def test_local_nigerian_number(self):
        self.assertEqual(normalize_phone_number("08012345678"), "+2348012345678")

    def test_international_with_plus(self):
        self.assertEqual(normalize_phone_number("+2348012345678"), "+2348012345678")

    def test_strips_whatsapp_prefix(self):
        self.assertEqual(normalize_phone_number("whatsapp:+2348012345678"), "+2348012345678")

    def test_strips_spaces_and_dashes(self):
        self.assertEqual(normalize_phone_number("+234 801 234 5678"), "+2348012345678")

    def test_returns_none_for_none(self):
        self.assertIsNone(normalize_phone_number(None))

    def test_returns_none_for_empty_string(self):
        self.assertIsNone(normalize_phone_number(""))

    def test_whatsapp_prefix_with_spaces(self):
        result = normalize_phone_number("whatsapp:+234 801 234 5678")
        self.assertEqual(result, "+2348012345678")

    def test_already_e164_passthrough(self):
        self.assertEqual(normalize_phone_number("+14155238886"), "+14155238886")


class GenerateShortCodeTest(unittest.TestCase):
    def test_three_word_name(self):
        self.assertEqual(generate_short_code("Kings College Lagos"), "KCL")

    def test_two_word_name(self):
        self.assertEqual(generate_short_code("Greenwood Academy"), "GREA")

    def test_single_word_name(self):
        self.assertEqual(generate_short_code("Unity"), "UNIT")

    def test_four_word_name_takes_first_four_initials(self):
        result = generate_short_code("Federal Government Girls College")
        self.assertEqual(result, "FGGC")

    def test_output_is_uppercase(self):
        result = generate_short_code("some school name")
        self.assertEqual(result, result.upper())


if __name__ == "__main__":
    unittest.main()
