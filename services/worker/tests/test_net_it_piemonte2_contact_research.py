"""NET-IT-PIEMONTE2: bounded source-only contact research regression tests."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.net_it_piemonte2_contact_research import (
    MAX_PAGES, MAX_SITES, first_party_text_localities, inspect_company,
)


def page(text: str, *, url: str = "https://carpenterianord.it/",
         links: tuple[str, ...] = ()):
    return SimpleNamespace(url=url, text=text, links=links,
                           structured_data=(), title=None)


class FirstPartyPostalTextTest(unittest.TestCase):
    def test_explicit_company_contact_address(self):
        rows = first_party_text_localities([
            page("Sede operativa: Via Roma 12, 10100 Torino (TO).")
        ], "carpenterianord.it")
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0].postal_code, rows[0].city, rows[0].province_code),
                         ("10100", "Torino", "TO"))
        self.assertIn("Torino (TO)", rows[0].excerpt)

    def test_foreign_site_cannot_be_a_source(self):
        rows = first_party_text_localities([
            page("Sede Via Roma 12, 10100 Torino (TO)",
                 url="https://unrelated.it/contatti")
        ], "carpenterianord.it")
        self.assertEqual(rows, [])

    def test_marketing_city_without_postal_address_is_not_evidence(self):
        rows = first_party_text_localities([
            page("Costruiamo strutture per 10100 Torino (TO) e tutta Italia.")
        ], "carpenterianord.it")
        self.assertEqual(rows, [])

    def test_email_and_phone_not_copied_as_proof(self):
        rows = first_party_text_localities([
            page("Sede Via Torino 12, 10100 Torino (TO), "
                 "info@carpenterianord.it +39 011 1234567")
        ], "carpenterianord.it")
        self.assertEqual(len(rows), 1)
        self.assertNotIn("info@carpenterianord.it", rows[0].excerpt)
        self.assertNotIn("011 1234567", rows[0].excerpt)

    def test_distinct_factory_cities_are_both_returned_for_exception(self):
        rows = first_party_text_localities([
            page("Sede Via Alba, 1 - 12051 Alba (CN). "
                 "Unità Via Roma, 12 - 12100 Cuneo (CN).")
        ], "carpenterianord.it")
        self.assertEqual(len(rows), 2)

    def test_bounded_pages_and_limit(self):
        self.assertEqual(MAX_PAGES, 4)
        self.assertEqual(MAX_SITES, 10)
        items = [page("Sede Via Roma, 12 - 10100 Torino (TO)")] * 10
        self.assertEqual(len(first_party_text_localities(items, "carpenterianord.it")), 1)


class BrowserContractTest(unittest.IsolatedAsyncioTestCase):
    async def test_site_cannot_escape_its_canonical_domain(self):
        with self.assertRaises(ValueError):
            await inspect_company(None, {
                "domain": "carpenterianord.it", "site": "https://other.it/"
            })

    async def test_only_official_contact_pages_are_researched(self):
        home = page("Lavorazione acciai industriali.",
                    links=("/contatti", "https://unrelated.it/contatti"))
        contact = page("Sede: Via Padana 1, 10040 Givoletto (TO)",
                       url="https://carpenterianord.it/contatti")
        with patch("app.net_it_piemonte2_contact_research._fetch_page",
                   new=AsyncMock(side_effect=[home, contact, None, None])) as fetch:
            result = await inspect_company(None, {
                "domain": "carpenterianord.it",
                "site": "https://carpenterianord.it/"
            })
        self.assertEqual(result["status"], "sourced")
        self.assertEqual(result["city"], "Givoletto")
        self.assertEqual(result["pages"], 2)
        self.assertLessEqual(fetch.await_count, MAX_PAGES)

    async def test_multiple_sites_require_exception_not_arbitrary_choice(self):
        home = page("Sede Via Roma 1 10040 Givoletto (TO). "
                    "Unità Via Genova 2 12100 Cuneo (CN).")
        with patch("app.net_it_piemonte2_contact_research._fetch_page",
                   new=AsyncMock(side_effect=[home, None, None])):
            result = await inspect_company(None, {
                "domain": "carpenterianord.it",
                "site": "https://carpenterianord.it/"
            })
        self.assertEqual(result["status"], "multiple_localities")
        self.assertNotIn("source_url", result)

    async def test_robots_refusal_stops_without_unsafe_fallback(self):
        with patch("app.net_it_piemonte2_contact_research._fetch_page",
                   new=AsyncMock(return_value=None)) as fetch:
            result = await inspect_company(None, {
                "domain": "carpenterianord.it",
                "site": "https://carpenterianord.it/"
            })
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(fetch.await_count, 1)
