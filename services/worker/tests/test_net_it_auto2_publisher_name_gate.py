"""AUTO2 must never support a legal name that AUTO3 will reject.

Production regression corpus: 15 non-discarded IT candidates observed on
21 Nov 2026. These are *untrusted extractor guesses*, not verified identities.
"""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.net_it_auto2_reviewer import inspect_candidate
from app.net_it_identity_extract import publisher_legal_name_is_clean


# One example for each of the 15 still-active identity_supported rows in prod.
# Failed quality is not a license to repair a name without its first-party text.
PENDING_BAD_NAMES = (
    "2024 Metalmeccanica Rossi S.r.l.",
    "lasertech-S.r.l.",
    "2021 Powered by Tramite S.r.l.",
    "2015 . La Bonvini Elettrogalvanica S.r.l.",
    "Ripo. Metal S.r.l.",
    "comet dei f.lli cappello S.r.l.",
    "l'azienda Metal Subiaco Infissi S.n.c.",
    "“EVOLUTION LINE”, Carinci, Dielle, Fontana, Clementi Srl",
    "verniciatura S.r.l.",
    "inossidabile S.n.c.",
    "Contatti Progettazione e produzione Cilindri Oleodinamici e Idraulici Oleodinamica Correggese 80 S.r.l.",
    "in provincia dell'Aquila Palermo Meccanica S.r.l.",
    "2026 BCM Metalmeccanica S.r.l.",
    "musola-metalli-S.r.l.",
    "bolis elettrogalvanica decapaggio lecco elettrogalvanica bolis S.r.l.",
)


class PublisherNameShapeTest(unittest.TestCase):
    def test_all_fifteen_production_blockers_are_rejected(self):
        for name in PENDING_BAD_NAMES:
            with self.subTest(name=name):
                self.assertFalse(publisher_legal_name_is_clean(name))

    def test_genuine_corporate_names_and_internal_year_survive(self):
        for name in (
            "Metalmeccanica Rossi S.r.l.",
            "Bonvini Elettrogalvanica S.r.l.",
            "Lasertech S.r.l.",
            "VITAL SRL",
            "M.G. Srl",
            "Tubi Nord S.n.c.",
            "Rossi & C. S.a.s.",
            "C.M. CARPENTERIA DI CECCON E MORO SAS",
            "Fratelli Rossi di Marco S.n.c.",
            "Officina Ferro 2012 Srl",
            "3M Italia S.r.l.",
        ):
            with self.subTest(name=name):
                self.assertTrue(publisher_legal_name_is_clean(name))

    def test_location_prose_with_di_is_still_rejected(self):
        for name in (
            "Provincia di Torino Meccanica S.r.l.",
            "In provincia di Torino Meccanica S.r.l.",
        ):
            with self.subTest(name=name):
                self.assertFalse(publisher_legal_name_is_clean(name))

    def test_site_builder_credit_is_not_company_legal_identity(self):
        self.assertFalse(publisher_legal_name_is_clean(
            "Powered by Tramite S.r.l."))
        self.assertFalse(publisher_legal_name_is_clean(
            "Contatti Lasertech S.r.l."))


class PublisherPreflightReviewTest(unittest.IsolatedAsyncioTestCase):
    async def _review(self, name, domain, body):
        candidate = {
            "id": "00000000-0000-0000-0000-000000017011",
            "company_name": name,
            "domain": domain,
            "url": f"https://{domain}/",
            "website_url": f"https://{domain}/",
            "role_keys": ["processor_service_provider"],
            "quality_flags": [],
        }
        page = SimpleNamespace(
            url=f"https://{domain}/",
            title="Home",
            site_name=None,
            h1=None,
            text=body,
            links=(),
            structured_data=(),
        )
        with patch("app.net_it_auto2_reviewer._fetch_page",
                   new=AsyncMock(return_value=page)):
            return await inspect_candidate(None, candidate)

    async def test_unrelated_web_agency_cannot_be_supported_or_corrected(self):
        result = await self._review(
            "2021 Powered by Tramite S.r.l.", "tranciaturerimat.it",
            "Tranciature Ri.Mat lavorazioni di metalli. "
            "© 2021 Powered by Tramite S.r.l.")
        self.assertEqual(result["p_verdict"], "needs_human")
        self.assertIn("publisher_legal_name_quality_failed",
                      result["p_reasons"])
        self.assertNotIn("_identity_correction", result)

    async def test_clean_legal_name_with_vat_still_corrects_year_prefix(self):
        result = await self._review(
            "2024 Metalmeccanica Rossi S.r.l.", "metalmeccanicarossi.it",
            "© 2024 Metalmeccanica Rossi S.r.l. "
            "P.IVA 01234567890")
        self.assertEqual(result["p_verdict"], "identity_supported")
        self.assertEqual(result["p_observed_name"],
                         "Metalmeccanica Rossi S.r.l.")
        self.assertEqual(result["_identity_correction"]["p_legal_name"],
                         "Metalmeccanica Rossi S.r.l.")
        self.assertEqual(result["p_rights_state"], "unknown")

    async def test_bad_name_without_independent_corporate_proof_stays_private(self):
        result = await self._review(
            "Ripo. Metal S.r.l.", "ripometal.it",
            "Sito in manutenzione. Ripo. Metal S.r.l.")
        self.assertEqual(result["p_verdict"], "needs_human")
        self.assertIn("publisher_legal_name_quality_failed",
                      result["p_reasons"])
        self.assertNotIn("_identity_correction", result)

    async def test_legitimate_name_is_supported_without_new_approval(self):
        result = await self._review(
            "Officina Ferro 2012 Srl", "officinaferro2012.it",
            "Officina Ferro 2012 Srl - Lavorazione acciaio.")
        self.assertEqual(result["p_verdict"], "identity_supported")
        self.assertNotIn("_identity_correction", result)
        self.assertEqual(result["p_rights_state"], "unknown")

    async def test_di_sas_legal_identity_is_supported_only_on_first_party(self):
        name = "C.M. CARPENTERIA DI CECCON E MORO SAS"
        result = await self._review(
            name,
            "cmcarpenteria.com",
            "Sede legale: C.M. CARPENTERIA DI CECCON E MORO SAS - "
            "Partita IVA: 03423250269. Taglio laser tubo e carpenteria.")
        self.assertEqual(result["p_verdict"], "identity_supported")
        self.assertEqual(result["p_observed_name"], name)
        self.assertNotIn("publisher_legal_name_quality_failed",
                         result["p_reasons"])
        self.assertNotIn("_identity_correction", result)



if __name__ == "__main__":
    unittest.main()
