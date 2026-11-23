"""MASS11G: false identity from flattened CMS navigation and compliance labels.

Fail closed until the company's own body contains the independently
corroborated legal name. No source rights, status, or publication overrides.
"""
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock, patch

from app.net_it_identity_extract import (
    find_company_identity, publisher_legal_name_is_clean,
)
from app.net_it_auto2_reviewer import inspect_candidate


def _candidate(domain: str, guess: str) -> dict:
    return {
        "id": "00000000-0000-0000-0000-000000119011",
        "company_name": guess,
        "domain": domain,
        "url": f"https://{domain}/",
        "website_url": f"https://{domain}/",
        "role_keys": ["processor_service_provider"],
        "quality_flags": [],
    }


def _page(domain: str, body: str) -> SimpleNamespace:
    return SimpleNamespace(
        url=f"https://{domain}/", text=body, links=(), structured_data=(),
    )


class FirstPartyMenuNoise(TestCase):
    def test_reject_flattened_prefix_not_standalone_brand(self):
        for bad in (
            "Whistleblowing GAMBINI MECCANICA SRL",
            "ENTRA MARE INOX SRL",
            "Da Wikipedia Fratelli Ferri S.r.l.",
        ):
            with self.subTest(name=bad):
                self.assertFalse(publisher_legal_name_is_clean(bad))
        for good in (
            "GAMBINI MECCANICA SRL",
            "MARE INOX SRL",
            "Whistleblowing S.r.l.",
            "Entra S.r.l.",
            "F.lli Ferri S.r.l.",
        ):
            with self.subTest(name=good):
                self.assertTrue(publisher_legal_name_is_clean(good))

    def test_extraction_stops_at_compliance_menu_label(self):
        body = (
            "Privacy Contatti Whistleblowing GAMBINI MECCANICA SRL "
            "P.IVA 01234567890. Sede legale Torino."
        )
        identity = find_company_identity(
            [body], "gambinimeccanica.it",
            "Whistleblowing GAMBINI MECCANICA SRL")
        self.assertIsNotNone(identity)
        self.assertEqual(identity.legal_name, "GAMBINI MECCANICA SRL")

    def test_extraction_stops_at_call_to_action(self):
        body = (
            "Contatti ENTRA MARE INOX SRL P.IVA 01234567890 "
            "Sede legale Italia."
        )
        identity = find_company_identity(
            [body], "mareinox.it", "ENTRA MARE INOX SRL")
        self.assertIsNotNone(identity)
        self.assertEqual(identity.legal_name, "MARE INOX SRL")


class ReviewerStrictProof(IsolatedAsyncioTestCase):
    async def test_bad_prefix_needs_independent_legal_context_to_correct(self):
        domain = "gambinimeccanica.it"
        guessed = "Whistleblowing GAMBINI MECCANICA SRL"
        body = (
            "Contatti Whistleblowing GAMBINI MECCANICA SRL "
            "| Ragione sociale GAMBINI MECCANICA SRL P.IVA 01234567890"
        )
        with patch("app.net_it_auto2_reviewer._fetch_page",
                   new=AsyncMock(return_value=_page(domain, body))):
            finding = await inspect_candidate(None, _candidate(domain, guessed))
        self.assertEqual(finding["p_verdict"], "identity_supported")
        self.assertEqual(finding["p_observed_name"], "GAMBINI MECCANICA SRL")
        self.assertEqual(finding["_identity_correction"]["p_legal_name"],
                         "GAMBINI MECCANICA SRL")
        self.assertNotIn("published", finding)

    async def test_unsupported_company_alias_never_corrected(self):
        domain = "gambinimeccanica.it"
        body = "Whistleblowing GAMBINI MECCANICA SRL Prodotti e servizi"
        with patch("app.net_it_auto2_reviewer._fetch_page",
                   new=AsyncMock(return_value=_page(domain, body))):
            finding = await inspect_candidate(
                None, _candidate(domain, "Whistleblowing GAMBINI MECCANICA SRL"))
        self.assertEqual(finding["p_verdict"], "needs_human")
        self.assertNotIn("_identity_correction", finding)
