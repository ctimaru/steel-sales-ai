"""NET-PROFILE-DATA2: a model verdict can NEVER replace source grounding."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.company_discovery import CompanyDiscoveryError
from app.net_profile_data2_reviewer import (
    VERSION, claim_values, trusted_source, canonical_text,
    review_candidate, reason_result, _parse_model_output,
)


def candidate(**kwargs):
    data = {
        "evidence_id": "00000000-0000-0000-0000-000000006001",
        "company_id": "00000000-0000-0000-0000-000000006002",
        "company_name": "Acciai Demo S.p.A.",
        "website_domain": "acciaidemo.it",
        "website_url": "https://www.acciaidemo.it/",
        "evidence_url": "https://acciaidemo.it/prodotti/",
        "field_key": "products",
        "field_value": ["Tubi senza saldatura", "Profilati cavi"],
    }
    data.update(kwargs)
    return data


def page(text, url="https://acciaidemo.it/prodotti/"):
    return SimpleNamespace(url=url, text=text, links=())


CONTENT = (
    "Acciai Demo S.p.A. è un commerciante di acciai. "
    "Commercializziamo Tubi senza saldatura e Profilati cavi "
    "per le industrie metalmeccaniche. Catalogo e servizi."
)


class GateTests(unittest.TestCase):
    def test_same_domain_https_only(self):
        self.assertEqual(trusted_source(candidate())[1], "acciaidemo.it")
        for overrides in (
            {"evidence_url": "https://other.it/prodotti"},
            {"website_url": "http://acciaidemo.it"},
            {"website_domain": "linkedin.com"},
            {"evidence_url": "https://127.0.0.1/internal"},
            {"evidence_url": "https://acciaidemo.it:8080/admin"},
        ):
            with self.subTest(overrides=overrides), self.assertRaises(
                    (ValueError, KeyError, TypeError, CompanyDiscoveryError)):
                trusted_source(candidate(**overrides))

    def test_field_values_fail_closed(self):
        self.assertEqual(len(claim_values(candidate())), 2)
        for data in (
            {"field_key": "industry"},
            {"field_key": "products", "field_value": ["Profilato in stock"]},
            {"field_key": "services", "field_value": ["Prezzo € 999"]},
            {"field_key": "products", "field_value": ["certificato CE"]},
            {"field_key": "products", "field_value": [42]},
            {"field_key": "products", "field_value": {"grade": "S355"}},
            {"field_key": "products", "field_value": ["x"] * 9},
        ):
            self.assertIsNone(claim_values(candidate(**data)))

    def test_output_untrusted_and_schema_strict(self):
        self.assertEqual(
            _parse_model_output('{"supported":true,"quote":"Acciai Demo S.p.A."}')["supported"],
            True,
        )
        with self.assertRaises(ValueError):
            _parse_model_output("supported yes")
        self.assertEqual(canonical_text(" TubI  senza   saldatura "), "tubi senza saldatura")
        finding = reason_result(candidate(), "needs_review", "unverified")
        self.assertEqual(finding["p_model_name"], "none")
        self.assertFalse(finding["p_reason_codes"] == [])
        self.assertEqual(VERSION, "net-profile-data2-v1")


class SourceReviewerTests(unittest.IsolatedAsyncioTestCase):
    async def _review(self, row=None, text=CONTENT, model_result=None, url=None):
        model_result = model_result if model_result is not None else {
            "supported": True,
            "quote": "Commercializziamo Tubi senza saldatura e Profilati cavi",
        }
        with patch("app.net_profile_data2_reviewer._fetch_page",
                   new=AsyncMock(return_value=page(text, url or "https://acciaidemo.it/prodotti/"))):
            with patch("app.net_profile_data2_reviewer._ai_check",
                       return_value=model_result):
                return await review_candidate(None, row or candidate(),
                                              token="dummy", model="verified-test-model")

    async def test_grounded_ai_plus_exact_source_accepts(self):
        finding = await self._review()
        self.assertEqual(finding["p_verdict"], "supported")
        self.assertEqual(finding["p_confidence"], 0.975)
        self.assertEqual(finding["p_reason_codes"], [])
        self.assertEqual(len(finding["p_source_sha256"]), 64)
        self.assertNotIn("verified", finding)

    async def test_model_claim_without_exact_quote_does_not_accept(self):
        finding = await self._review(model_result={
            "supported": True, "quote": "Una frase inventata dall'AI"})
        self.assertEqual(finding["p_verdict"], "needs_review")
        self.assertEqual(finding["p_reason_codes"], ["ai_grounding_not_sufficient"])

    async def test_model_false_does_not_accept(self):
        finding = await self._review(model_result={
            "supported": False, "quote": "Commercializziamo Tubi senza saldatura"})
        self.assertEqual(finding["p_verdict"], "needs_review")

    async def test_quoted_but_not_actual_product_is_not_accepted(self):
        finding = await self._review(text=(
            "Acciai Demo S.p.A. fornisce soltanto Profilati cavi. "
            "Non trattiamo tubi lavorati."
        ))
        self.assertEqual(finding["p_verdict"], "needs_review")
        self.assertIn("claimed_text_not_exactly_supported", finding["p_reason_codes"])

    async def test_other_company_name_rejected(self):
        finding = await self._review(text=(
            "Acciai diversi S.r.l. vende Tubi senza saldatura e Profilati cavi."
        ))
        self.assertEqual(finding["p_verdict"], "needs_review")
        self.assertIn("legal_company_name_not_found", finding["p_reason_codes"])

    async def test_legal_name_on_official_homepage_can_support_product_page(self):
        product = page("Vendiamo Tubi senza saldatura e Profilati cavi.")
        home = page("Acciai Demo S.p.A. - sede e contatti ufficiali.",
                    url="https://www.acciaidemo.it/")
        with patch("app.net_profile_data2_reviewer._fetch_page",
                   new=AsyncMock(side_effect=[product,home])) as fetch:
            with patch("app.net_profile_data2_reviewer._ai_check",
                       return_value={
                         "supported":True,
                         "quote":"Vendiamo Tubi senza saldatura e Profilati cavi."
                       }):
                finding=await review_candidate(None,candidate(),
                                               token="dummy",model="verified-test-model")
        self.assertEqual(finding["p_verdict"],"supported")
        self.assertEqual(fetch.await_count,2)

    async def test_explicit_reuse_ban_blocks(self):
        finding = await self._review(text=CONTENT + " Vietato il riutilizzo dei dati.")
        self.assertEqual(finding["p_verdict"], "blocked")

    async def test_outside_domain_redirect_rejected(self):
        finding = await self._review(url="https://phishing.invalid/prodotti/")
        self.assertEqual(finding["p_verdict"], "blocked")

    async def test_missing_model_fails_closed(self):
        with patch("app.net_profile_data2_reviewer._fetch_page",
                   new=AsyncMock(return_value=page(CONTENT))):
            finding = await review_candidate(None, candidate(), token="", model="ai-model")
        self.assertEqual(finding["p_verdict"], "needs_review")
        self.assertIn("ai_token_not_configured", finding["p_reason_codes"])

    async def test_robots_denial_fails_closed(self):
        with patch("app.net_profile_data2_reviewer._fetch_page",
                   new=AsyncMock(return_value=None)):
            finding = await review_candidate(None, candidate(), token="dummy", model="ai-model")
        self.assertEqual(finding["p_verdict"], "needs_review")
        self.assertIn("robots_or_unavailable", finding["p_reason_codes"])


if __name__ == "__main__":
    unittest.main()
