"""CRAWL-IT6.10 smoke tests using built-in asynchronous unittest."""
import unittest
from unittest.mock import AsyncMock, patch
from app.crawl_it69_domain_preview import extract_preview


class ExtractionPreviewTests(unittest.IsolatedAsyncioTestCase):
    async def test_robots_skip_remains_non_fatal(self):
        with patch("app.crawl_it69_domain_preview._fetch_page", new_callable=AsyncMock, return_value=None):
            result = await extract_preview(None, "https://example.com")
        self.assertEqual(result, {"status": "skipped_robots_or_unavailable", "pages": 0})

    async def test_no_role_is_not_published(self):
        class Page:
            url = "https://example.com/"
            links = ()
        with patch("app.crawl_it69_domain_preview._fetch_page", new_callable=AsyncMock, return_value=Page()), patch(
            "app.crawl_it69_domain_preview.extract_candidate", return_value=None
        ):
            result = await extract_preview(None, "https://example.com")
        self.assertEqual(result["status"], "insufficient_tube_evidence")
        self.assertTrue(result["needs_human_review"])
