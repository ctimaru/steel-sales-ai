"""Local CI-only GitHub Actions runner tests: no real network or production data."""
import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.github_actions_crawler import (
    MAX_DOMAINS, credentials_from_environment, run_preview, run_stage, main
)


def env_key(monkeypatch):
    monkeypatch.setenv("CRAWL_IT65B_SUPABASE_URL", "https://ecrafjdummcdfycznitx.supabase.co")
    monkeypatch.setenv("CRAWL_IT65B_SUPABASE_SECRET_KEY", "sb_secret_" + "a" * 32)


def test_stage_requires_new_secret_and_exact_project(monkeypatch):
    monkeypatch.delenv("CRAWL_IT65B_SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.setenv("CRAWL_IT65B_SUPABASE_URL", "https://evil.example")
    with pytest.raises(ValueError, match="approved Supabase project"):
        credentials_from_environment()
    monkeypatch.setenv("CRAWL_IT65B_SUPABASE_URL", "https://ecrafjdummcdfycznitx.supabase.co")
    with pytest.raises(ValueError, match="Dedicated Supabase secret"):
        credentials_from_environment()
    monkeypatch.setenv("CRAWL_IT65B_SUPABASE_SECRET_KEY", "sb_publishable_" + "a" * 32)
    with pytest.raises(ValueError, match="Dedicated Supabase secret"):
        credentials_from_environment()
    env_key(monkeypatch)
    assert credentials_from_environment()[0] == "https://ecrafjdummcdfycznitx.supabase.co"


def test_preview_never_needs_db_or_modifies_data(monkeypatch):
    monkeypatch.delenv("CRAWL_IT65B_SUPABASE_SECRET_KEY", raising=False)
    with patch("app.github_actions_crawler.rpc", new_callable=AsyncMock) as rpc, patch(
        "app.github_actions_crawler.preview_wikidata_steel_italy",
        new_callable=AsyncMock, return_value=[
            ("fresh.example", "https://fresh.example/", "https://www.wikidata.org/wiki/Q12345")
        ]
    ) as preview:
        report = asyncio.run(run_preview(5))
        assert report["unique_proposals"] == 1
        assert report["inserted"] == 0 and report["published"] == 0
        preview.assert_awaited_once_with(limit=5)
        rpc.assert_not_awaited()
    with pytest.raises(ValueError):
        asyncio.run(run_preview(6))


def test_not_due_never_requests_wikidata(monkeypatch):
    env_key(monkeypatch)
    with patch("app.github_actions_crawler.rpc", new_callable=AsyncMock,
               return_value={"eligible": False, "reason": "not_due",
                             "next_due_at": "2026-10-21T13:25:30Z"}) as rpc, patch(
        "app.github_actions_crawler.preview_wikidata_steel_italy",
        new_callable=AsyncMock
    ) as preview:
        result = asyncio.run(run_stage())
        assert result["wikidata_requests"] == 0
        assert result["status"] == "skipped"
        assert result["reason"] == "not_due"
        rpc.assert_awaited_once()
        preview.assert_not_awaited()


def test_due_one_query_atomic_commit_and_no_publishing(monkeypatch):
    env_key(monkeypatch)
    with patch("app.github_actions_crawler.rpc", new_callable=AsyncMock, side_effect=[
        {"eligible": True, "reason": "due", "max_domains": 5},
        {"status": "staged_for_human_review", "inserted": 1,
         "existing_network": 1, "existing_leads": 0, "existing_candidates": 0,
         "published": 0, "next_due_at": "2026-10-21"}
    ]) as rpc, patch(
        "app.github_actions_crawler.preview_wikidata_steel_italy",
        new_callable=AsyncMock, return_value=[
            ("fresh.example", "https://fresh.example/", "https://www.wikidata.org/wiki/Q12345"),
            ("seen.example", "https://seen.example/", "https://www.wikidata.org/wiki/Q67890")
        ]
    ) as preview:
        result = asyncio.run(run_stage())
        assert result["status"] == "completed"
        assert result["inserted"] == 1 and result["published"] == 0
        assert rpc.await_count == 2
        assert rpc.await_args_list[0].args[0] == "crawl_it65b_source_preflight"
        assert rpc.await_args_list[1].args[0] == "crawl_it65b_commit_wikidata_leads"
        assert len(rpc.await_args_list[1].args[1]["p_items"]) == 2
        preview.assert_awaited_once_with(limit=5)


def test_fail_closed_inconsistent_or_excessive_db_budget(monkeypatch):
    env_key(monkeypatch)
    with patch("app.github_actions_crawler.rpc", new_callable=AsyncMock,
               return_value={"eligible": True, "max_domains": 50}), patch(
        "app.github_actions_crawler.preview_wikidata_steel_italy", new_callable=AsyncMock
    ) as preview:
        with pytest.raises(RuntimeError, match="exceeds approved cap"):
            asyncio.run(run_stage())
        preview.assert_not_awaited()


def test_main_rejects_staging_while_disabled(monkeypatch):
    env_key(monkeypatch)
    monkeypatch.delenv("CRAWL_IT65B_ENABLED", raising=False)
    with patch("sys.argv", ["crawler", "--mode", "stage"]), patch(
        "app.github_actions_crawler.rpc", new_callable=AsyncMock
    ) as rpc:
        with pytest.raises(RuntimeError, match="not true"):
            asyncio.run(main())
        rpc.assert_not_awaited()


def test_public_rpc_does_not_bearer_secret(monkeypatch):
    import httpx
    from app.github_actions_crawler import rpc as rpc_call
    key = "sb_secret_" + "a" * 32
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={"eligible": False, "reason": "not_due"})

    # Capture AsyncClient constructor without patching the shared httpx module.
    original = httpx.AsyncClient
    def create_client(**kwargs):
        return original(transport=httpx.MockTransport(handler), **kwargs)

    with patch("app.github_actions_crawler.httpx.AsyncClient", side_effect=create_client):
        result = asyncio.run(rpc_call(
            "crawl_it65b_source_preflight", {},
            "https://ecrafjdummcdfycznitx.supabase.co", key))
    assert result["reason"] == "not_due"
    assert len(requests) == 1
    assert requests[0].headers.get("apikey") == key
    assert requests[0].headers.get("authorization") is None
    assert requests[0].url.path == "/rest/v1/rpc/crawl_it65b_source_preflight"
