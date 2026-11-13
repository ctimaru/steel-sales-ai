"""NET-IT-AUTO2 v4: ragione sociale found on the company's own pages."""
import unittest

from app.net_it_identity_extract import find_company_identity


class FindCompanyIdentityTest(unittest.TestCase):
    def test_footer_name_with_vat_replaces_domain_guess(self):
        found = find_company_identity(
            ["Benvenuti in Mattiolo S.r.l. carpenteria",
             "© 2024 Mattiolo S.r.l. - P.IVA 01234567890 - Sede legale Via Roma 1"],
            "mattiolosrl.it", "mattiolosrl")
        self.assertEqual(found.legal_name, "Mattiolo S.r.l.")
        self.assertEqual(found.vat_id, "01234567890")

    def test_partnership_found_and_kept_whole(self):
        found = find_company_identity(
            ["Contatti: DELLAICA S.N.C. P.IVA IT09876543210"], "dellaicasnc.it", "dellaicasnc")
        self.assertEqual(found.legal_name, "DELLAICA S.N.C.")
        self.assertEqual(found.vat_id, "09876543210")

    def test_acronym_brand_matches_domain(self):
        found = find_company_identity(
            ["G.A.F.M. S.r.l. | Partita IVA 11122233344"], "gafmsrl.com", "GAFM")
        self.assertEqual(found.legal_name, "G.A.F.M. S.r.l.")

    def test_web_agency_credit_is_ignored(self):
        found = find_company_identity(
            ["Sito realizzato da Pixel Mattiolo Studio S.r.l."], "mattiolosrl.it", "Mattiolo")
        self.assertIsNone(found)

    def test_unrelated_company_is_ignored(self):
        found = find_company_identity(
            ["Distributore ufficiale Arcelor Steel S.p.A. P.IVA 12345678901"],
            "carpenteriarossi.it", "Carpenteria Rossi")
        self.assertIsNone(found)

    def test_sole_trader_has_no_company_name(self):
        found = find_company_identity(
            ["Carpenteria Rossi Mario - P.IVA 01234567890 - Via Po 3"],
            "carpenteriarossi.it", "Carpenteria Rossi Mario")
        self.assertIsNone(found)

    def test_person_name_partnership_is_returned_with_di(self):
        # Kept whole: the database discards names with " di " (person names).
        found = find_company_identity(
            ["C.M.O. di Bianchi Luca & C. S.n.c. - P.IVA 01234567890"], "cmosnc.it", "C.M.O.")
        self.assertIn(" di ", found.legal_name)
        self.assertTrue(found.legal_name.endswith("S.n.c."))

    def test_lowercase_prose_word_stops_the_name(self):
        found = find_company_identity(
            ["La nostra azienda Tecnometal Srl nasce nel 1980. Tecnometal Srl P.IVA 01234567890"],
            "tecnometal.it", "Tecnometal")
        self.assertEqual(found.legal_name, "Tecnometal Srl")

    def test_srls_and_spa_forms(self):
        self.assertEqual(find_company_identity(["Italweld S.r.l.s. P.IVA 01234567890"],
                         "italweldsrl.it", "Italweld S.r.l.s.").legal_name, "Italweld S.r.l.s.")
        self.assertEqual(find_company_identity(["ACCIAI NORD S.P.A. capitale sociale 1.000.000"],
                         "acciainord.it", "Acciai Nord").legal_name, "ACCIAI NORD S.P.A.")


if __name__ == "__main__":
    unittest.main()
