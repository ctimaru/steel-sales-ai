"""AUTO1.A.5.5 — real first-party pages, no retrospective fabricated capabilities."""
from __future__ import annotations

import asyncio
import inspect
import json
import sys
from pathlib import Path

import pytest

from app import net_pro_producers_auto1 as worker
from app import net_pro_producers_auto1a55_audit as audit

ROOT = Path(__file__).resolve().parents[3]
SHA = "a" * 64
DIFFERENT = "b" * 64


def sample(*, page_id="00000000-0000-4000-8000-000000000001",
           domain="example.it", path="/prodotti/rhs", sha=SHA):
    return {
        "page_id": page_id,
        "source_url": f"https://www.{domain}{path}",
        "canonical_domain": domain,
        "source_sha256": sha,
    }


def payload(rows):
    return {
        "contract": audit.SAMPLE_CONTRACT,
        "count": len(rows), "items": rows,
    }


@pytest.mark.parametrize("bad", [
    {},
    {"contract": "wrong", "count": 0, "items": []},
    {"contract": audit.SAMPLE_CONTRACT, "count": 1, "items": []},
    payload([sample(sha="xyz")]),
    payload([sample(domain="wrong.local",path="/") | {
        "source_url": "https://external.example/products"}]),
    payload([sample(), sample()]),
    payload([sample(page_id="invalid")]),
    payload([sample(path="/prodotti/rhs"), sample(
        page_id="00000000-0000-4000-8000-000000000002",path="/prodotti/rhs")]),
])
def test_invalid_samples_fail_closed(bad):
    with pytest.raises(ValueError):
        audit.validate_sample(bad, 8)


def test_host_limit_and_sample_cap():
    rows = [
        sample(page_id=f"00000000-0000-4000-8000-{i:012d}",
               path=f"/prodotti/{i}") for i in range(3)
    ]
    with pytest.raises(ValueError, match="host rate limit"):
        audit.validate_sample(payload(rows), 8)
    with pytest.raises(ValueError, match="1..12"):
        audit.validate_sample(payload([]), 13)


def test_read_only_audit_sha_and_layout(monkeypatch):
    monkeypatch.setenv("NETPRODUCERS_A54_ENABLED", "true")
    rows = [
        sample(),
        sample(page_id="00000000-0000-4000-8000-000000000002",
               domain="two.it"),
        sample(page_id="00000000-0000-4000-8000-000000000003",
               domain="three.it"),
        sample(page_id="00000000-0000-4000-8000-000000000004",
               domain="four.it"),
    ]
    calls = []

    class Db:
        def rpc(self, name, args):
            calls.append((name,args))
            assert name == "netproducers1_auto1a55_product_audit_sample"
            assert args == {"p_limit":4}
            class Response:
                data = payload(rows)
                def execute(self):
                    return self
            return Response()

    async def fake_fetch(client, lease):
        assert lease["needs_content_reparse"] is True
        assert "etag" not in lease and "last_modified" not in lease
        assert "parent_page_id" not in lease
        domain = lease["canonical_domain"]
        if domain == "two.it":
            # Changed source can look technical, but MUST NOT count.
            return {"status":"processed","sha256":DIFFERENT,
                    "a54_layout":"technical_html_rows"}
        if domain == "three.it":
            return {"status":"blocked","error":"robots_disallow"}
        if domain == "four.it":
            return {"status":"processed","sha256":SHA,
                    "a54_layout":"nontechnical_html_table"}
        return {"status":"processed","sha256":SHA,
                "a54_layout":"pdf_links_no_html_table"}

    async def no_sleep(_):
        return None
    monkeypatch.setattr(audit,"fetch_official_page",fake_fetch)
    monkeypatch.setattr(audit.asyncio,"sleep",no_sleep)

    report = asyncio.run(audit.audit_historical_products(Db(),limit=4))
    assert report["selected"] == 4
    assert report["sha_matched"] == 2
    assert report["changed_snapshot"] == 1
    assert report["http_blocked"] == 1
    assert report["layout_categories"] == {
        "nontechnical_html_table":1,
        "pdf_links_no_html_table":1,
    }
    assert report["db_writes"] == report["published_claims"] == 0
    assert [name for name,_ in calls] == [
        "netproducers1_auto1a55_product_audit_sample"
    ]
    rendered = json.dumps(report)
    assert all(secret not in rendered for secret in (
        "example.it","two.it","three.it","four.it",SHA,DIFFERENT,
        "00000000-0000-4000-8000",
    ))


def test_missing_classifier_or_invalid_layout_never_logs_guess(monkeypatch):
    monkeypatch.delenv("NETPRODUCERS_A54_ENABLED",raising=False)
    class Db:
        def rpc(self, *args):
            raise AssertionError("no RPC without A5.4 flag")
    with pytest.raises(ValueError,match="classifier"):
        asyncio.run(audit.audit_historical_products(Db(),limit=1))


def test_sql_is_service_only_and_cannot_mutate_existing_queue():
    sql = (ROOT / "supabase/migrations" /
           "20261117143000_net_producers_auto1a55_readonly_product_audit.sql").read_text()
    assert sql.count("$body$;") == 2
    assert "not between 1 and 12" in sql
    assert "domain_rank<=2" in sql
    assert "p.next_check_at>now()" in sql
    assert "p.root_sha256=q.last_sha256" in sql
    assert "p.root_source_url=q.source_url" in sql
    assert "c.publication_status='published'" in sql
    assert "r.canonical_key='producer'" in sql
    assert sql.count("from public,anon,authenticated;") == 2
    assert sql.count("to service_role;") == 2
    assert "stable security definer" in sql
    for forbidden in ("update private.", "insert into private.", "delete from private.",
                      "alter table private.network_producer_auto1_product_pages"):
        assert forbidden not in sql.lower()
    src = inspect.getsource(worker.fetch_official_page)
    assert "public_dns_only" in src and "RobotFileParser" in src
    assert "robots_disallow" in src and "html_too_large" in src
    auditor = inspect.getsource(audit.audit_historical_products)
    assert "follow_redirects=False" in auditor and "trust_env=False" in auditor
    assert 'result.get("sha256") != page["source_sha256"]' in auditor


def test_manual_a55_never_runs_inside_persist_cron(monkeypatch):
    monkeypatch.setattr(sys,"argv",["worker","--persist","--audit-a55"])
    with pytest.raises(SystemExit) as exc:
        worker.main()
    assert exc.value.code == 2
    monkeypatch.setattr(sys,"argv",["worker","--audit-a5","--audit-a55"])
    with pytest.raises(SystemExit) as exc:
        worker.main()
    assert exc.value.code == 2
