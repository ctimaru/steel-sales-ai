from __future__ import annotations

import asyncio
from pathlib import Path

import httpx
import pytest

from app import steel_pulse_ingestion as sp2


RSS = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<item><title>Protected original news title</title>
<link>https://news.example.org/article-1?utm_source=feed#fragment</link>
<guid>test-news-one</guid><pubDate>Thu, 08 Oct 2026 09:15:00 GMT</pubDate>
<description>Original article body is NOT retained.</description></item>
<item><link>https://news.example.org/article-1</link></item>
<item><link>https://unapproved.example.org/article-2</link></item>
<item><link>https://news.example.org/article-2</link></item>
</channel></rss>"""


def permission() -> sp2.FeedPermission:
    return sp2.FeedPermission(
        run_id="11111111-1111-4111-8111-111111111111",
        feed_url="https://news.example.org/news.xml",
        allowed_hosts=("news.example.org",),
        approval_evidence_url="https://example.org/rights-approval",
        policy_url="https://news.example.org/terms",
    )


def test_sp2_strips_queries_and_rejects_cross_domain_and_local_urls() -> None:
    assert sp2.canonical_url(
        "https://news.example.org/a?email=redacted#anchor", ("news.example.org",)
    ) == "https://news.example.org/a"
    for url in (
        "https://news.example.org.evil.com/a",
        "http://news.example.org/a",
        "https://user:secret@news.example.org/a",
        "https://news.example.org:444/a",
        "https://127.0.0.1/a",
        "file:///etc/passwd",
        "https://news.example.org\\@evil.example/a",
    ):
        with pytest.raises(sp2.SteelPulseIngestionError):
            sp2.canonical_url(url, ("news.example.org",))


def test_sp2_parses_only_metadata_and_deduplicates() -> None:
    parsed = sp2.parse_feed(RSS, ("news.example.org",))
    assert len(parsed) == 2
    assert parsed[0]["canonical_url"] == "https://news.example.org/article-1"
    assert parsed[0]["source_guid_hash"]
    assert parsed[0]["published_at"].startswith("2026-10-08")
    assert set(parsed[0]) == {"canonical_url", "source_guid_hash", "published_at"}
    assert "title" not in str(parsed)
    assert "Original article body" not in str(parsed)


def test_sp2_rejects_entities_and_invalid_xml() -> None:
    for raw in (b"<!DOCTYPE root [<!ENTITY x 'secret'>]><rss/>", b"not xml", b"<html></html>"):
        with pytest.raises(sp2.SteelPulseIngestionError):
            sp2.parse_feed(raw, ("news.example.org",))


def test_sp2_atom_feed_metadata() -> None:
    raw = b"""<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><entry>
<link rel="alternate" href="https://news.example.org/atom-1?campaign=abc"/>
<id>tag:example.org,2026:atom-1</id>
<updated>2026-10-08T12:00:00Z</updated>
<summary>Do not capture me</summary></entry></feed>"""
    result = sp2.parse_feed(raw, ("news.example.org",))
    assert result[0]["canonical_url"] == "https://news.example.org/atom-1"
    assert "summary" not in result[0]


def test_sp2_default_off_does_not_access_repository_or_network(monkeypatch) -> None:
    monkeypatch.delenv("STEEL_PULSE_INGESTION_ENABLED", raising=False)

    class ForbiddenRepository:
        async def begin(self, _source):
            raise AssertionError("disabled collector must not query DB")

    result = asyncio.run(sp2.run_steel_pulse_source(
        "oecd", repository=ForbiddenRepository(),
    ))
    assert result == {"state": "disabled"}


def test_sp2_source_not_approved_does_not_fetch(monkeypatch) -> None:
    monkeypatch.setenv("STEEL_PULSE_INGESTION_ENABLED", "true")

    class CandidateRepository:
        async def begin(self, source):
            assert source == "oecd"
            return None

    assert asyncio.run(sp2.run_steel_pulse_source(
        "oecd", repository=CandidateRepository(),
    ))["state"] == "source_not_authorized"


def test_sp2_robots_and_feed_success_metadata_only(monkeypatch) -> None:
    monkeypatch.setenv("STEEL_PULSE_INGESTION_ENABLED", "true")

    async def safe_dns(_hostname):
        return None

    monkeypatch.setattr(sp2, "assert_public_dns", safe_dns)

    class FakeRepository:
        def __init__(self):
            self.final = None

        async def begin(self, source):
            assert source == "fake_approved"
            return permission()

        async def finish(self, run_id, *, items=None, failure_code=None):
            self.final = (run_id, items, failure_code)
            return {"ok": True, "state": "succeeded"}

    def respond(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /")
        if request.url.path == "/news.xml":
            return httpx.Response(200, content=RSS)
        raise AssertionError(request.url.path)

    rep = FakeRepository()
    async def invoke():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            return await sp2.run_steel_pulse_source(
                "fake_approved", repository=rep, http_client=client,
            )
    assert asyncio.run(invoke())["state"] == "succeeded"
    assert len(rep.final[1]) == 2
    assert rep.final[2] is None


def test_sp2_robots_denial_stages_nothing_and_audits_failure(monkeypatch) -> None:
    monkeypatch.setenv("STEEL_PULSE_INGESTION_ENABLED", "true")
    async def safe_dns(_hostname):
        return None
    monkeypatch.setattr(sp2, "assert_public_dns", safe_dns)

    class FakeRepository:
        failure = None

        async def begin(self, _source):
            return permission()

        async def finish(self, _id, *, items=None, failure_code=None):
            self.failure = failure_code
            assert items == [] or items is None
            return {"ok": True}

    def respond(request):
        assert request.url.path == "/robots.txt"
        return httpx.Response(200, text="User-agent: *\nDisallow: /news.xml")

    rep = FakeRepository()
    async def invoke():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            return await sp2.run_steel_pulse_source(
                "fake_approved", repository=rep, http_client=client,
            )
    result = asyncio.run(invoke())
    assert result == {"state": "failed", "failure_code": "robots_denied"}
    assert rep.failure == "robots_denied"


def test_sp2_redirect_and_excessive_feed_are_fail_closed(monkeypatch) -> None:
    monkeypatch.setenv("STEEL_PULSE_INGESTION_ENABLED", "true")
    async def safe_dns(_hostname):
        return None
    monkeypatch.setattr(sp2, "assert_public_dns", safe_dns)

    class FakeRepository:
        async def begin(self, _source):
            return permission()

        async def finish(self, _id, *, items=None, failure_code=None):
            assert failure_code is not None
            return {"ok": True}

    async def scenario(response):
        def respond(req):
            if req.url.path == "/robots.txt":
                return httpx.Response(200, text="User-agent: *\nAllow: /")
            return response
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            return await sp2.run_steel_pulse_source("fake_approved", repository=FakeRepository(), http_client=client)

    redirect = asyncio.run(scenario(httpx.Response(
        302, headers={"location": "http://127.0.0.1/private"}
    )))
    assert redirect["failure_code"] == "feed_unavailable"
    oversize = asyncio.run(scenario(httpx.Response(
        200, content=b"<rss>" + b"x" * (sp2.MAX_FEED_BYTES + 1)
    )))
    assert oversize["failure_code"] == "feed_too_large"


def test_sp2_migration_is_private_and_rbac_service_only() -> None:
    path = Path(__file__).resolve().parents[3] / "supabase/migrations/20261008153000_sp2_steel_pulse_ingestion_foundation.sql"
    sql = path.read_text()
    for fragment in (
        "create schema if not exists steel_pulse_private",
        "enable row level security",
        "revoke all on all tables in schema steel_pulse_private",
        "auth.role()) is distinct from 'service_role'",
        "sp2_one_running_lease_per_source",
        "sp2_rights_ledger_immutable",
        "on conflict (canonical_url)",
        "editorial_state text not null default 'staged'",
        "('steelorbis','SteelOrbis'",
    ):
        assert fragment in sql
    assert "create policy" not in sql.lower()
    assert "cron.schedule" not in sql.lower()
