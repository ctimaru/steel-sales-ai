"""NET-RESEARCH1: the model proposes, the official pages decide."""
import unittest
from datetime import date

from app.net_research1_extract import (
    band, EMPLOYEE_BANDS, REVENUE_BANDS, clean_page_text, parse_model_json, revenue_from_quote,
    validate_profile,
)

HOME = ("https://www.rossitubi.it/",
        "Rossi Tubi S.r.l. produce tubi saldati e profilati in acciaio al carbonio per l'edilizia "
        "e l'industria meccanica. Taglio laser, piegatura e saldatura robotizzata. "
        "Certificazioni ISO 9001 e EN 1090-1. Esportiamo in Germania e Francia.")
ABOUT = ("https://www.rossitubi.it/azienda",
         "Fondata nel 1978 a Brescia, oggi l'azienda conta 85 dipendenti e due stabilimenti produttivi. "
         "Nel 2024 il fatturato ha raggiunto 18,5 milioni di euro.")
PAGES = [HOME, ABOUT]

GOOD = {
    "summary": "Produttore bresciano di tubi saldati e profilati in acciaio al carbonio, con lavorazioni "
               "di taglio laser, piegatura e saldatura robotizzata per edilizia e meccanica.",
    "activities": ["Taglio laser", "Piegatura", "Saldatura robotizzata"],
    "products": ["Tubi saldati", "Profilati in acciaio", "Travi reticolari"],
    "sectors": ["Edilizia", "Industria meccanica"],
    "markets": ["Germania", "Francia", "Stati Uniti"],
    "certifications": ["ISO 9001", "EN 1090-1", "ISO 14001"],
    "founded_year": {"value": 1978, "quote": "Fondata nel 1978 a Brescia"},
    "employees": {"value": 85, "quote": "oggi l'azienda conta 85 dipendenti"},
    "revenue": {"value": 18500000, "quote": "Nel 2024 il fatturato ha raggiunto 18,5 milioni di euro."},
    "plants": {"value": 2, "quote": "due stabilimenti produttivi"},
}


class ValidateProfileTest(unittest.TestCase):
    def test_supported_facts_are_kept_and_banded(self):
        out = validate_profile(GOOD, PAGES, today=date(2026, 11, 26))
        self.assertEqual(out["outcome"], "researched")
        self.assertIn("summary", out)
        self.assertEqual(out["products"], ["Tubi saldati", "Profilati in acciaio"])  # travi not on the site
        self.assertEqual(out["markets"], ["Germania", "Francia"])
        self.assertEqual(out["certifications"], ["ISO 9001", "EN 1090-1"])  # 14001 not printed
        self.assertEqual(out["founded_year"], 1978)
        self.assertEqual(out["employees_band"], "50-249")
        self.assertEqual((out["revenue_band"], out["revenue_year"]), ("10-50m", 2024))
        self.assertEqual(out["facts"]["revenue"]["url"], "https://www.rossitubi.it/azienda")
        self.assertNotIn("plants_count", out)  # «due» is not a digit in the quote

    def test_invented_quotes_and_numbers_are_dropped(self):
        bad = dict(GOOD, employees={"value": 120, "quote": "oggi l'azienda conta 85 dipendenti"},
                   revenue={"value": 30000000, "quote": "fatturato di 30 milioni"},
                   founded_year={"value": 1965, "quote": "Fondata nel 1978 a Brescia"})
        out = validate_profile(bad, PAGES, today=date(2026, 11, 26))
        for key in ("employees_band", "revenue_band", "founded_year"):
            self.assertNotIn(key, out)

    def test_copied_summary_is_rejected(self):
        copied = dict(GOOD, summary=HOME[1][:300])
        self.assertNotIn("summary", validate_profile(copied, PAGES))

    def test_summary_with_contacts_is_rejected(self):
        noisy = dict(GOOD, summary=GOOD["summary"] + " Scrivete a info@rossitubi.it.")
        self.assertNotIn("summary", validate_profile(noisy, PAGES))

    def test_nothing_supported_is_no_content(self):
        out = validate_profile({"summary": "corto", "products": ["Elicotteri"]}, PAGES)
        self.assertEqual(out["outcome"], "no_content")


class SummaryGuardTest(unittest.TestCase):
    def test_promotional_and_unsupported_sentences_are_removed(self):
        corpus = "fondata nel 1978 a brescia produce tubi saldati"
        from app.net_research1_extract import clean_summary
        text = clean_summary("L'azienda Rossi produce tubi saldati dal 1978. È leader del settore. "
                             "Fondata nel 1965 a Brescia. Garantisce qualità e puntualità.", corpus)
        self.assertEqual(text, "Rossi produce tubi saldati dal 1978.")
        self.assertEqual(clean_summary("Produce tubi saldati. Usa macchine di ultima generazione per "
                                       "garantire massima precisione e qualità.", corpus),
                         "Produce tubi saldati.")


class HelpersTest(unittest.TestCase):
    def test_revenue_from_quote(self):
        self.assertEqual(revenue_from_quote("fatturato 2024 di 18,5 milioni di euro"), 18.5e6)
        self.assertEqual(revenue_from_quote("un fatturato di € 25.000.000"), 25e6)
        self.assertEqual(revenue_from_quote("turnover of EUR 1.2 billion"), 1.2e9)
        self.assertIsNone(revenue_from_quote("fatturato in crescita dal 2019"))
        self.assertIsNone(revenue_from_quote("fatturato in crescita in 10 mesi"))

    def test_bands(self):
        self.assertEqual(band(9, EMPLOYEE_BANDS, "1000+"), "1-9")
        self.assertEqual(band(250, EMPLOYEE_BANDS, "1000+"), "250-999")
        self.assertEqual(band(1500, EMPLOYEE_BANDS, "1000+"), "1000+")
        self.assertEqual(band(2e6, REVENUE_BANDS, "gt250m"), "2-10m")
        self.assertEqual(band(1.9e6, REVENUE_BANDS, "gt250m"), "lt2m")

    def test_page_text_without_contacts(self):
        self.assertEqual(clean_page_text("Scrivi a info@a.it o chiama +39 030 1234567 www.a.it"),
                         "Scrivi a o chiama")

    def test_model_json(self):
        self.assertEqual(parse_model_json('<think>x</think>```json\n{"summary": "a"}\n```'), {"summary": "a"})
        self.assertEqual(parse_model_json("nessun json"), {})


if __name__ == "__main__":
    unittest.main()
