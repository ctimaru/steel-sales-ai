from __future__ import annotations

from datetime import date, timedelta
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app import trader1d3b_source_refresh as module


def manifest(items, *, rights="not_assessed"):
    return {
        "contract": module.EXPECTED_CONTRACT,
        "source_rights": rights,
        "items": items,
    }


def seed(domain="example.com", url="https://www.example.com/steel/"):
    return {"domain": domain, "market": "DE", "source_url": url}


class HeadClient:
    def __init__(self, status_code=200, headers=None):
        self.status_code = status_code
        self.headers = headers or {"content-type": "text/html", "etag": '"v1"'}
        self.calls = []

    async def head(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return httpx.Response(self.status_code, headers=self.headers,
                              request=httpx.Request("HEAD", url))


class SourceManifestTests(unittest.TestCase):
    def _read(self, payload):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "manifest.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            return module.load_manifest(path)

    def test_rejects_non_first_party_and_private_urls(self):
        bad = (
            seed("example.com", "https://other.example.org/steel"),
            seed("example.com", "http://example.com"),
            seed("example.com", "https://127.0.0.1/"),
            seed("example.com", "https://example.com:9000/"),
            seed("example.com", "https://example.com@other.example.org/"),
            seed("linkedin.com", "https://www.linkedin.com/company/steel"),
        )
        for item in bad:
            with self.subTest(item=item), self.assertRaises(
                (ValueError, module.CompanyDiscoveryError)
            ):
                self._read(manifest([item]))

    def test_rejects_duplicate_and_unapproved_rights(self):
        with self.assertRaises(ValueError):
            self._read(manifest([seed(), seed("example.com", "https://example.com/b")]))
        with self.assertRaises(ValueError):
            self._read(manifest([seed()], rights="license_approved"))

    def test_order_and_daily_rotation_are_bounded(self):
        rows = [seed(f"example{i:02d}.com", f"https://example{i:02d}.com/")
                for i in range(60)]
        data = self._read(manifest(list(reversed(rows))))
        self.assertEqual(len(data), 60)
        day = date(2026, 10, 20)
        visits = []
        for i in range(12):
            slot, batch = module.select_batch(data, day + timedelta(days=i))
            self.assertEqual(slot, i)
            self.assertLessEqual(len(batch), module.MAX_PER_RUN)
            visits.extend(item["domain"] for item in batch)
        self.assertEqual(len(visits), 60)
        self.assertEqual(len(set(visits)), 60)
        self.assertEqual(module.select_batch(data, day + timedelta(days=12))[0], 0)


class SourceProbeTests(unittest.IsolatedAsyncioTestCase):
    async def test_head_metadata_only_not_a_content_crawl(self):
        client = HeadClient()
        with patch.object(module, "_robots_allows", new_callable=AsyncMock,
                          return_value=True), patch.object(
                module, "_assert_public_hostname", new_callable=AsyncMock):
            result = await module.inspect_source(client, seed())
        self.assertEqual(result["status"], "reachable_html")
        self.assertEqual(result["http_status"], 200)
        self.assertRegex(result["fingerprint"], r"^[0-9a-f]{64}$")
        self.assertEqual(len(client.calls), 1)
        self.assertFalse(client.calls[0][1]["follow_redirects"])

    async def test_robots_disallow_prevents_website_request(self):
        client = HeadClient()
        with patch.object(module, "_robots_allows", new_callable=AsyncMock,
                          return_value=False):
            result = await module.inspect_source(client, seed())
        self.assertEqual(result["status"], "robots_or_unavailable")
        self.assertIsNone(result["fingerprint"])
        self.assertEqual(client.calls, [])

    async def test_method_not_supported_and_redirect_are_not_verified_live(self):
        for code, status in ((301, "redirect_observed"), (405, "method_not_supported"),
                             (429, "rate_limited"), (500, "server_error"),
                             (404, "not_found")):
            client = HeadClient(code)
            with self.subTest(code=code), patch.object(
                    module, "_robots_allows", new_callable=AsyncMock, return_value=True
            ), patch.object(module, "_assert_public_hostname", new_callable=AsyncMock):
                result = await module.inspect_source(client, seed())
            self.assertEqual(result["status"], status)

    async def test_cached_metadata_change_is_not_source_rights_approval(self):
        with TemporaryDirectory() as temp:
            manifest_path = Path(temp) / "manifest.json"
            state_path = Path(temp) / "state.json"
            report_path = Path(temp) / "report.json"
            manifest_path.write_text(json.dumps(manifest([seed()])), encoding="utf-8")
            check1 = {"status": "reachable_html", "http_status": 200,
                      "content_type": "text/html", "fingerprint": "a" * 64}
            check2 = {**check1, "fingerprint": "b" * 64}
            with patch.object(module, "inspect_source", new_callable=AsyncMock,
                              return_value=check1):
                first = await module.run(manifest_path, state_path, report_path,
                                         day=date(2026, 10, 20), delay=0, client=HeadClient())
                second = await module.run(manifest_path, state_path, report_path,
                                          day=date(2026, 10, 21), delay=0, client=HeadClient())
            with patch.object(module, "inspect_source", new_callable=AsyncMock,
                              return_value=check2):
                changed = await module.run(manifest_path, state_path, report_path,
                                           day=date(2026, 10, 22), delay=0, client=HeadClient())
            self.assertEqual(first["outcomes"][0]["change"], "first_observation")
            self.assertEqual(second["outcomes"][0]["change"], "unchanged")
            self.assertEqual(changed["outcomes"][0]["change"], "changed")
            self.assertEqual(changed["supabase_writes"], 0)
            self.assertEqual(changed["published"], 0)
            self.assertEqual(changed["source_rights_updated"], 0)
            self.assertFalse(changed["company_content_captured"])
            self.assertEqual(len(module.load_prior(state_path)), 1)


if __name__ == "__main__":
    unittest.main()
