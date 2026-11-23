"""MASS11C name-recovery regressions from real Italian first-party patterns.

No network/database access; tests deliberately distinguish evidence from
publication permission. Existing AUTO2 + AUTO3 + source-rights gates remain.
"""
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock, patch

from app.net_it_identity_extract import (
    find_company_identity, legal_name_is_clean, publisher_legal_name_is_clean,
)
from app.net_it_auto2_reviewer import _name_evidenced, inspect_candidate


def candidate(domain: str, legal_name: str) -> dict:
    return {
        "id": "00000000-0000-0000-0000-000000111231",
        "company_name": legal_name, "domain": domain,
        "url": f"https://{domain}/",
        "website_url": f"https://{domain}/",
        "role_keys": ["processor_service_provider"],
        "quality_flags": [],
    }


def page(domain: str, body: str):
    return SimpleNamespace(url=f"https://{domain}/", text=body,
                           links=(), structured_data=())


class LegalNameExtractionRegression(TestCase):
    def test_alinox_country_breadcrumb_is_not_part_of_legal_name(self):
        body = ("Via Valpantena, 61/D - 37142 Verona - Italy "
                "ALINOX VERONA S.r.l. | PEC azienda@pec.it | "
                "Cod. Fisc. e P. Iva IT 03087060236")
        found = find_company_identity([body], "alinoxverona.it",
                                      "Italy ALINOX VERONA S.r.l.")
        self.assertIsNotNone(found)
        self.assertEqual(found.legal_name, "ALINOX VERONA S.r.l.")

    def test_footer_button_not_part_of_company_name(self):
        body = (
            "Read More Lavorazioni Carpenteria Galli s.r.l. "
            "Carpenteria Galli s.r.l. | Ragione sociale "
            "Carpenteria Galli s.r.l. P.IVA 01234567890"
        )
        found = find_company_identity([body], "carpenteriagalli.it",
                                      "Read More Lavorazioni Carpenteria Galli s.r.l.")
        self.assertIsNotNone(found)
        self.assertEqual(found.legal_name, "Carpenteria Galli s.r.l.")

    def test_publisher_holds_real_cms_contaminations(self):
        invalid_names = [
            "Italy ALINOX VERONA S.r.l.",
            "Read More Lavorazioni Carpenteria Galli s.r.l.",
            "2M Carpenteria Metallica Treviso 2M S.n.c.",
        ]
        for name in invalid_names:
            with self.subTest(name=name):
                self.assertFalse(publisher_legal_name_is_clean(name))
        self.assertFalse(legal_name_is_clean(invalid_names[0]))
        self.assertFalse(legal_name_is_clean(invalid_names[1]))

    def test_valid_names_and_brand_more_are_preserved(self):
        for name in ("ALINOX VERONA S.r.l.", "Carpenteria Galli s.r.l.",
                     "More S.r.l.", "Nuova Officina Metallurgica S.r.l."):
            with self.subTest(name=name):
                self.assertTrue(publisher_legal_name_is_clean(name))

    def test_truncated_partnership_identity_is_not_full_name_proof(self):
        self.assertFalse(_name_evidenced(
            "2M S.N.C.",
            ["2M S.N.C. di Alfred e Denis Murer C.F. e P.I. 03104030261"],
        ))
        self.assertTrue(_name_evidenced(
            "2M S.N.C.",
            ["2M S.N.C. | P.IVA 03104030261 | carpenteria metallica"],
        ))


class Auto2ReviewRegression(IsolatedAsyncioTestCase):
    async def test_alinox_correction_requires_corporate_proof(self):
        domain = "alinoxverona.it"
        body = ("Dove la saldatura diventa arte. "
                "Via Valpantena Verona Italy ALINOX VERONA S.r.l. "
                "| Cod. Fisc. e P. Iva IT 03087060236")
        with patch("app.net_it_auto2_reviewer._fetch_page",
                   new=AsyncMock(return_value=page(domain, body))):
            result = await inspect_candidate(
                None, candidate(domain, "Italy ALINOX VERONA S.r.l."))
        self.assertEqual(result["p_verdict"], "identity_supported")
        self.assertEqual(result["p_observed_name"], "ALINOX VERONA S.r.l.")
        self.assertEqual(result["_identity_correction"]["p_legal_name"],
                         "ALINOX VERONA S.r.l.")
        self.assertNotIn("p_approved", result)
        self.assertNotIn("p_publish", result)

    async def test_galli_recovery_uses_clean_first_party_name(self):
        domain = "carpenteriagalli.it"
        body = ("Read More Lavorazioni Carpenteria Galli s.r.l. "
                "Carpenteria Galli s.r.l. | Ragione sociale "
                "Carpenteria Galli s.r.l. P.IVA 01234567890")
        with patch("app.net_it_auto2_reviewer._fetch_page",
                   new=AsyncMock(return_value=page(domain, body))):
            result = await inspect_candidate(
                None, candidate(domain,
                                "Read More Lavorazioni Carpenteria Galli s.r.l."))
        self.assertEqual(result["p_verdict"], "identity_supported")
        self.assertEqual(result["p_observed_name"], "Carpenteria Galli s.r.l.")
        self.assertIn("_identity_correction", result)

    async def test_2m_full_snc_di_partner_names_stay_on_hold(self):
        domain = "2mcarpenteria.com"
        body = ("2M S.N.C. di Alfred e Denis Murer "
                "C.F. e P.I. 03104030261. Carpenteria industriale.")
        with patch("app.net_it_auto2_reviewer._fetch_page",
                   new=AsyncMock(return_value=page(domain, body))):
            result = await inspect_candidate(
                None, candidate(domain,
                    "2M Carpenteria Metallica Treviso 2M S.n.c."))
        self.assertEqual(result["p_verdict"], "needs_human")
        self.assertNotIn("_identity_correction", result)

    async def test_agency_or_no_legal_name_never_become_supported(self):
        domain = "carpenteriaesempio.it"
        body = ("Carpenteria Esempio. Sito powered by "
                "More Designs S.r.l. No legal identity published.")
        with patch("app.net_it_auto2_reviewer._fetch_page",
                   new=AsyncMock(return_value=page(domain, body))):
            result = await inspect_candidate(
                None, candidate(domain, "Carpenteria Esempio"))
        self.assertEqual(result["p_verdict"], "needs_human")
        self.assertNotIn("_identity_correction", result)
