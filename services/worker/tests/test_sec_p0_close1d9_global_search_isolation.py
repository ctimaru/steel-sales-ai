"""SEC-P0-CLOSE1D.9: synthetic HTTP acceptance at global-search boundary.

No production calls, customer records, JWTs or secrets. This checks Worker
membership resolution and structured result isolation. Hosted JWT E2E separate.
"""
from uuid import UUID
from fastapi.testclient import TestClient
from app.server import app
from app import global_search

A = "00000000-0000-4000-8000-000000000101"
B = "00000000-0000-4000-8000-000000000102"
ORG_A = "00000000-0000-4000-8000-000000000201"
ORG_B = "00000000-0000-4000-8000-000000000202"


def test_global_search_isolation_over_http(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_synthetic_dummy")
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "synthetic-ci-only-worker-token")
    observed = []

    async def fake_request(self, method, path, *, json=None, prefer=None):
        if path.startswith("/rest/v1/organization_memberships?"):
            assert "status=eq.active" in path
            if f"user_id=eq.{A}" in path:
                return [{"user_id": A, "organization_id": ORG_A, "role": "member"}]
            if f"user_id=eq.{B}" in path:
                return [{"user_id": B, "organization_id": ORG_B, "role": "member"}]
            return []
        if path == "/rest/v1/rpc/p1_global_structured_search_bridge_v2":
            owner = json["p_organization_id"]
            assert owner in (ORG_A, ORG_B)
            observed.append(owner)
            return {"counts": {"rfq": 1}, "total": 1, "results": [{
                "result_type": "rfq", "result_id": owner,
                "title": "PRIVATE " + owner, "score": 1.0, "metadata": {}
            }]}
        raise AssertionError("Unexpected request path")

    async def fake_enrich(repo, records):
        return records

    monkeypatch.setattr(global_search.WorkerRepository, "_request", fake_request)
    monkeypatch.setattr(global_search, "enrich_records_with_shared_reference", fake_enrich)
    with TestClient(app) as client:
        for actor, expected, foreign in ((A, ORG_A, ORG_B), (B, ORG_B, ORG_A)):
            response = client.post("/v1/global-search", json={
                "actor_user_id": actor, "query": "S355J2H", "types": ["rfq"], "limit": 5
            }, headers={"x-worker-token": "synthetic-ci-only-worker-token"})
            assert response.status_code == 200, response.text
            body = response.json()
            assert body["count"] == 1
            assert expected in str(body["results"])
            assert foreign not in str(body["results"])
        unauthorized = client.post("/v1/global-search", json={
            "actor_user_id": str(UUID("00000000-0000-4000-8000-000000000103")),
            "query": "S355J2H", "types": ["rfq"]
        }, headers={"x-worker-token": "synthetic-ci-only-worker-token"})
        assert unauthorized.status_code in (403, 404)
        anonymous = client.post("/v1/global-search", json={
            "actor_user_id": A, "query": "S355J2H", "types": ["rfq"]
        }, headers={"x-worker-token": "bad"})
        assert anonymous.status_code == 401
    assert observed == [ORG_A, ORG_B]
