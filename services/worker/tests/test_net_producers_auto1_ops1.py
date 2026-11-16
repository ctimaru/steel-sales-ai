"""OPS1: invalid second-level navigation must not kill the scheduled research run."""
import asyncio
from pathlib import Path

import pytest

from app import net_pro_producers_auto1 as worker

SHA = "a" * 64


def test_sql_skips_only_previously_indexed_first_level_product_links():
    migration = (Path(__file__).resolve().parents[3] /
                 "supabase/migrations/20261116213000_net_producers_auto1_ops1_skip_existing_product_urls.sql")
    sql = migration.read_text(encoding="utf-8")
    assert "create or replace function private.netproducers1_auto1a4_discover" in sql.lower()
    assert "v_url !~ '^https://" in sql
    assert "split_part(v_url,'/',3)<>split_part(v_parent.source_url,'/',3)" in sql
    assert "v_item->>'parent_sha256' is distinct from p_parent_sha256" in sql
    assert "Current canonical producer required" in sql
    invalid_guard = sql.split("for v_item in select value from jsonb_array_elements(p_links) loop", 1)[1]
    invalid_guard = invalid_guard.split("raise exception 'Invalid, duplicate or foreign second-level URL'", 1)[0]
    assert "or exists (select 1 from private.network_producer_auto1_product_pages" not in invalid_guard
    navigation_guard = sql.split("raise exception 'Invalid, duplicate or foreign second-level URL'", 1)[1]
    assert "if exists (select 1 from private.network_producer_auto1_product_pages x" in navigation_guard
    assert "where x.company_id=v_parent.company_id and x.source_url=v_url) then" in navigation_guard
    assert "v_skipped_existing_product:=v_skipped_existing_product+1;\n   continue;" in navigation_guard
    assert "'skipped_existing_product',v_skipped_existing_product" in sql
    assert "revoke all on function private.netproducers1_auto1a4_discover" in sql
    assert "to service_role;" in sql
    assert "to anon" not in sql


@pytest.mark.parametrize("code,message,should_continue", [
    ("22023", "Invalid, duplicate or foreign second-level URL", True),
    ("42501", "Current canonical producer required", False),
    ("22023", "Invalid second-level discovery payload", False),
])
def test_worker_isolates_only_expected_url_rejection(
    monkeypatch, capsys, code, message, should_continue
):
    monkeypatch.setenv("NETPRODUCERS_A4_ENABLED", "true")

    class RpcError(Exception):
        def __init__(self):
            super().__init__("server rejected a URL")
            self.code = code
            self.message = message

    class Response:
        def __init__(self, data):
            self.data = data

    class Call:
        def __init__(self, name, response):
            self.name = name
            self.response = response

        def execute(self):
            if self.name == "netproducers1_auto1a4_discover":
                raise RpcError()
            return Response(self.response)

    responses = {
        "netproducers1_auto1_seed": {"contract": "netproducers1-auto1-seed-v1", "added": 0},
        "netproducers1_auto1_claim": {"contract": "netproducers1-auto1-claim-v1", "items": [], "count": 0},
        "netproducers1_auto1a3_claim_pages": {
            "contract": "netproducers-auto1a3-claim-v1",
            "items": [{"page_id": "p1", "company_id": "c1",
                       "source_url": "https://example.it/prodotti/tubi",
                       "canonical_domain": "example.it"}],
            "count": 1,
        },
        "netproducers1_auto1a3_complete_page": {
            "contract": "netproducers-auto1a3-complete-v1", "candidate_count": 0},
        "netproducers1_auto1a4_claim_pages": {
            "contract": "netproducers-auto1a4-claim-v1", "items": [], "count": 0},
        "netproducers1_auto1b_verify": {"contract": "netproducers-auto1b-verify-v1", "checked": 0},
        "netproducers1_auto1a3_verify": {"contract": "netproducers-auto1a3-verify-v1", "checked": 0},
    }

    class Db:
        calls = []

        def rpc(self, name, params):
            self.calls.append((name, params))
            return Call(name, responses.get(name))

    async def fake_fetch(client, lease):
        return {"status": "processed", "sha256": SHA, "candidates": [],
                "detail_links": [{
                    "url": "https://example.it/prodotti/altri-tubi",
                    "depth": 2, "parent_url": lease["source_url"],
                    "parent_sha256": SHA,
                }]}

    monkeypatch.setattr(worker, "fetch_official_page", fake_fetch)
    db = Db()
    if should_continue:
        outcome = asyncio.run(worker.run(db, limit=1, dry_run=False))
        assert outcome["depth_two_discovery_rejections"] == 1
        assert outcome["published_claims"] == 0
        assert outcome["page_outcomes"][0]["discovery_rejected"] is True
        assert "netproducers1_auto1b_verify" in [name for name, _ in db.calls]
        logs = capsys.readouterr().out
        assert "netproducers_auto1a4_discovery_rejected" in logs
        assert "https://" not in logs, "No untrusted URLs printed in worker logs"
    else:
        with pytest.raises(RpcError):
            asyncio.run(worker.run(db, limit=1, dry_run=False))
        assert "netproducers1_auto1b_verify" not in [name for name, _ in db.calls]
