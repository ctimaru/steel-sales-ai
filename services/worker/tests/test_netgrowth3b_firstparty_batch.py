"""Security and data-quality contract for the curated NET-GROWTH3.B batch."""
import asyncio
import copy
import json

import httpx
import pytest

from app.netgrowth3b_firstparty_batch import (
    MANIFEST, SOURCE_TABLES, preflight, run, validate_manifest,
)


def manifest():
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def test_first_tranche_is_source_backed_distinct_unpublished_traders():
    batch, records = validate_manifest(manifest())
    assert batch == "NET-GROWTH3B-IT-TRADERS-20261104-A"
    assert len(records) == 25
    assert len({record["domain"] for record in records}) == 25
    assert all(record["role"] == "trader_distributor" for record in records)
    assert all(record["material_signal"] == "explicit_steel_tube_product" for record in records)


@pytest.mark.parametrize("mutation", [
    lambda m: m["records"][0].update({"role": "producer"}),
    lambda m: m["records"][0].update({"role": "end_user"}),
    lambda m: m["records"][0].update({"evidence_url": "https://other.org/"}),
    lambda m: m["records"][0].update({"summary": "sales@example.com"}),
    lambda m: m["records"].append(copy.deepcopy(m["records"][0])),
    lambda m: m["records"][0].update({"segment": "industrial_equipment"}),
])
def test_fail_closed_on_role_source_or_duplicate(mutation):
    bad = manifest()
    mutation(bad)
    with pytest.raises(ValueError):
        validate_manifest(bad)


def test_dry_run_no_secrets_no_requests_no_database_mutation(monkeypatch):
    monkeypatch.delenv("CRAWL_IT65B_SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.delenv("CRAWL_IT65B_SUPABASE_URL", raising=False)
    result = asyncio.run(run(apply=False))
    assert result["status"] == "validated_offline"
    assert result["requested"] == 25
    assert result["new_unconfirmed"] == result["published"] == 0


def test_cross_source_guard_blocks_previously_known_entities():
    records = manifest()["records"]
    def handler(request):
        assert request.url.path.startswith("/rest/v1/")
        table = request.url.path.rsplit("/", 1)[-1]
        assert table in SOURCE_TABLES
        key = SOURCE_TABLES[table]
        if table == "network_netfast2_structured_entities":
            return httpx.Response(200, json=[{key: records[0]["domain"]}])
        return httpx.Response(200, json=[])
    async def check():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await preflight(client, "https://example.supabase.co", "nonprod", records)
    with pytest.raises(RuntimeError, match="duplicate/opt-out"):
        asyncio.run(check())


def test_cross_source_preflight_fails_closed_if_unavailable():
    def handler(request):
        return httpx.Response(403, json={"message": "denied"})
    async def check():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await preflight(client, "https://example.supabase.co", "nonprod", manifest()["records"])
    with pytest.raises(RuntimeError, match="preflight unavailable"):
        asyncio.run(check())
