"""SEC-P0-CLOSE1D.5: synthetic membership isolation, no real users or credentials."""
import asyncio
from uuid import UUID
import pytest
from app import global_search


A = UUID("00000000-0000-4000-8000-000000000101")
B = UUID("00000000-0000-4000-8000-000000000102")
ORG_A = "00000000-0000-4000-8000-000000000201"
ORG_B = "00000000-0000-4000-8000-000000000202"


def test_each_actor_resolves_only_own_active_membership(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_synthetic_dummy")
    calls = []
    async def fake_request(self, method, path, *, json=None, prefer=None):
        assert method == "GET"
        assert path.startswith("/rest/v1/organization_memberships?")
        assert "status=eq.active" in path
        calls.append(path)
        if f"user_id=eq.{A}" in path:
            return [{"user_id": str(A), "organization_id": ORG_A, "role": "member"}]
        if f"user_id=eq.{B}" in path:
            return [{"user_id": str(B), "organization_id": ORG_B, "role": "viewer"}]
        return []
    monkeypatch.setattr(global_search.WorkerRepository, "_request", fake_request)
    service = global_search.GlobalSearchService()
    a = asyncio.run(service._active_membership(A))
    b = asyncio.run(service._active_membership(B))
    assert a["organization_id"] == ORG_A
    assert b["organization_id"] == ORG_B
    assert a["organization_id"] != b["organization_id"]
    assert len(calls) == 2


def test_inactive_or_unrecognized_actor_is_denied(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_synthetic_dummy")
    async def empty_membership(self, method, path, *, json=None, prefer=None):
        assert "status=eq.active" in path
        return []
    monkeypatch.setattr(global_search.WorkerRepository, "_request", empty_membership)
    with pytest.raises(global_search.GlobalSearchError, match="Active organization access"):
        asyncio.run(global_search.GlobalSearchService()._active_membership(A))
