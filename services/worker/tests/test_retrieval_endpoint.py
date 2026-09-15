from __future__ import annotations

import os

from fastapi.testclient import TestClient

os.environ["WORKER_STORAGE_MODE"] = "supabase"

import app.retrieval_api as retrieval_api  # noqa: E402
from app.server import app  # noqa: E402

client = TestClient(app)


def test_hybrid_search_endpoint_forwards_typed_filters(monkeypatch) -> None:
    captured: dict[str, object] = {}

    async def fake_search_knowledge(**kwargs):
        captured.update(kwargs)
        return {
            "query": kwargs["query"],
            "model": {"model_key": "test", "model_name": "test", "dimensions": 3},
            "retrieval": {"strategy": "hybrid_rrf"},
            "count": 1,
            "results": [{"chunk_id": "chunk-1", "content": "S355J2H"}],
        }

    monkeypatch.setattr(retrieval_api, "search_knowledge", fake_search_knowledge)
    monkeypatch.setenv("WORKER_STORAGE_MODE", "supabase")
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN", raising=False)

    response = client.post(
        "/v1/knowledge/search",
        json={
            "owner_id": "f45fab6e-3da8-41aa-8711-fc1b337a7dde",
            "query": "Trova offerte S355J2H EN 10219",
            "limit": 5,
            "candidate_count": 40,
            "entity_filters": {
                "grade": ["S355J2H"],
                "standard": ["EN 10219"],
            },
            "commercial_filters": {"thickness_mm": 8},
            "document_filters": {
                "source_class": "internal",
                "document_query": "Bologna",
                "date_from": "2026-09-01",
                "date_to": "2026-09-30",
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert captured["match_count"] == 5
    assert captured["candidate_count"] == 40
    assert captured["entity_filters"] == {
        "standard": ["EN 10219"],
        "grade": ["S355J2H"],
    }
    assert captured["commercial_filters"] == {"thickness_mm": 8.0}
    assert captured["document_filters"] == {
        "source_class": "internal",
        "document_query": "Bologna",
        "date_from": "2026-09-01",
        "date_to": "2026-09-30",
    }


def test_hybrid_search_endpoint_rejects_candidate_pool_smaller_than_limit(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_STORAGE_MODE", "supabase")
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN", raising=False)

    response = client.post(
        "/v1/knowledge/search",
        json={
            "owner_id": "f45fab6e-3da8-41aa-8711-fc1b337a7dde",
            "query": "S355J2H",
            "limit": 20,
            "candidate_count": 10,
        },
    )

    assert response.status_code == 422


def test_hybrid_search_endpoint_rejects_inverted_document_dates(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_STORAGE_MODE", "supabase")
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN", raising=False)

    response = client.post(
        "/v1/knowledge/search",
        json={
            "owner_id": "f45fab6e-3da8-41aa-8711-fc1b337a7dde",
            "query": "S355J2H",
            "document_filters": {
                "date_from": "2026-09-30",
                "date_to": "2026-09-01",
            },
        },
    )

    assert response.status_code == 422
    assert "date_from" in response.json()["detail"]
