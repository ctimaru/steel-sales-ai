from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import global_search


app = FastAPI()
app.include_router(global_search.router)
client = TestClient(app)


def configure_service(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key-not-a-real-secret")


def test_global_search_requires_internal_token(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "global-secret")
    response = client.post(
        "/v1/global-search",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001", "query": "P265GH"},
    )
    assert response.status_code == 401
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN")


def test_global_search_resolves_tenant_and_combines_semantic_structured(monkeypatch) -> None:
    configure_service(monkeypatch)
    actor_id = UUID("00000000-0000-0000-0000-000000000001")
    organization_id = "00000000-0000-0000-0000-000000000010"
    calls: list[tuple[str, str, object]] = []

    async def fake_request(self, method, path, *, json=None, prefer=None):
        calls.append((method, path, json))
        if path.startswith("/rest/v1/organization_memberships"):
            return [{
                "organization_id": organization_id,
                "user_id": str(actor_id),
                "role": "admin",
                "is_default": True,
                "created_at": "2026-09-16T00:00:00+00:00",
            }]
        if path == "/rest/v1/rpc/p1_global_structured_search_bridge":
            assert json["p_organization_id"] == organization_id
            assert json["p_filters"]["price_min"] == 60.0
            assert json["p_filters"]["outer_diameter_mm"] == 406.4
            return {
                "counts": {"offer": 1},
                "total": 1,
                "results": [{
                    "result_type": "offer",
                    "result_id": "observation:1",
                    "title": "Offerta P265GH",
                    "subtitle": "P265GH · EN 10224",
                    "snippet": "68,38 EUR/mt",
                    "event_at": "2026-09-10T10:00:00+00:00",
                    "role": "offered",
                    "grade": "P265GH",
                    "standard": "EN 10224",
                    "product_type": "round_tube",
                    "outer_diameter_mm": 406.4,
                    "width_mm": None,
                    "height_mm": None,
                    "thickness_mm": 6.3,
                    "length_mm": 12000,
                    "quantity": None,
                    "quantity_unit": None,
                    "price_value": 68.38,
                    "price_unit": "M",
                    "currency": "EUR",
                    "source_filename": "offer.eml",
                    "thread_id": "00000000-0000-0000-0000-000000000020",
                    "score": 0.9,
                    "metadata": {
                        "source_model": "normalized_promoted",
                        "normalized_entity_type": "offer_line",
                        "normalized_entity_id": "00000000-0000-0000-0000-000000000040",
                    },
                }],
            }
        if path.startswith("/rest/v1/offer_lines?"):
            assert f"organization_id=eq.{organization_id}" in path
            return [{
                "id": "00000000-0000-0000-0000-000000000040",
                "offer_id": "00000000-0000-0000-0000-000000000041",
            }]
        if path.startswith("/rest/v1/offers?"):
            assert f"organization_id=eq.{organization_id}" in path
            return [{
                "id": "00000000-0000-0000-0000-000000000041",
                "company_id": "00000000-0000-0000-0000-000000000042",
            }]
        if path == "/rest/v1/rpc/p1_resolve_shared_steel_reference":
            return {
                "resolution_status": "matched",
                "matched": True,
                "effective_status": "canonical_available",
                "calculation_allowed": True,
                "effective_weight_kg_m": 93.27,
                "contract_version": 1,
            }
        raise AssertionError(f"unexpected path: {path}")

    async def fake_semantic(**kwargs):
        assert kwargs["owner_id"] == actor_id
        assert kwargs["commercial_filters"]["price_min"] == 60.0
        assert kwargs["commercial_filters"]["outer_diameter_mm"] == 406.4
        return {
            "model": {"model_key": "e5", "model_name": "E5", "dimensions": 1024},
            "retrieval": {"strategy": "hybrid_rrf"},
            "results": [{
                "chunk_id": "00000000-0000-0000-0000-000000000030",
                "source_id": "00000000-0000-0000-0000-000000000031",
                "document_id": "00000000-0000-0000-0000-000000000032",
                "content": "P265GH offer evidence",
                "title": "Offer mail",
                "filename": "offer.eml",
                "document_type": "email",
                "source_name": "Commercial archive",
                "source_uri": None,
                "source_locator": {"thread_id": "00000000-0000-0000-0000-000000000020"},
                "page_start": None,
                "page_end": None,
                "section_path": None,
                "matched_entities": [],
                "vector_similarity": 0.9,
                "lexical_score": 0.4,
                "rrf_score": 0.95,
            }],
        }

    monkeypatch.setattr(global_search.WorkerRepository, "_request", fake_request)
    monkeypatch.setattr(global_search, "search_knowledge", fake_semantic)

    response = client.post(
        "/v1/global-search",
        json={
            "actor_user_id": str(actor_id),
            "query": "P265GH 406,4",
            "filters": {"outer_diameter_mm": 406.4, "price_min": 60},
            "limit": 20,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 2
    assert body["counts"]["document"] == 1
    assert body["counts"]["offer"] == 1
    assert body["results"][0]["result_type"] == "document"
    assert calls[0][1].startswith("/rest/v1/organization_memberships")
    assert calls[1][1] == "/rest/v1/rpc/p1_global_structured_search_bridge"
    offer = next(row for row in body["results"] if row["result_type"] == "offer")
    assert offer["metadata"]["shared_reference"]["resolution_status"] == "matched"
    assert offer["metadata"]["shared_reference"]["calculation_allowed"] is True
    assert offer["metadata"]["company_id"] == "00000000-0000-0000-0000-000000000042"
    assert offer["metadata"]["company_link_source"] == "normalized_business_entity"


def test_document_only_search_skips_structured_rpc(monkeypatch) -> None:
    configure_service(monkeypatch)

    async def fake_request(self, method, path, *, json=None, prefer=None):
        if path.startswith("/rest/v1/organization_memberships"):
            return [{
                "organization_id": "00000000-0000-0000-0000-000000000010",
                "user_id": "00000000-0000-0000-0000-000000000001",
                "role": "viewer",
                "is_default": True,
                "created_at": "2026-09-16T00:00:00+00:00",
            }]
        raise AssertionError("structured RPC must not run for document-only search")

    async def fake_semantic(**kwargs):
        return {"model": None, "retrieval": {}, "results": []}

    monkeypatch.setattr(global_search.WorkerRepository, "_request", fake_request)
    monkeypatch.setattr(global_search, "search_knowledge", fake_semantic)
    response = client.post(
        "/v1/global-search",
        json={
            "actor_user_id": "00000000-0000-0000-0000-000000000001",
            "query": "certificate",
            "types": ["document"],
        },
    )
    assert response.status_code == 200
    assert response.json()["count"] == 0


def test_global_search_rejects_actor_without_membership(monkeypatch) -> None:
    configure_service(monkeypatch)

    async def fake_request(self, method, path, *, json=None, prefer=None):
        return []

    monkeypatch.setattr(global_search.WorkerRepository, "_request", fake_request)
    response = client.post(
        "/v1/global-search",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001", "query": "P265GH"},
    )
    assert response.status_code == 400
    assert "organization access" in response.json()["detail"]
