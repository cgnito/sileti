import unittest
from uuid import uuid4

from schemas.students import StudentCreate, StudentUpdate


class StudentContactSchemaTests(unittest.TestCase):
    def test_student_create_normalizes_local_phone_numbers(self):
        payload = StudentCreate(
            first_name="Ada",
            last_name="Lovelace",
            class_id=uuid4(),
            parent_phone="08012345678",
        )

        self.assertEqual(payload.parent_phone, "+2348012345678")

    def test_student_update_normalizes_international_phone_numbers(self):
        payload = StudentUpdate(parent_phone="whatsapp:+234 801 234 5678")

        self.assertEqual(payload.parent_phone, "+2348012345678")


if __name__ == "__main__":
    unittest.main()
