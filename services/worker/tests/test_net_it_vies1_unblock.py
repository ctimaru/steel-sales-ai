"""NET-IT-VIES1: candidate identity from first-party P.IVA + VIES, steel link from the site."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.net_it_vies1_unblock import (
    MAX_VIES_UNAVAILABLE, ViesGate, examine, format_legal_name, identity_matches, legal_form_key,
    steel_terms,
)


def candidate(**changes):
    data = {"id": "00000000-0000-0000-0000-0000000b1001", "domain": "rossitubi.it",
            "website_url": "https://www.rossitubi.it/", "name": "Rossi Tubi"}
    data.update(changes)
    return data


def page(text, url="https://www.rossitubi.it/", links=()):
    return SimpleNamespace(url=url, text=text, links=links)


class FakeVies:
    def __init__(self, answer):
        self.answer, self.calls = answer, 0

    async def check(self, vat, name):
        self.calls += 1
        return self.answer


VALID = {"status": "valid", "registered_name": "ROSSI TUBI S.R.L.", "name_match": "match"}


class HelpersTest(unittest.TestCase):
    def test_legal_form_from_vies_name(self):
        self.assertEqual(legal_form_key("ROSSI TUBI S.R.L."), "srl")
        self.assertEqual(legal_form_key("ACME SRLS"), "srls")
        self.assertEqual(legal_form_key("BIANCHI MARIO & C. S.A.S."), "sas")
        self.assertIsNone(legal_form_key("ROSSI MARIO"))  # ditta individuale
        self.assertIsNone(legal_form_key("SRLTUBI COOPERATIVA"))

    def test_display_name(self):
        self.assertEqual(format_legal_name("ROSSI TUBI S.R.L.", "Rossi Tubi"), "Rossi Tubi S.r.l.")
        self.assertEqual(format_legal_name("ACME INOX SPA UNIPERSONALE", ""), "Acme Inox S.p.A.")
        self.assertEqual(format_legal_name("C.B.A. METALLI SRL", ""), "C.B.A. Metalli S.r.l.")
        self.assertEqual(format_legal_name("F.LLI VERDI SNC", ""), "F.lli Verdi S.n.c.")
        self.assertEqual(format_legal_name("METALTECH SRL", "MetalTech"), "MetalTech S.r.l.")
        self.assertEqual(format_legal_name("ROSSI MARIO", ""), "")

    def test_identity_by_name_or_domain(self):
        self.assertTrue(identity_matches("Rossi Tubi", "rossitubi.it", "ROSSI TUBI S.R.L."))
        self.assertTrue(identity_matches("Home", "carpenteriabianchi.it", "CARPENTERIA BIANCHI SRL"))
        self.assertFalse(identity_matches("Rossi Tubi", "rossitubi.it", "WEB AGENCY CREATIVA SRL"))

    def test_steel_terms(self):
        self.assertEqual(steel_terms(["Lavorazione lamiere e tubi in acciaio inox"]),
                         ["lamiere", "tubi", "acciaio", "inox"])
        self.assertEqual(steel_terms(["Ristorante e catering per eventi"]), [])
        self.assertEqual(steel_terms(["Ferrovia e cancelleria"]), [])


class ExamineTest(unittest.IsolatedAsyncioTestCase):
    async def run_examine(self, pages, vies_answer=VALID, **changes):
        vies = FakeVies(vies_answer)
        with patch("app.net_it_vies1_unblock._fetch_page", new=AsyncMock(side_effect=pages)), \
                patch("app.net_it_vies1_unblock._identity_links", return_value=[]), \
                patch("app.net_it_vies1_unblock.research_links", return_value=[]):
            return await examine(None, vies, candidate(**changes)), vies

    async def test_verified_identity(self):
        result, _ = await self.run_examine([page("Tubi in acciaio. P.IVA 02194750234")])
        self.assertEqual(result["outcome"], "verified")
        self.assertEqual(result["vat"], "02194750234")
        self.assertEqual(result["legal_name"], "Rossi Tubi S.r.l.")
        self.assertEqual(result["page_url"], "https://www.rossitubi.it/")
        self.assertIn("acciaio", result["steel_terms"])
        self.assertRegex(result["page_hash"], r"^[a-f0-9]{64}$")

    async def test_sole_trader_is_excluded(self):
        answer = {"status": "valid", "registered_name": "ROSSI MARIO", "name_match": "unknown"}
        result, _ = await self.run_examine([page("Tubi in acciaio. P.IVA 02194750234")], answer)
        self.assertEqual(result["outcome"], "sole_trader_or_no_legal_form")
        self.assertNotIn("vies_name", result)  # a person's name is never stored

    async def test_company_in_liquidation_is_excluded(self):
        answer = {"status": "valid", "registered_name": "ROSSI TUBI SRL IN LIQUIDAZIONE"}
        result, _ = await self.run_examine([page("Tubi in acciaio. P.IVA 02194750234")], answer)
        self.assertEqual(result["outcome"], "in_liquidation")

    async def test_other_holder_is_a_mismatch(self):
        answer = {"status": "valid", "registered_name": "STUDIO GRAFICO ALFA SRL"}
        result, _ = await self.run_examine([page("Tubi in acciaio. P.IVA 02194750234")], answer)
        self.assertEqual(result["outcome"], "vies_name_mismatch")

    async def test_no_steel_link(self):
        result, _ = await self.run_examine([page("Catering per eventi. P.IVA 02194750234")])
        self.assertEqual(result["outcome"], "no_steel_link")

    async def test_no_vat_means_no_vies_call(self):
        result, vies = await self.run_examine([page("Tubi in acciaio, contattaci")])
        self.assertEqual(result, {"outcome": "no_vat_on_site"})
        self.assertEqual(vies.calls, 0)

    async def test_agency_credit_vat_is_ignored(self):
        result, _ = await self.run_examine([page("Tubi in acciaio. Realizzato da Web Agency P.IVA 02194750234")])
        self.assertEqual(result["outcome"], "no_vat_on_site")

    async def test_redirect_off_domain_is_unreachable(self):
        result, _ = await self.run_examine([page("P.IVA 02194750234", url="https://altro.it/")])
        self.assertEqual(result, {"outcome": "site_unreachable"})

    async def test_reuse_restriction_stops(self):
        result, _ = await self.run_examine(
            [page("Tubi in acciaio. È vietata la riproduzione dei contenuti. P.IVA 02194750234")])
        self.assertEqual(result, {"outcome": "reuse_restricted"})

    async def test_vies_unavailable(self):
        result, _ = await self.run_examine([page("Tubi in acciaio. P.IVA 02194750234")],
                                           {"status": "unavailable"})
        self.assertEqual(result["outcome"], "vies_unavailable")


class ViesGateTest(unittest.IsolatedAsyncioTestCase):
    async def test_stops_after_repeated_unavailability(self):
        with patch("app.net_it_vies1_unblock.check_vat",
                   new=AsyncMock(return_value={"status": "unavailable"})) as check:
            gate = ViesGate(None, pause=0)
            for _ in range(MAX_VIES_UNAVAILABLE + 3):
                await gate.check("02194750234", "Rossi")
        self.assertTrue(gate.closed)
        self.assertEqual(check.await_count, MAX_VIES_UNAVAILABLE)


if __name__ == "__main__":
    unittest.main()
