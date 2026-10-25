"""Exercise real retrieval configuration through Global Search's HTTP boundary.

Only the database transport is substituted. In particular, search_knowledge is
not mocked to raise the exception its caller expects: the absent model must be
classified by the actual retrieval implementation. No provider/DB network calls.
"""
from __future__ import annotations

import asyncio
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import global_search, retrieval
from app.embeddings import EmbeddingConfigurationError, EmbeddingProviderError
from app.repository import RepositoryError, WorkerRepository


ACTOR = "00000000-0000-4000-8000-000000000101"
ORGANIZATION = "00000000-0000-4000-8000-000000000201"
app = FastAPI()
app.include_router(global_search.router)


@pytest.fixture
def database(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_synthetic_dummy")
    monkeypatch.delenv("HF_TOKEN", raising=False)
    calls = []
    state = {"member": True, "model": None, "model_error": None}

    async def fake_request(self, method, path, *, json=None, prefer=None):
        calls.append((method, path, json))
        if path.startswith("/rest/v1/organization_memberships?"):
            assert "status=eq.active" in path
            assert f"user_id=eq.{ACTOR}" in path
            return [{"organization_id": ORGANIZATION, "user_id": ACTOR, "role": "member"}] if state["member"] else []
        if path.startswith("/rest/v1/knowledge_embedding_models?"):
            if state["model_error"]:
                raise state["model_error"]
            return [state["model"]] if state["model"] else []
        if path == "/rest/v1/rpc/p1_global_structured_search_bridge_v2":
            assert json["p_organization_id"] == ORGANIZATION
            return {"counts": {"product": 1}, "total": 1, "results": [{
                "result_type": "product", "result_id": "synthetic-product",
                "title": "FLOW1 LOCAL STEEL", "grade": "S235JRH",
                "standard": "EN 10219", "product_type": "round_tube",
                "outer_diameter_mm": 60.3, "thickness_mm": 3.2,
                "score": 1.0, "metadata": {"observation_id": 1},
            }]}
        if path == "/rest/v1/rpc/p1_resolve_shared_steel_reference":
            return {"resolution_status": "not_found", "matched": False}
        raise AssertionError("Unexpected database request")

    monkeypatch.setattr(WorkerRepository, "_request", fake_request)
    return state, calls


def test_actual_retrieval_classifies_absent_model_as_configuration(database):
    with pytest.raises(EmbeddingConfigurationError, match="No active embedding model"):
        asyncio.run(retrieval.search_knowledge(
            owner_id=UUID(ACTOR), query="FLOW1 LOCAL STEEL", repository=WorkerRepository(),
        ))


@pytest.mark.parametrize("types", [[], ["product", "document"]])
def test_http_preserves_authorized_structured_geometry_without_a_model(database, types):
    _, calls = database
    with TestClient(app) as client:
        response = client.post("/v1/global-search", json={
            "actor_user_id": ACTOR, "query": "FLOW1 LOCAL STEEL", "types": types,
        })
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["count"] == 1
    assert body["counts"] == {"product": 1, "document": 0}
    assert body["model"] is None
    assert body["retrieval"] is None
    assert body["results"][0]["outer_diameter_mm"] == 60.3
    assert body["results"][0]["thickness_mm"] == 3.2
    assert body["results"][0]["standard"] == "EN 10219"
    assert calls[0][1].startswith("/rest/v1/organization_memberships?")
    assert sum(path.startswith("/rest/v1/knowledge_embedding_models?") for _, path, _ in calls) == 1


def test_document_only_http_reports_missing_model_without_false_empty_success(database):
    _, calls = database
    with TestClient(app) as client:
        response = client.post("/v1/global-search", json={
            "actor_user_id": ACTOR, "query": "FLOW1 LOCAL STEEL", "types": ["document"],
        })
    assert response.status_code == 400
    assert "No active embedding model" in response.json()["detail"]
    assert not any(path.endswith("/p1_global_structured_search_bridge_v2") for _, path, _ in calls)


def test_structured_only_http_never_requires_semantic_configuration(database):
    _, calls = database
    with TestClient(app) as client:
        response = client.post("/v1/global-search", json={
            "actor_user_id": ACTOR, "query": "FLOW1 LOCAL STEEL", "types": ["product"],
        })
    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert not any(path.startswith("/rest/v1/knowledge_embedding_models?") for _, path, _ in calls)


def test_missing_membership_is_denied_before_optional_retrieval(database):
    state, calls = database
    state["member"] = False
    with TestClient(app) as client:
        response = client.post("/v1/global-search", json={
            "actor_user_id": ACTOR, "query": "FLOW1 LOCAL STEEL",
        })
    assert response.status_code == 400
    assert "organization access" in response.json()["detail"]
    assert len(calls) == 1


def test_model_registry_database_error_is_not_silently_swallowed(database):
    state, _ = database
    state["model_error"] = RepositoryError("Synthetic registry failure")
    with TestClient(app) as client:
        response = client.post("/v1/global-search", json={
            "actor_user_id": ACTOR, "query": "FLOW1 LOCAL STEEL",
        })
    assert response.status_code == 400
    assert response.json()["detail"] == "Synthetic registry failure"


def test_provider_failure_is_not_silently_swallowed(database, monkeypatch):
    state, _ = database
    state["model"] = {"model_key": "synthetic", "model_name": "synthetic", "dimensions": 3}

    class FailingProvider:
        async def embed(self, *args, **kwargs):
            raise EmbeddingProviderError("Synthetic provider unavailable")

    monkeypatch.setattr(retrieval, "HuggingFaceEmbeddingProvider", FailingProvider)
    with TestClient(app) as client:
        response = client.post("/v1/global-search", json={
            "actor_user_id": ACTOR, "query": "FLOW1 LOCAL STEEL",
        })
    assert response.status_code == 400
    assert response.json()["detail"] == "Synthetic provider unavailable"
