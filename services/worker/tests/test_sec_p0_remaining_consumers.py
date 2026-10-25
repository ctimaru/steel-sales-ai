"""Credential retirement regressions; synthetic keys and intercepted HTTP only."""
import asyncio

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app import bulk_import, bulk_import_api, data_lifecycle, evidence
from app import market, observability, price_list_import, queries, tenant_admin


@pytest.fixture
def new_key_only(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_synthetic_cutover")
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    return "sb_secret_synthetic_cutover"


@pytest.mark.parametrize("factory", [
    bulk_import.BulkImportService, evidence.EvidenceService,
    market.MarketRepository, tenant_admin.TenantAdminService,
])
def test_api_consumers_initialize_after_legacy_key_removed(new_key_only, factory):
    service = factory()
    assert service.key == new_key_only
    if hasattr(service, "headers"):
        assert service.headers["apikey"] == new_key_only
        assert "Authorization" not in service.headers


@pytest.mark.parametrize("module", [queries, market, data_lifecycle])
def test_configuration_failure_preserves_existing_error_contract(monkeypatch, module):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    if module is data_lifecycle:
        with pytest.raises(HTTPException) as error:
            module._supabase_config()
        assert error.value.status_code == 503
    else:
        error_type = queries.QueryConfigurationError if module is queries else market.MarketConfigurationError
        with pytest.raises(error_type):
            module._configuration()


def test_observability_is_optional_when_privileged_config_missing(monkeypatch):
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    assert observability._supabase_config() is None


@pytest.mark.parametrize("module", [queries, data_lifecycle, observability])
def test_rest_wire_uses_apikey_without_secret_bearer(new_key_only, monkeypatch, module):
    captured = []

    def handle(request):
        captured.append(request)
        assert request.headers["apikey"] == new_key_only
        assert "authorization" not in request.headers
        return httpx.Response(200, json=[] if module is queries else {"ok": True})

    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(
        **kw, transport=httpx.MockTransport(handle), trust_env=False,
    ))
    if module is queries:
        assert asyncio.run(queries._rpc_rows("synthetic_rpc", {})) == []
    else:
        assert asyncio.run(module._supabase_request("POST", "/rest/v1/rpc/synthetic")) == {"ok": True}
    assert len(captured) == 1


def test_observability_persists_with_new_key_only(new_key_only, monkeypatch):
    captured = []

    def handle(request):
        captured.append(request)
        assert request.headers["apikey"] == new_key_only
        assert "authorization" not in request.headers
        assert request.headers["Prefer"] == "return=minimal"
        return httpx.Response(201)

    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(
        **kw, transport=httpx.MockTransport(handle), trust_env=False,
    ))
    monkeypatch.setenv("OBSERVABILITY_PERSIST", "true")
    asyncio.run(observability._persist_event({"operation": "synthetic"}))
    assert len(captured) == 1


@pytest.mark.parametrize("existing_identity", [False, True])
def test_invitation_auth_wire_accepts_new_key_without_bearer(new_key_only, monkeypatch, existing_identity):
    from supabase_auth import SyncGoTrueClient

    captured = []

    def handle(request):
        captured.append(request)
        assert request.headers["apikey"] == new_key_only
        assert "authorization" not in request.headers
        if existing_identity:
            assert request.url.path == "/auth/v1/otp"
            return httpx.Response(200, json={})
        assert request.url.path == "/auth/v1/invite"
        return httpx.Response(200, json={
            "id": "00000000-0000-0000-0000-000000000001",
            "aud": "authenticated", "created_at": "2026-10-25T00:00:00Z",
            "app_metadata": {}, "user_metadata": {},
        })

    service = tenant_admin.TenantAdminService()
    with httpx.Client(transport=httpx.MockTransport(handle), trust_env=False) as http_client:
        auth = SyncGoTrueClient(
            url=service.base_url + "/auth/v1", http_client=http_client,
            headers=service.headers, auto_refresh_token=False, persist_session=False,
        )
        monkeypatch.setattr(service, "_auth_client", lambda: auth)
        outcome = asyncio.run(service._send_auth_invite(
            email="synthetic@example.test", redirect_to="https://example.test/auth/finish",
            existing_identity=existing_identity,
        ))
    assert outcome == ("magic_link" if existing_identity else "invite")
    assert len(captured) == 1


@pytest.mark.parametrize("factory", [bulk_import.BulkImportService, evidence.EvidenceService])
@pytest.mark.parametrize("legacy", [False, True])
def test_storage_signing_wire_preserves_key_header_policy(new_key_only, monkeypatch, factory, legacy):
    key = new_key_only
    if legacy:
        key = "synthetic-legacy-jwt"
        monkeypatch.delenv("SUPABASE_SECRET_KEY")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", key)
    bucket = factory()._storage_client()

    def handle(request):
        assert request.headers["apikey"] == key
        if legacy:
            assert request.headers["authorization"] == "Bearer " + key
        else:
            assert "authorization" not in request.headers
        return httpx.Response(200, json={"signedURL": "/object/sign/synthetic?token=synthetic"})

    bucket._client.close()
    with httpx.Client(transport=httpx.MockTransport(handle), trust_env=False) as client:
        bucket._client = client
        assert bucket.create_signed_url("synthetic/file.pdf", 120)


@pytest.mark.parametrize("guard", [bulk_import._require_worker_token, price_list_import._require_worker_token])
@pytest.mark.parametrize("configured", [None, "", "   ", "synthetic-internal"])
def test_import_guards_deny_missing_configuration_and_bad_token(monkeypatch, guard, configured):
    if configured is None:
        monkeypatch.delenv("WORKER_INTERNAL_TOKEN", raising=False)
    else:
        monkeypatch.setenv("WORKER_INTERNAL_TOKEN", configured)
    for supplied in [None, "", "incorrect"]:
        with pytest.raises(HTTPException) as error:
            guard(supplied)
        assert error.value.status_code == (401 if configured and configured.strip() else 503)
    if configured and configured.strip():
        assert guard(configured) is None


def test_bulk_endpoint_denies_before_constructing_privileged_service(monkeypatch):
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN", raising=False)
    app = FastAPI()
    app.include_router(bulk_import_api.router)
    with TestClient(app) as client:
        response = client.post("/v1/import-batches/prepare", json={
            "actor_user_id": "00000000-0000-0000-0000-000000000001",
            "files": [{"filename": "synthetic.pdf", "size_bytes": 10, "content_checksum": "a" * 64}],
        })
    assert response.status_code == 503
