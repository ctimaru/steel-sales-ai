"""CRAWL-IT6.10: evidence-only extraction preview smoke tests."""
import pytest
from unittest.mock import AsyncMock, patch
from app.crawl_it69_domain_preview import extract_preview

@pytest.mark.asyncio
async def test_robots_skip_remains_non_fatal():
    with patch("app.crawl_it69_domain_preview._fetch_page", new_callable=AsyncMock, return_value=None):
        result = await extract_preview(None, "https://example.com")
    assert result == {"status": "skipped_robots_or_unavailable", "pages": 0}

@pytest.mark.asyncio
async def test_no_role_is_not_published():
    class Page:
        url = "https://example.com/"
        links = ()
    with patch("app.crawl_it69_domain_preview._fetch_page", new_callable=AsyncMock, return_value=Page()), patch(
        "app.crawl_it69_domain_preview.extract_candidate", return_value=None
    ):
        result = await extract_preview(None, "https://example.com")
    assert result["status"] == "insufficient_tube_evidence"
    assert result["needs_human_review"] is True
