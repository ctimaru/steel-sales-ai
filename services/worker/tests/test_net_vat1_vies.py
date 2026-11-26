"""NET-VAT1 fase 3: VIES answers mapped conservatively."""
import unittest

from app.net_vat1_vies import MAX_BATCH, VIES_URL, interpret_vies


class InterpretViesTest(unittest.TestCase):
    def test_valid_and_same_company(self):
        self.assertEqual(
            interpret_vies({"valid": True, "name": "ROSSI TUBI SRL", "address": "VIA ROMA 1"},
                           "Rossi Tubi S.r.l."),
            {"status": "valid", "name_match": "match", "registered_name": "ROSSI TUBI SRL"})

    def test_valid_but_other_company(self):
        result = interpret_vies({"isValid": True, "name": "PIXEL WEB AGENCY SRL"}, "Rossi Tubi S.r.l.")
        self.assertEqual((result["status"], result["name_match"]), ("valid", "mismatch"))

    def test_valid_without_name(self):
        result = interpret_vies({"valid": True, "name": "---"}, "Rossi Tubi S.r.l.")
        self.assertEqual((result["name_match"], result["registered_name"]), ("unknown", None))

    def test_not_in_vies_is_not_an_error(self):
        self.assertEqual(interpret_vies({"valid": False}, "Rossi Tubi S.r.l."), {"status": "not_in_vies"})

    def test_service_errors_are_retried(self):
        for payload in ({"actionSucceed": False, "errorWrappers": [{"error": "MS_UNAVAILABLE"}]},
                        {}, None, "oops"):
            self.assertEqual(interpret_vies(payload, "X S.r.l."), {"status": "unavailable"})

    def test_official_endpoint_and_cap(self):
        self.assertEqual(VIES_URL, "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number")
        self.assertEqual(MAX_BATCH, 200)


if __name__ == "__main__":
    unittest.main()
