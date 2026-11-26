"""NET-RESEARCH1: only the company's own pages, checked before recording."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.net_research1_pipeline import model_input, research_company, research_links

COMPANY = {"id": "00000000-0000-0000-0000-0000000e0001", "website_url": "https://www.rossitubi.it/",
           "domain": "rossitubi.it", "name": "Rossi Tubi"}
HOME_TEXT = ("Rossi Tubi S.r.l. produce tubi saldati e profilati in acciaio al carbonio per l'edilizia. "
             "Taglio laser e saldatura. Certificazione ISO 9001. Scrivi a info@rossitubi.it. ") * 3


def page(text, url="https://www.rossitubi.it/", links=()):
    return SimpleNamespace(url=url, text=text, links=links)


class FakeReader:
    model = "test-model"

    def __init__(self, answer):
        self.answer, self.seen = answer, None

    async def read(self, text):
        self.seen = text
        return self.answer


class PipelineTest(unittest.IsolatedAsyncioTestCase):
    def test_links_rank_company_pages_first_and_stay_on_domain(self):
        home = page("", links=("/contatti", "/chi-siamo", "https://altro.it/azienda", "/blog/post", "/prodotti"))
        self.assertEqual(research_links(home, "rossitubi.it"),
                         ["https://www.rossitubi.it/chi-siamo", "https://www.rossitubi.it/prodotti",
                          "https://www.rossitubi.it/contatti"])

    def test_model_never_sees_contacts(self):
        text = model_input(COMPANY, [("https://www.rossitubi.it/", HOME_TEXT)])
        self.assertNotIn("info@rossitubi.it", text)

    async def test_checked_profile_with_sources(self):
        reader = FakeReader({"summary": "Azienda che realizza tubi saldati e profilati in acciaio al carbonio "
                                        "per il settore edile, con taglio laser e saldatura interni.",
                             "products": ["Tubi saldati", "Lamiere"], "certifications": ["ISO 9001"],
                             "revenue": {"value": 5e6, "quote": "fatturato di 5 milioni"}})
        with patch("app.net_research1_pipeline._fetch_page", new=AsyncMock(return_value=page(HOME_TEXT))):
            outcome, profile = await research_company(None, reader, COMPANY)
        self.assertEqual(outcome, "researched")
        self.assertEqual(profile["products"], ["Tubi saldati"])
        self.assertNotIn("revenue_band", profile)
        self.assertEqual(profile["source_urls"], ["https://www.rossitubi.it/"])
        self.assertEqual(profile["model"], "test-model")

    async def test_unreadable_site(self):
        with patch("app.net_research1_pipeline._fetch_page", new=AsyncMock(return_value=None)):
            outcome, _ = await research_company(None, FakeReader({}), COMPANY)
        self.assertEqual(outcome, "no_content")


if __name__ == "__main__":
    unittest.main()
