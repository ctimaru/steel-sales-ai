"""NET-IT-GROWTH8: official legalName wins only with corroboration and safe names."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.net_it_identity_extract import find_company_identity, legal_name_is_clean
from app.net_it_auto2_reviewer import inspect_candidate


def candidate(name, domain):
    return {
        "id": "00000000-0000-0000-0000-000000017008",
        "company_name": name, "domain": domain,
        "url": f"https://{domain}/", "website_url": f"https://{domain}/",
        "role_keys": ["processor_service_provider"], "quality_flags": [],
    }


def page(body, domain, structured=()):
    return SimpleNamespace(
        url=f"https://{domain}/", text=body, links=(),
        structured_data=structured,
    )


class ContaminatedNameTests(unittest.TestCase):
    def test_real_cms_contaminations_rejected(self):
        for name in (
            "CONTINUA METAL SEBINA SRL",
            "Abruzzo La GLK Srl",
            "SUD FERRO Contrada Cannavà SNC",
            "TERMOFABBRIALLUMINIO Via Carmelia SNC",
            "OFFICINA PORTAS Zona Artigianale Candiatzus SNC",
            "Leggere di più Leghe Leggere Lavorate S.r.l.",
            "Rivista Le Case di Elixir Eolo Srl",
            "Dal 1950 ICOS di Leonelli Marino S.p.A.",
        ):
            with self.subTest(name=name):
                self.assertFalse(legal_name_is_clean(name))

    def test_valid_independent_brands_not_rejected(self):
        for name in (
            "METAL SEBINA SRL", "GLK S.r.l.", "OFFICINA PORTAS SNC",
            "Deama 1989 spa", "Carpenteria Dallago S.r.l.",
            "Via S.r.l.", "Fabbri Zardini Marco e Renzo s.n.c.",
        ):
            with self.subTest(name=name):
                self.assertTrue(legal_name_is_clean(name))

    def test_official_jsonld_corrobated_in_body_outscores_page_noise(self):
        body = "CONTINUA METAL SEBINA SRL. Ragione sociale METAL SEBINA SRL P.IVA 01234567890"
        found = find_company_identity(
            [body], "metalsebina.it", "CONTINUA METAL SEBINA SRL",
            [{"@type": "Organization", "url": "https://metalsebina.it/",
              "legalName": "METAL SEBINA SRL"}])
        self.assertIsNotNone(found)
        self.assertEqual(found.legal_name, "METAL SEBINA SRL")

    def test_jsonld_other_domain_is_not_identity(self):
        self.assertIsNone(find_company_identity(
            ["Acme S.r.l. P.IVA 01234567890"], "otherfabricator.it", "Other Fabricator",
            [{"@type": "Organization", "url": "https://acme.it/",
              "legalName": "Acme S.r.l."}]))

    def test_jsonld_unconfirmed_on_page_is_not_identity(self):
        self.assertIsNone(find_company_identity(
            ["Produzione e carpenteria"], "metalsebina.it", "Metal Sebina",
            [{"@type": "Organization", "url": "https://metalsebina.it/",
              "legalName": "METAL SEBINA SRL"}]))


class Auto2Growth8Review(unittest.IsolatedAsyncioTestCase):
    async def test_dirty_candidate_corrected_from_organization_legalname(self):
        domain = "metalsebina.it"
        body = "CONTINUA METAL SEBINA SRL - Ragione sociale METAL SEBINA SRL P.IVA 01234567890"
        p = page(body, domain, ({"@type": "Organization",
            "url": "https://metalsebina.it/", "legalName": "METAL SEBINA SRL"},))
        with patch("app.net_it_auto2_reviewer._fetch_page", new=AsyncMock(return_value=p)):
            result = await inspect_candidate(None, candidate("CONTINUA METAL SEBINA SRL", domain))
        self.assertEqual(result["p_verdict"], "identity_supported")
        self.assertEqual(result["_identity_correction"]["p_legal_name"], "METAL SEBINA SRL")

    async def test_dirty_candidate_without_separate_proof_remains_on_hold(self):
        domain = "metalsebina.it"
        p = page("CONTINUA METAL SEBINA SRL", domain)
        with patch("app.net_it_auto2_reviewer._fetch_page", new=AsyncMock(return_value=p)):
            result = await inspect_candidate(None, candidate("CONTINUA METAL SEBINA SRL", domain))
        self.assertEqual(result["p_verdict"], "needs_human")
        self.assertIn("legal_name_contaminated", result["p_reasons"])

    async def test_schema_from_external_domain_not_used(self):
        domain = "metalsebina.it"
        p = page("CONTINUA METAL SEBINA SRL", domain,
                ({"@type": "Organization", "url": "https://other.it",
                  "legalName": "METAL SEBINA SRL"},))
        with patch("app.net_it_auto2_reviewer._fetch_page", new=AsyncMock(return_value=p)):
            result = await inspect_candidate(None, candidate("CONTINUA METAL SEBINA SRL", domain))
        self.assertEqual(result["p_verdict"], "needs_human")


if __name__ == "__main__":
    unittest.main()
