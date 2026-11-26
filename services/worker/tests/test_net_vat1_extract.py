"""NET-VAT1: P.IVA read from the company's own official pages."""
import unittest

from app.net_vat1_extract import find_firstparty_vat, it_vat_ok, vies_name_match


class ItVatChecksumTest(unittest.TestCase):
    def test_check_digit(self):
        self.assertTrue(it_vat_ok("00743110157"))
        self.assertTrue(it_vat_ok("02194750234"))
        self.assertFalse(it_vat_ok("00743110158"))
        self.assertFalse(it_vat_ok("00000000000"))
        self.assertFalse(it_vat_ok("1234567890"))


class FindFirstPartyVatTest(unittest.TestCase):
    def test_footer_vat(self):
        found = find_firstparty_vat(
            ["Carpenteria metallica", "© 2025 Coltro srl | P.IVA: 02194750234 | REA VR222737"],
            "Coltro srl")
        self.assertEqual((found.outcome, found.vat_id, found.page_index), ("found", "02194750234", 1))

    def test_variants_with_it_prefix_and_cf(self):
        for text in ("C.F. e P.IVA IT02194750234", "Partita IVA n. 02194750234",
                     "VAT number: IT 02194750234", "Cod. Fisc./P.IVA 02194750234"):
            self.assertEqual(find_firstparty_vat([text]).vat_id, "02194750234", text)

    def test_invalid_check_digit_is_ignored(self):
        self.assertEqual(find_firstparty_vat(["P.IVA 02194750235"]).outcome, "not_found")

    def test_number_without_vat_cue_is_ignored(self):
        self.assertEqual(find_firstparty_vat(["Tel. 02194750234 fax"]).outcome, "not_found")

    def test_web_agency_credit_is_ignored(self):
        found = find_firstparty_vat(
            ["Rossi Tubi S.r.l. P.IVA 02194750234 - Sito realizzato da Pixel Web Agency P.IVA 00743110157"],
            "Rossi Tubi S.r.l.")
        self.assertEqual((found.outcome, found.vat_id), ("found", "02194750234"))

    def test_two_vats_resolved_by_legal_name(self):
        found = find_firstparty_vat(
            ["Gruppo Alfa: Rossi Tubi S.r.l. P.IVA 02194750234",
             "Consociata Beta Holding S.p.A. P.IVA 00743110157"],
            "Rossi Tubi S.r.l.")
        self.assertEqual((found.outcome, found.vat_id), ("found", "02194750234"))

    def test_two_vats_without_name_are_ambiguous(self):
        found = find_firstparty_vat(["P.IVA 02194750234", "P.IVA 00743110157"], "Gamma S.r.l.")
        self.assertEqual((found.outcome, found.vat_id), ("ambiguous", None))


class ViesNameMatchTest(unittest.TestCase):
    def test_same_company_with_different_formatting(self):
        self.assertEqual(vies_name_match("Rossi Tubi S.r.l.", "ROSSI TUBI SRL"), "match")
        self.assertEqual(vies_name_match("F.lli Bianchi S.n.c.", "FRATELLI BIANCHI SNC DI BIANCHI MARIO & C."), "match")
        self.assertEqual(vies_name_match("IN.BRO.FER S.R.L.", "INBROFER SRL"), "match")

    def test_other_company_is_mismatch(self):
        self.assertEqual(vies_name_match("Rossi Tubi S.r.l.", "PIXEL WEB AGENCY SRL"), "mismatch")

    def test_no_registered_name_is_unknown(self):
        self.assertEqual(vies_name_match("Rossi Tubi S.r.l.", "---"), "unknown")
        self.assertEqual(vies_name_match("Rossi Tubi S.r.l.", None), "unknown")


if __name__ == "__main__":
    unittest.main()
