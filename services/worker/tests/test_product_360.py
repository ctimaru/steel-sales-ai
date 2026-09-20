from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import product_360


app = FastAPI()
app.include_router(product_360.router)
client = TestClient(app)


def configure_service(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key-not-a-real-secret")


def membership(actor_id: UUID) -> dict[str, object]:
    return {
        "organization_id": "00000000-0000-0000-0000-000000000010",
        "user_id": str(actor_id),
        "role": "member",
        "is_default": True,
        "created_at": "2026-09-16T00:00:00+00:00",
    }


def test_product_catalog_requires_internal_token(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "product-secret")
    response = client.post(
        "/v1/products",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001"},
    )
    assert response.status_code == 401
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN")


def test_product_catalog_resolves_tenant_before_rpc(monkeypatch) -> None:
    configure_service(monkeypatch)
    actor_id = UUID("00000000-0000-0000-0000-000000000001")
    calls: list[tuple[str, str, object]] = []

    async def fake_request(self, method, path, *, json=None, prefer=None):
        calls.append((method, path, json))
        if path.startswith("/rest/v1/organization_memberships"):
            return [membership(actor_id)]
        if path == "/rest/v1/rpc/p1_product_catalog":
            assert json["p_organization_id"] == "00000000-0000-0000-0000-000000000010"
            assert json["p_query"] == "P265GH"
            return {"total": 1, "results": [{"canonical_product_id": "00000000-0000-0000-0000-000000000020"}]}
        if path == "/rest/v1/rpc/p1_resolve_shared_steel_reference":
            return {"resolution_status": "matched", "matched": True, "calculation_allowed": True, "effective_weight_kg_m": 28.26}
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(product_360.WorkerRepository, "_request", fake_request)
    response = client.post(
        "/v1/products",
        json={"actor_user_id": str(actor_id), "query": " P265GH ", "limit": 50},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["access"]["membership_verified"] is True
    assert body["shared_reference"]["effective_weight_kg_m"] == 28.26
    assert calls[0][1].startswith("/rest/v1/organization_memberships")
    assert calls[1][1] == "/rest/v1/rpc/p1_product_catalog"


def test_product_360_uses_verified_tenant_and_product_uuid(monkeypatch) -> None:
    configure_service(monkeypatch)
    actor_id = UUID("00000000-0000-0000-0000-000000000001")
    product_id = UUID("00000000-0000-0000-0000-000000000020")

    async def fake_request(self, method, path, *, json=None, prefer=None):
        if path.startswith("/rest/v1/organization_memberships"):
            return [membership(actor_id)]
        if path == "/rest/v1/rpc/p1_product_360":
            assert json == {
                "p_organization_id": "00000000-0000-0000-0000-000000000010",
                "p_product_id": str(product_id),
                "p_limit": 200,
            }
            return {
                "found": True,
                "product": {"canonical_product_id": str(product_id), "grade": "P265GH"},
                "summary": {"event_count": 3, "offered_count": 2},
                "latest_price": {"value": 72, "currency": "EUR", "unit": "M"},
                "price_history": [],
                "timeline": [],
                "documents": [],
                "counterparties": [],
            }
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(product_360.WorkerRepository, "_request", fake_request)
    response = client.post(
        f"/v1/products/{product_id}",
        json={"actor_user_id": str(actor_id)},
    )
    assert response.status_code == 200
    assert response.json()["product"]["grade"] == "P265GH"
    assert response.json()["summary"]["offered_count"] == 2
    assert response.json()["shared_reference"]["resolution_status"] == "matched"


def test_price_history_uses_verified_tenant_and_separates_rpc_contract(monkeypatch) -> None:
    configure_service(monkeypatch)
    actor_id = UUID("00000000-0000-0000-0000-000000000001")
    product_id = UUID("00000000-0000-0000-0000-000000000020")

    async def fake_request(self, method, path, *, json=None, prefer=None):
        if path.startswith("/rest/v1/organization_memberships"):
            return [membership(actor_id)]
        if path == "/rest/v1/rpc/p1_price_history":
            assert json == {
                "p_organization_id": "00000000-0000-0000-0000-000000000010",
                "p_product_id": str(product_id),
                "p_limit": 250,
                "p_comparable_limit": 20,
            }
            return {
                "found": True,
                "product": {"canonical_product_id": str(product_id), "theoretical_weight_kg_m": 17.7096},
                "latest_quote": {"value": 12, "unit": "M", "currency": "EUR"},
                "latest_order": {"value": 900, "unit": "T", "currency": "EUR"},
                "trend": {"quote": {"delta_pct": 20}, "order": None},
                "history": [],
                "comparables": [],
            }
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(product_360.WorkerRepository, "_request", fake_request)
    response = client.post(
        f"/v1/products/{product_id}/prices",
        json={"actor_user_id": str(actor_id)},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["latest_quote"]["value"] == 12
    assert body["latest_order"]["value"] == 900
    assert body["access"]["membership_verified"] is True


def test_product_360_rejects_actor_without_active_membership(monkeypatch) -> None:
    configure_service(monkeypatch)

    async def fake_request(self, method, path, *, json=None, prefer=None):
        return []

    monkeypatch.setattr(product_360.WorkerRepository, "_request", fake_request)
    response = client.post(
        "/v1/products/00000000-0000-0000-0000-000000000020",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001"},
    )
    assert response.status_code == 400
    assert "organization access" in response.json()["detail"]
