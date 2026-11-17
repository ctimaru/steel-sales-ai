"""AUTO1.A.5.2 — historical audit is bounded, first-party and read-only."""
from __future__ import annotations

import asyncio
import inspect
import json
import sys
from pathlib import Path

import pytest

from app import net_pro_producers_auto1 as worker
from app import net_pro_producers_auto1a5_audit as audit
from app.net_pro_producers_auto1a4 import (
    discover_detail_links, extract_exact_row_candidates,
)
from app.net_pro_producers_auto1a5 import diagnose_detail_html

SHA = "a" * 64
CHANGED_SHA = "b" * 64
BASE = "https://www.example.it/prodotti/tubi"
ROOT = Path(__file__).resolve().parents[3]


def sample(url="https://www.example.it/prodotti/rhs", sha=SHA, page_id=None):
    return {
        "page_id": page_id or "00000000-0000-4000-8000-000000000001",
        "parent_page_id": "00000000-0000-4000-8000-000000000011",
        "source_url": url, "canonical_domain": "example.it",
        "source_sha256": sha,
    }


@pytest.mark.parametrize("payload", [
    {},
    {"contract": "bogus", "items": [], "count": 0},
    {"contract": "netproducers-auto1a5-audit-sample-v1", "items": [], "count": 1},
    {"contract": "netproducers-auto1a5-audit-sample-v1", "items": [
        sample("https://evil.example/steels")], "count": 1},
    {"contract": "netproducers-auto1a5-audit-sample-v1", "items": [
        sample(sha="0")], "count": 1},
    {"contract": "netproducers-auto1a5-audit-sample-v1", "items": [
        sample(), sample()], "count": 2},
])
def test_invalid_sample_fails_closed(payload):
    with pytest.raises(ValueError):
        audit.validate_sample(payload, 8)


def test_audit_sample_per_host_bounded_and_total_bounded():
    rows = [sample(url=f"https://www.example.it/prodotti/{i}",
                   page_id=f"00000000-0000-4000-8000-{i:012d}") for i in range(3)]
    payload = {
        "contract": "netproducers-auto1a5-audit-sample-v1",
        "count": 3, "items": rows,
    }
    with pytest.raises(ValueError, match="host rate limit"):
        audit.validate_sample(payload, 8)
    with pytest.raises(ValueError, match="sample"):
        audit.validate_sample(payload, 13)


def test_audit_is_readonly_and_does_not_attribute_changed_sha(monkeypatch):
    sources = [
        sample(page_id="00000000-0000-4000-8000-000000000001"),
        {**sample(url="https://www.other.it/prodotti/steel",
                  page_id="00000000-0000-4000-8000-000000000002"),
         "canonical_domain": "other.it"},
        {**sample(url="https://www.third.it/prodotti/tubi",
                  page_id="00000000-0000-4000-8000-000000000003"),
         "canonical_domain": "third.it"},
    ]
    calls = []

    class Response:
        def __init__(self, data):
            self.data = data

        def execute(self):
            return self

    class Db:
        def rpc(self, name, args):
            calls.append((name, args))
            assert name == "netproducers1_auto1a5_audit_sample"
            assert args == {"p_limit": 3}
            return Response({
                "contract": "netproducers-auto1a5-audit-sample-v1",
                "count": 3, "items": sources,
            })

    async def fake_fetch(client, lease):
        assert lease["needs_content_reparse"] is True
        assert "etag" not in lease and "last_modified" not in lease
        if "other.it" in lease["source_url"]:
            return {"status": "processed", "sha256": CHANGED_SHA,
                    "diagnostic": {"contract": "netproducers-auto1a5-diagnostic-v1",
                                   "reason": "exact_candidate"}}
        if "third.it" in lease["source_url"]:
            return {"status": "blocked", "error": "robots_disallow"}
        return {"status": "processed", "sha256": SHA, "diagnostic": {
            "contract": "netproducers-auto1a5-diagnostic-v1",
            "reason": "no_table_rows", "table_rows": 0,
        }}

    async def no_sleep(_duration):
        return None

    monkeypatch.setattr(audit, "fetch_official_page", fake_fetch)
    monkeypatch.setattr(audit.asyncio, "sleep", no_sleep)
    report = asyncio.run(audit.audit_historical_details(Db(), limit=3))
    assert report["selected"] == 3
    assert report["sha_matched"] == 1
    assert report["changed_snapshot"] == 1
    assert report["http_blocked"] == 1
    assert report["reasons"] == {"no_table_rows": 1}
    assert report["db_writes"] == report["published_claims"] == 0
    assert [name for name, _ in calls] == ["netproducers1_auto1a5_audit_sample"]
    rendered = json.dumps(report)
    assert all(secret not in rendered for secret in ("example.it", SHA, "other.it", "00000000"))


def test_source_local_gap_remains_no_technical_evidence():
    html = ("<table><tr><td>EN 10219 RHS</td></tr>"
            "<tr><td>S355J2H 200x100x6</td></tr></table>")
    candidates = extract_exact_row_candidates(html, BASE, SHA)
    diagnostic = diagnose_detail_html(html, candidates)
    assert candidates == []
    assert diagnostic["reason"] == "split_across_rows"
    assert diagnostic["exact_candidates"] == 0


def test_technical_links_rank_ahead_of_generic_and_skip_offtopic_pages():
    anchors = [
        f'<a href="/prodotti/tubi-{i}">Tubi</a>' for i in range(8)
    ] + [
        '<a href="/tubi-in-acciaio/lavora-con-noi/">RHS technical data</a>',
        '<a href="/sostenibilita-2/tubi/">RHS EN10219 technical data</a>',
        '<a href="/prodotti/tubi-paladex/criteri-ambientali-minimi/">Tubi</a>',
        '<a href="/prodotti/tubi-rhs-en-10219/">RHS EN 10219 technical details</a>',
        '<a href="https://evil.test/prodotti/rhs">RHS EN 10219</a>',
        '<a href="/brochure.pdf">RHS EN 10219</a>',
    ]
    links = discover_detail_links("".join(anchors), BASE, "www.example.it", SHA)
    assert len(links) == 6
    assert links[0]["url"] == "https://www.example.it/prodotti/tubi-rhs-en-10219/"
    assert all("lavora-con-noi" not in link["url"] for link in links)
    assert all("sostenibilita" not in link["url"] for link in links)
    assert all("ambientali" not in link["url"] for link in links)
    assert all("evil" not in link["url"] and ".pdf" not in link["url"] for link in links)
    assert all(link["parent_sha256"] == SHA for link in links)


def test_readonly_sql_contract_and_guardrails():
    sql = (ROOT / "supabase/migrations"
           / "20261117113000_net_producers_auto1a5_2_readonly_sample.sql").read_text()
    assert sql.count("$body$;") == 2
    assert "not between 1 and 12" in sql
    assert "domain_rank<=2" in sql
    assert "d.next_check_at>now()" in sql
    assert "d.parent_sha256=p.last_sha256" in sql
    assert "p.detail_discovery_sha256=p.last_sha256" in sql
    assert "c.publication_status='published'" in sql
    assert "r.canonical_key='producer'" in sql
    assert sql.count("from public,anon,authenticated;") == 2
    assert sql.count("to service_role;") == 2
    assert "stable security definer" in sql
    for forbidden in ("update private.", "insert into private.", "delete from private.",
                      "alter table private.network_producer_auto1_detail_pages"):
        assert forbidden not in sql.lower()
    src = inspect.getsource(worker.fetch_official_page)
    assert "public_dns_only" in src and "RobotFileParser" in src
    assert "robots_disallow" in src and "html_too_large" in src
    audit_src = inspect.getsource(audit.audit_historical_details)
    assert "follow_redirects=False" in audit_src and "trust_env=False" in audit_src
    assert "result.get(\"sha256\") != page[\"source_sha256\"]" in audit_src


def test_a5_audit_and_persist_flags_are_mutually_exclusive(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["worker", "--audit-a5", "--persist"])
    with pytest.raises(SystemExit) as exc:
        worker.main()
    assert exc.value.code == 2


def test_repeated_footer_anchor_keeps_best_technical_priority():
    html = (
        '<a href="/prodotti/z-tubi">RHS EN 10219 technical specifications</a>'
        + "".join(f'<a href="/prodotti/tubi-{n}">Tubi</a>' for n in range(8))
        + '<a href="/prodotti/z-tubi">Tubi</a>'
    )
    links = discover_detail_links(html, BASE, "www.example.it", SHA)
    assert len(links) == 6
    assert links[0]["url"] == "https://www.example.it/prodotti/z-tubi"
    assert sum(x["url"].endswith("/prodotti/z-tubi") for x in links) == 1
