"""NET-VAT1 fase 2: official-site P.IVA collection, one outcome per company."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.net_vat1_collector import MAX_BATCH, scan_company


def company(domain="rossitubi.it", **changes):
    data = {"id": "00000000-0000-0000-0000-0000000a7001", "domain": domain,
            "website_url": f"https://www.{domain}/", "legal_name": "Rossi Tubi S.r.l."}
    data.update(changes)
    return data


def page(text, url="https://www.rossitubi.it/", links=()):
    return SimpleNamespace(url=url, text=text, links=links)


class ScanCompanyTest(unittest.IsolatedAsyncioTestCase):
    async def test_footer_vat_on_official_page(self):
        home = page("Tubi saldati. © Rossi Tubi S.r.l. P.IVA 02194750234")
        with patch("app.net_vat1_collector._fetch_page", new=AsyncMock(return_value=home)):
            result = await scan_company(None, company())
        self.assertEqual(result, {"outcome": "found", "vat": "02194750234",
                                  "page_url": "https://www.rossitubi.it/"})

    async def test_legal_page_is_read_when_home_has_no_vat(self):
        home = page("Tubi saldati", links=("/note-legali",))
        legal = page("Rossi Tubi S.r.l. - Partita IVA 02194750234",
                     url="https://www.rossitubi.it/note-legali")
        with patch("app.net_vat1_collector._fetch_page", new=AsyncMock(side_effect=[home, legal])):
            result = await scan_company(None, company())
        self.assertEqual(result["page_url"], "https://www.rossitubi.it/note-legali")

    async def test_redirect_to_another_domain_is_not_official(self):
        with patch("app.net_vat1_collector._fetch_page",
                   new=AsyncMock(return_value=page("P.IVA 02194750234", url="https://altro.it/"))):
            result = await scan_company(None, company())
        self.assertEqual(result, {"outcome": "unreachable"})

    async def test_http_only_site_is_not_scanned(self):
        result = await scan_company(None, company(website_url="http://www.rossitubi.it/"))
        self.assertEqual(result, {"outcome": "unreachable"})

    async def test_no_vat_on_site(self):
        with patch("app.net_vat1_collector._fetch_page", new=AsyncMock(return_value=page("Tubi"))):
            result = await scan_company(None, company())
        self.assertEqual(result, {"outcome": "not_found"})

    def test_batch_cap(self):
        self.assertEqual(MAX_BATCH, 50)


if __name__ == "__main__":
    unittest.main()
