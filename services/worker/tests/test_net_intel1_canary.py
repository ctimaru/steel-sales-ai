from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.net_intel1_canary import extract_one, select_canary


def _row(**changes):
    row = {
        "id": "b0000000-0000-0000-0000-000000000001",
        "legal_name": "Example Steel",
        "publication_status": "published",
        "archived_at": None,
        "country_code": "IT",
        "description": None,
        "website_url": "https://example.com",
    }
    row.update(changes)
    return row


def test_only_published_existing_italian_undescribed_companies():
    rows = [
        _row(),
        _row(id="other", publication_status="pending_review"),
        _row(id="archived", archived_at="2026-01-01"),
        _row(id="romanian", country_code="RO"),
        _row(id="described", description="Already documented"),
        _row(id="unsafe", website_url="http://127.0.0.1/admin"),
        _row(id="empty", website_url=None),
        _row(id="b0000000-0000-0000-0000-000000000001"),
    ]
    selected = select_canary(rows)
    assert len(selected) == 1
    assert selected[0]["id"] == "b0000000-0000-0000-0000-000000000001"


def test_canary_is_bounded():
    with pytest.raises(ValueError):
        select_canary([], 0)
    with pytest.raises(ValueError):
        select_canary([], 101)


def test_cross_domain_redirect_is_not_trusted():
    from app.company_discovery import CrawledPage
    home = CrawledPage(
        url="https://other-company.example/",
        title="Other", site_name=None, meta_description=None,
        h1=None, text="Produciamo tubi in acciaio.", links=(),
    )
    with patch("app.net_intel1_canary._fetch_page", new_callable=AsyncMock,
               return_value=home):
        async def check():
            async with httpx.AsyncClient() as client:
                return await extract_one(client, _row())
        result = asyncio.run(check())
    assert result["status"] == "domain_mismatch"
    assert "description" not in result


def test_valid_result_is_a_candidate_never_approved():
    from app.company_discovery import CrawledPage
    home = CrawledPage(
        url="https://example.com/",
        title="Example Steel S.r.l.", site_name="Example Steel",
        meta_description="Produzione di tubi in acciaio.",
        h1="Example Steel", text="Produciamo tubi in acciaio.",
        links=(),
    )
    with (
        patch("app.net_intel1_canary._fetch_page", new_callable=AsyncMock,
              return_value=home),
        patch("app.net_intel1_canary.robots_crawl_delay", new_callable=AsyncMock,
              return_value=0.0),
    ):
        async def check():
            async with httpx.AsyncClient() as client:
                return await extract_one(client, _row())
        result = asyncio.run(check())
    assert result["status"] == "candidate_only"
    assert result["evidence"][0]["url"] == "https://example.com/"
    assert "accepted" not in result
