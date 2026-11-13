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


class BoilerplateBoundaryTest(unittest.TestCase):
    """Real first-run v4 cases (13 Nov 2026): footers flatten menus and privacy
    notices into the line holding the company name."""

    def check(self, text, domain, guess, expected):
        found = find_company_identity([text], domain, guess)
        self.assertIsNotNone(found)
        self.assertEqual(found.legal_name, expected)

    def test_privacy_notice_before_name(self):
        self.check("Informativa agli Utenti. Titolare del Trattamento dei Dati T-OFF s.r.l. P.IVA 01234567890",
                   "t-off.it", "T-OFF", "T-OFF s.r.l.")

    def test_menu_words_before_name(self):
        self.check("Servizi Azienda Certificazioni News Contatti Effevi s.r.l.",
                   "effevi.net", "effevisrl", "Effevi s.r.l.")

    def test_repeated_menu_brand(self):
        self.check("SIDERLAVORI HOME CONTATTI SIDERLAVORI srl", "siderlavori.it",
                   "Siderlavori", "SIDERLAVORI srl")

    def test_gdpr_form_text_before_name(self):
        self.check("ai sensi del Reg. EU 679/2016 GDPR INVIA IL MESSAGGIO STILMET CARPENTERIE S.r.l.",
                   "stilmet-srl.it", "Stilmet", "STILMET CARPENTERIE S.r.l.")

    def test_policy_title_before_name(self):
        self.check("POLITICA PARITA' DI GENERE TECHNOLOGICA Srl", "technologicasrl.com",
                   "technologicasrl.", "TECHNOLOGICA Srl")

    def test_good_names_unchanged(self):
        self.check("GALBUSERA SERRE S.R.L. P.IVA 01234567890", "serregalbusera.it",
                   "Serre Galbusera", "GALBUSERA SERRE S.R.L.")
        self.check("© Trevigiana Metalli S.r.l.", "trevigianametalli.it",
                   "Trevigiana Metalli", "Trevigiana Metalli S.r.l.")
        self.check("Flli Tiana snc", "tianainfissi.it", "Tianainfissi.it", "Flli Tiana snc")

    def test_too_many_words_is_rejected(self):
        self.assertIsNone(find_company_identity(
            ["Alfa Beta Gamma Delta Epsilon Zeta Eta Rossi S.r.l."], "rossi.it", "Rossi"))


class ButtonWordsBoundaryTest(unittest.TestCase):
    """Second v4 run (13 Nov 2026, 13:48): button/widget words and '?'."""

    check = BoilerplateBoundaryTest.check

    def test_info_link_before_name(self):
        self.check("Info Metal Tech Srls P.IVA 01234567890", "metaltech.srl",
                   "Metal Tech S.r.l.s.", "Metal Tech Srls")

    def test_question_mark_repeats(self):
        self.check("Chi è M.G. Srl? M.G. Srl", "mg-srl.it", "M.G. S.r.l.", "M.G. Srl")

    def test_button_label_before_name(self):
        self.check("Pulsante C.T.L. LAVORAZIONE LAMIERE srl", "ctllavorazionelamiere.it",
                   "C.T.L. Lavorazione Lamiere", "C.T.L. LAVORAZIONE LAMIERE srl")
