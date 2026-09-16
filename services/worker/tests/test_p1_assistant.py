from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import p1_assistant


app = FastAPI()
app.include_router(p1_assistant.router)
client = TestClient(app)


def configure_service(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key-not-a-real-secret")


def test_p1_assistant_requires_internal_token(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "assistant-secret")
    response = client.post(
        "/v1/assistant",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001", "query": "ultimo prezzo P265GH"},
    )
    assert response.status_code == 401
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN")


def test_p1_assistant_verifies_membership_and_adds_structured_evidence(monkeypatch) -> None:
    configure_service(monkeypatch)
    actor_id = UUID("00000000-0000-0000-0000-000000000001")
    seen = {}

    async def fake_request(self, method, path, *, json=None, prefer=None):
        assert method == "GET"
        assert path.startswith("/rest/v1/organization_memberships")
        return [{
            "organization_id": "00000000-0000-0000-0000-000000000010",
            "user_id": str(actor_id),
            "role": "member",
            "is_default": True,
            "created_at": "2026-09-16T00:00:00+00:00",
        }]

    async def fake_answer_assistant(*, owner_id, query, context=None):
        seen["owner_id"] = owner_id
        seen["query"] = query
        return {
            "intent": "latest_price",
            "found": True,
            "answer": "L'ultimo prezzo offerto è 68,38 €/m.",
            "filters": {"grade": "P265GH"},
            "context": {"intent": "latest_price", "filters": {"grade": "P265GH"}},
            "observations": [{
                "id": 1,
                "thread_id": "00000000-0000-0000-0000-000000000020",
                "grade": "P265GH",
                "standard": "EN 10224",
                "outer_diameter_mm": 406.4,
                "thickness_mm": 6.3,
                "length_mm": 12000,
                "price_value": 68.38,
                "price_unit": "M",
                "currency": "EUR",
                "source_text": "P265GH 406,4x6,3x12000 EN10224 68,38 EUR/mt",
                "source_filename": "offer.eml",
                "thread_subject": "Offerta P265GH",
                "commercial_at": "2026-09-03T10:00:00+00:00",
            }],
            "grounding": {"mode": "structured_query", "status": "grounded"},
        }

    monkeypatch.setattr(p1_assistant.WorkerRepository, "_request", fake_request)
    monkeypatch.setattr(p1_assistant, "answer_assistant", fake_answer_assistant)

    response = client.post(
        "/v1/assistant",
        json={"actor_user_id": str(actor_id), "query": "ultimo prezzo P265GH 406,4x6,3"},
    )
    assert response.status_code == 200
    body = response.json()
    assert seen["owner_id"] == actor_id
    assert body["access"] == {"membership_verified": True, "role": "member"}
    assert body["evidence"][0]["citation_id"] == "S1"
    assert body["evidence"][0]["source_locator"]["thread_id"].endswith("0020")
    assert "[S1]" in body["answer"]
    assert body["grounding"]["citations"] == ["S1"]


def test_p1_assistant_preserves_grounded_rag_evidence(monkeypatch) -> None:
    configure_service(monkeypatch)

    async def fake_request(self, method, path, *, json=None, prefer=None):
        return [{
            "organization_id": "00000000-0000-0000-0000-000000000010",
            "user_id": "00000000-0000-0000-0000-000000000001",
            "role": "viewer",
            "is_default": True,
            "created_at": "2026-09-16T00:00:00+00:00",
        }]

    async def fake_answer_assistant(*, owner_id, query, context=None):
        return {
            "intent": "knowledge_rag",
            "found": True,
            "answer": "La consegna prevista è ottobre/novembre. [S1]",
            "filters": {},
            "context": {"intent": "knowledge_rag", "filters": {}, "knowledge_query": query},
            "observations": [],
            "evidence": [{
                "citation_id": "S1",
                "chunk_id": "chunk-1",
                "source_id": "source-1",
                "document_id": "doc-1",
                "content": "Consegna ottobre/novembre",
                "title": "Offerta",
                "source_locator": {"thread_id": "thread-1"},
            }],
            "grounding": {"mode": "knowledge_rag", "status": "grounded", "citations": ["S1"]},
        }

    monkeypatch.setattr(p1_assistant.WorkerRepository, "_request", fake_request)
    monkeypatch.setattr(p1_assistant, "answer_assistant", fake_answer_assistant)

    response = client.post(
        "/v1/assistant",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001", "query": "cosa dice l'offerta?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["answer"].count("[S1]") == 1
    assert body["evidence"][0]["content"] == "Consegna ottobre/novembre"
    assert body["grounding"]["evidence_count"] == 1


def test_p1_assistant_rejects_actor_without_membership(monkeypatch) -> None:
    configure_service(monkeypatch)

    async def fake_request(self, method, path, *, json=None, prefer=None):
        return []

    monkeypatch.setattr(p1_assistant.WorkerRepository, "_request", fake_request)
    response = client.post(
        "/v1/assistant",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001", "query": "P265GH"},
    )
    assert response.status_code == 400
    assert "organization access" in response.json()["detail"]
