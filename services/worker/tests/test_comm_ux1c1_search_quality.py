"""Synthetic, no-credentials acceptance for private Commercial Search quality."""
from uuid import UUID

import pytest

from app import global_search
from app.search_quality import (
    MAX_FAMILY_BACKFILLS,
    balanced_preview,
    missing_preview_families,
    source_reference_available,
)


def result(kind: str, number: int, score: float = 0.9) -> dict:
    return {
        "result_type": kind,
        "result_id": f"{kind}:{number}",
        "title": f"Synthetic {kind} {number}",
        "event_at": None,
        "score": score,
        "metadata": {"observation_id": number + 1} if kind != "product" else {},
    }


def test_family_backfill_is_requested_only_for_indexed_but_missing_families():
    visible = [result("order", i) for i in range(40)]
    counts = {"order": 40, "product": 100, "company": 0, "offer": 3, "document": 99}
    assert missing_preview_families(counts, visible, []) == ["product", "offer"]
    assert len(missing_preview_families(counts, visible, [])) <= MAX_FAMILY_BACKFILLS
    assert missing_preview_families(counts, visible, ["order"]) == []
    assert missing_preview_families(counts, visible, ["product"]) == ["product"]


def test_preview_preserves_within_family_rank_and_deduplicates_across_sources():
    candidates = [
        *[result("order", i, 0.95 - i / 100) for i in range(8)],
        result("product", 0, 0.8),
        result("document", 1, 0.02),
        result("product", 0, 0.8),
        result("company", 2, 0.7),
    ]
    shown = balanced_preview(candidates, 6)
    assert len(shown) == 6
    assert [row["result_type"] for row in shown[:4]] == [
        "order", "product", "company", "document",
    ]
    assert len({(row["result_type"], row["result_id"]) for row in shown}) == 6
    assert [row["result_id"] for row in shown if row["result_type"] == "order"] == [
        "order:0", "order:1",
    ]


def test_source_reference_is_locator_not_content_verification():
    assert source_reference_available({"metadata": {"observation_id": 3}})
    assert source_reference_available({"metadata": {"document_id": "synthetic-id"}})
    assert source_reference_available({"thread_id": "synthetic-id"})
    assert not source_reference_available({"metadata": {"observation_id": -1}})
    assert not source_reference_available({"metadata": {"source_uri": None}})


@pytest.mark.asyncio
async def test_worker_fills_product_family_without_crossing_membership(monkeypatch):
    tenant = "00000000-0000-4000-8000-000000000010"
    actor = UUID("00000000-0000-4000-8000-000000000001")
    seen: list[tuple[str, object]] = []

    async def fake_request(self, method, path, *, json=None, prefer=None):
        seen.append((path, json))
        if path.startswith("/rest/v1/organization_memberships"):
            assert f"user_id=eq.{actor}" in path
            return [{"organization_id": tenant, "user_id": str(actor),
                     "role": "member", "is_default": True}]
        if path == "/rest/v1/rpc/p1_global_structured_search_bridge_v2":
            assert json["p_organization_id"] == tenant
            if json["p_types"] == ["product"]:
                assert json["p_limit"] <= 8
                return {"counts": {"product": 20}, "total": 20,
                        "results": [result("product", i, 0.8) for i in range(6)]}
            assert json["p_types"] == ["rfq", "product"]
            return {"counts": {"rfq": 40, "product": 20}, "total": 60,
                    "results": [result("rfq", i, 0.95) for i in range(10)]}
        raise AssertionError(f"Unexpected DB call {path}")

    async def fake_enrich(repo, records):
        return records

    monkeypatch.setattr(global_search.WorkerRepository, "_request", fake_request)
    monkeypatch.setattr(global_search, "enrich_records_with_shared_reference", fake_enrich)
    service = global_search.GlobalSearchService()
    payload = await service.search(
        global_search.GlobalSearchRequest(actor_user_id=actor,
                                          query="S355J2H", types=["rfq", "product"], limit=10)
    )
    assert payload["count"] == 10
    assert {row["result_type"] for row in payload["results"]} == {"rfq", "product"}
    assert payload["quality"]["preview_limited"] is True
    assert payload["quality"]["structured_matches"] == 60
    assert payload["quality"]["source_references"] >= 1
    assert payload["quality"]["backfill_incomplete"] is False
    assert len([p for p, _ in seen if p.endswith("bridge_v2")]) == 2
    assert "other-tenant" not in str(payload)


@pytest.mark.asyncio
async def test_backfill_failure_retains_authorized_results_and_signals_incomplete(monkeypatch):
    tenant = "00000000-0000-4000-8000-000000000010"
    actor = UUID("00000000-0000-4000-8000-000000000001")

    async def fake_request(self, method, path, *, json=None, prefer=None):
        if path.startswith("/rest/v1/organization_memberships"):
            return [{"organization_id": tenant, "role": "viewer"}]
        if path.endswith("bridge_v2") and json["p_types"] == ["product"]:
            raise global_search.RepositoryError("temporarily unavailable")
        if path.endswith("bridge_v2"):
            return {"counts": {"rfq": 5, "product": 8}, "total": 13,
                    "results": [result("rfq", i) for i in range(5)]}
        raise AssertionError(path)

    async def fake_enrich(repo, records):
        return records

    monkeypatch.setattr(global_search.WorkerRepository, "_request", fake_request)
    monkeypatch.setattr(global_search, "enrich_records_with_shared_reference", fake_enrich)
    payload = await global_search.GlobalSearchService().search(
        global_search.GlobalSearchRequest(actor_user_id=actor, query="S355J2H",
                                          types=["rfq", "product"], limit=5)
    )
    assert payload["count"] == 5
    assert payload["quality"]["backfill_incomplete"] is True
    assert payload["quality"]["preview_limited"] is True
    assert all(row["result_type"] == "rfq" for row in payload["results"])
