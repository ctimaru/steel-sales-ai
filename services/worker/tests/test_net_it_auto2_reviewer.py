"""NET-IT-AUTO2 test: machine review must never forge human approval."""
import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.net_it_auto2_reviewer import (
    _is_capital_company,_name_evidenced,_validate_official_website,inspect_candidate,review_batch,
    MAX_BATCH,VERSION,
)


def row(name="Carpenteria Test S.r.l.", domain="carpenteriatest.it", **changes):
    data={
      "id":"00000000-0000-0000-0000-000000017001",
      "company_name":name,"domain":domain,
      "url":f"https://{domain}/chi-siamo",
      "website_url":f"https://{domain}/",
      "role_keys":["processor_service_provider"],
      "quality_flags":[],
    }
    data.update(changes)
    return data


def page(text, url="https://carpenteriatest.it/chi-siamo"):
    return SimpleNamespace(url=url,title="Carpenteria Test",site_name="Carpenteria Test",
                           h1="Carpenteria Test",text=text,links=())


class FirstPartyReviewTest(unittest.TestCase):
    def test_name_exact_but_not_partial(self):
        self.assertTrue(_name_evidenced("Carpenteria Test S.r.l.",
                 ["Benvenuti in Carpenteria Test S.r.l., lavorazioni industriali"]))
        self.assertFalse(_name_evidenced("Carpenteria Test S.r.l.",
                 ["Altra Carpenteria Industriale S.r.l."]))
        self.assertFalse(_name_evidenced("AB",["AB costruzioni"]))
    def test_brand_without_legal_form_cannot_verify_srl(self):
        self.assertFalse(_name_evidenced("Carpenteria Test S.r.l.",
                         ["Carpenteria Test costruzioni e lavorazioni industriali"]))
        self.assertTrue(_name_evidenced("Carpenteria Test S.r.l.",
                         ["Carpenteria Test SRL costruzioni e lavorazioni industriali"]))

    def test_only_capital_companies_as_whole_token(self):
        for name in ("Carpenteria Test S.r.l.","Tubi Nord SPA","Officina Uno s.r.l.s.",
                     "Acciai Due S. p. A."):
            self.assertTrue(_is_capital_company(name),name)
        for name in ("Officine Gasparini","Carpenteria Bianchi Simone & C. S.n.c.",
                     "Valle S.a.s.","Spada Lavorazioni","Officina Casrl"):
            self.assertFalse(_is_capital_company(name),name)

    def test_url_domain_is_canonical_and_https(self):
        self.assertEqual(_validate_official_website(row())[1],"carpenteriatest.it")
        with self.assertRaises(ValueError):
            _validate_official_website(row(url="https://other.it/carpenteria"))
        with self.assertRaises(ValueError):
            _validate_official_website(row(url="http://carpenteriatest.it/"))
        with self.assertRaises(ValueError):
            _validate_official_website(row(domain="linkedin.com"))
    def test_version_and_batch_caps(self):
        self.assertEqual(VERSION,"net-it-auto2-firstparty-v2")
        self.assertEqual(MAX_BATCH,50)


class SourceReviewTest(unittest.IsolatedAsyncioTestCase):
    async def test_first_party_evidence_can_only_support_identity(self):
        with patch("app.net_it_auto2_reviewer._fetch_page",
                  new=AsyncMock(return_value=page(
                    "Carpenteria Test S.r.l. Costruzioni metalliche industriali."))):
            outcome=await inspect_candidate(None,row())
        self.assertEqual(outcome["p_verdict"],"identity_supported")
        self.assertEqual(outcome["p_rights_state"],"unknown")
        self.assertTrue(outcome["p_matched_name"])
        self.assertEqual(len(outcome["p_hash"]),64)
        self.assertNotIn("p_approved",outcome)
        self.assertNotIn("p_commit",outcome)

    async def test_legacy_identity_hold_cleared_only_by_first_party_name(self):
        # v2: the legacy flag asks for exactly this check; it is not a reason by itself.
        with patch("app.net_it_auto2_reviewer._fetch_page",
                  new=AsyncMock(return_value=page("Carpenteria Test S.r.l."))):
            outcome=await inspect_candidate(None,row(
                  quality_flags=["legal_identity_not_verified"]))
        self.assertEqual(outcome["p_verdict"],"identity_supported")
        self.assertEqual(outcome["p_reviewer_version"],"net-it-auto2-firstparty-v2")
        with patch("app.net_it_auto2_reviewer._fetch_page",
                  new=AsyncMock(return_value=page("Carpenteria Test costruzioni"))):
            outcome=await inspect_candidate(None,row(
                  quality_flags=["legal_identity_not_verified"]))
        self.assertEqual(outcome["p_verdict"],"needs_human")
        self.assertIn("corporate_name_not_evidenced",outcome["p_reasons"])

    async def test_sole_trader_context_still_human_exception(self):
        with patch("app.net_it_auto2_reviewer._fetch_page",
                  new=AsyncMock(return_value=page("Carpenteria Test S.r.l."))):
            outcome=await inspect_candidate(None,row(
                  quality_flags=["legal_identity_not_verified","historical_sole_trader_vat_context"]))
        self.assertEqual(outcome["p_verdict"],"needs_human")
        self.assertIn("sole_trader_identity_exception",outcome["p_reasons"])

    async def test_name_found_on_contact_page_not_home(self):
        home=SimpleNamespace(url="https://carpenteriatest.it/",title="Home",site_name=None,h1=None,
            text="Benvenuti, costruzioni metalliche.",
            links=("/prodotti","/contatti","https://altro.it/privacy","/blog/news"))
        contact=page("Carpenteria Test S.r.l. - P.IVA 01234567890",url="https://carpenteriatest.it/contatti")
        prodotti=page("Tubi e lamiere",url="https://carpenteriatest.it/prodotti")
        fetched=[]
        async def fake_fetch(client,url,base):
            fetched.append(url)
            return {"https://carpenteriatest.it/chi-siamo":home,
                    "https://carpenteriatest.it/contatti":contact,
                    "https://carpenteriatest.it/prodotti":prodotti}.get(url)
        with patch("app.net_it_auto2_reviewer._fetch_page",new=fake_fetch):
            outcome=await inspect_candidate(None,row())
        self.assertEqual(outcome["p_verdict"],"identity_supported")
        # legal/contact page is read before product pages; other domains never.
        self.assertEqual(fetched[1],"https://carpenteriatest.it/contatti")
        self.assertNotIn("https://altro.it/privacy",fetched)
        self.assertNotIn("https://carpenteriatest.it/blog/news",fetched)

    async def test_footer_beyond_18000_chars_is_read(self):
        text=("lavorazioni " * 1700)+" Carpenteria Test S.r.l. P.IVA 01234567890"
        self.assertGreater(text.index("Carpenteria Test S.r.l."),18000)
        with patch("app.net_it_auto2_reviewer._fetch_page",
                  new=AsyncMock(return_value=page(text))):
            outcome=await inspect_candidate(None,row())
        self.assertEqual(outcome["p_verdict"],"identity_supported")

    async def test_explicit_reuse_restriction_blocks(self):
        with patch("app.net_it_auto2_reviewer._fetch_page",
                  new=AsyncMock(return_value=page(
                    "Carpenteria Test S.r.l. È vietato il riutilizzo dei dati."))):
            outcome=await inspect_candidate(None,row())
        self.assertEqual(outcome["p_verdict"],"blocked")
        self.assertEqual(outcome["p_rights_state"],"restricts_reuse")

    async def test_partnership_with_person_name_stays_human_exception(self):
        name="Carpenteria Bianchi Simone & C. S.n.c."
        with patch("app.net_it_auto2_reviewer._fetch_page",
                  new=AsyncMock(return_value=page(f"{name} lavorazioni"))):
            outcome=await inspect_candidate(None,row(name=name))
        self.assertEqual(outcome["p_verdict"],"needs_human")
        self.assertIn("legal_form_requires_human_review",outcome["p_reasons"])

    async def test_robot_denial_fails_closed(self):
        with patch("app.net_it_auto2_reviewer._fetch_page",new=AsyncMock(return_value=None)):
            outcome=await inspect_candidate(None,row())
        self.assertEqual(outcome["p_verdict"],"needs_human")
        self.assertIn("robots_blocked_or_unavailable",outcome["p_reasons"])

    async def test_name_mismatch_fails_closed(self):
        with patch("app.net_it_auto2_reviewer._fetch_page",
                  new=AsyncMock(return_value=page(
                    "Società completamente differente S.r.l."))):
            outcome=await inspect_candidate(None,row())
        self.assertEqual(outcome["p_verdict"],"needs_human")

    async def test_duplicate_candidate_rejected_before_fetch(self):
        with self.assertRaises(ValueError):
            await review_batch([row(),row()],pause_seconds=0)

if __name__=="__main__":
    unittest.main()
