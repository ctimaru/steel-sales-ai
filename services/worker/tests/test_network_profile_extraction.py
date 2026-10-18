import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.network_profile_extraction import (
    MAX_DESCRIPTION, candidates_from_pages, description_candidate, extract_site
)


class ProfileExtractionTest(unittest.TestCase):
    def test_extracts_redacted_bounded_evidence(self):
        paragraph = ("Produciamo carpenteria e componenti metallici per aziende industriali. " * 15)
        candidate = description_candidate(paragraph + " info@example.com +39 011 1234567")
        self.assertIsNotNone(candidate)
        self.assertLessEqual(len(candidate), MAX_DESCRIPTION)
        self.assertNotIn("example.com", candidate)

    def test_short_unreliable_text_is_omitted(self):
        self.assertIsNone(description_candidate("Home"))

    def test_provenance_and_candidate_only(self):
        page = SimpleNamespace(
            url="https://example.com/azienda",
            text=("Azienda industriale specializzata in carpenteria metallica e "
                  "lavorazioni conto terzi nel territorio italiano. ") * 5,
        )
        rows = candidates_from_pages([page], fetched_at="2026-10-19T00:00:00Z")
        self.assertTrue(rows)
        for row in rows:
            self.assertEqual(row["review_status"], "candidate")
            self.assertEqual(row["evidence_url"], page.url)
            self.assertIsNone(row["confidence"])
            self.assertIn("extractor_version", row)


class CrawlGateTest(unittest.IsolatedAsyncioTestCase):
    async def test_robots_unavailable_fails_closed(self):
        with patch("app.network_profile_extraction._fetch_page", new=AsyncMock(return_value=None)):
            output = await extract_site(None, "https://example.com/")
        self.assertEqual(output["candidates"], [])
        self.assertEqual(output["status"], "blocked_or_unavailable")


if __name__ == "__main__":
    unittest.main()
