import io
import zipfile
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.data_lifecycle as lifecycle


def _app() -> FastAPI:
    app = FastAPI()
    app.include_router(lifecycle.router)
    return app


def _manifest(org_id):
    return {
        "contract": lifecycle.CONTRACT,
        "organization": {"id": str(org_id), "slug": "tenant-a", "name": "Tenant A"},
        "storage": {"object_count": 1, "paths": ["2026/09/15/example.pdf"]},
        "table_counts": {"companies": 1},
    }


def test_ops_token_is_required(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "ops-secret")
    with TestClient(_app()) as client:
        response = client.get(f"/v1/ops/data-lifecycle/tenants/{uuid4()}/export-manifest")
    assert response.status_code == 401


def test_export_archive_contains_database_manifest_and_storage(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "ops-secret")
    org_id = uuid4()
    calls = []

    async def fake_request(method, path, *, json_body=None):
        calls.append((method, path, json_body))
        if path.endswith("/tenant_export_manifest"):
            return _manifest(org_id)
        if path.endswith("/tenant_export_snapshot"):
            return {
                "contract": lifecycle.CONTRACT,
                "manifest": _manifest(org_id),
                "tables": {"companies": [{"name": "Acme"}]},
            }
        if path.endswith("/record_data_lifecycle_event"):
            return str(uuid4())
        raise AssertionError(path)

    async def fake_download(path):
        assert path == "2026/09/15/example.pdf"
        return b"%PDF-test"

    monkeypatch.setattr(lifecycle, "_supabase_request", fake_request)
    monkeypatch.setattr(lifecycle, "_download_storage_object", fake_download)

    with TestClient(_app()) as client:
        response = client.get(
            f"/v1/ops/data-lifecycle/tenants/{org_id}/export",
            headers={"X-Worker-Token": "ops-secret"},
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/zip")
    with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
        assert set(zf.namelist()) == {
            "manifest.json",
            "database.json",
            "RESTORE-NOTES.txt",
            "storage/2026/09/15/example.pdf",
        }
        assert zf.read("storage/2026/09/15/example.pdf") == b"%PDF-test"
        assert b"Acme" in zf.read("database.json")

    assert any(path.endswith("/record_data_lifecycle_event") for _, path, _ in calls)


def test_delete_requires_exact_confirmation_before_storage_mutation(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "ops-secret")
    org_id = uuid4()
    storage_calls = []

    async def fake_request(method, path, *, json_body=None):
        if path.endswith("/tenant_export_manifest"):
            return _manifest(org_id)
        raise AssertionError("database deletion should not be reached")

    async def fake_delete(paths):
        storage_calls.append(paths)
        return len(paths)

    monkeypatch.setattr(lifecycle, "_supabase_request", fake_request)
    monkeypatch.setattr(lifecycle, "_delete_storage_objects", fake_delete)

    with TestClient(_app()) as client:
        response = client.delete(
            f"/v1/ops/data-lifecycle/tenants/{org_id}?confirmation=wrong-value",
            headers={"X-Worker-Token": "ops-secret"},
        )

    assert response.status_code == 400
    assert storage_calls == []


def test_delete_removes_storage_before_database_rpc(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "ops-secret")
    org_id = uuid4()
    sequence = []

    async def fake_request(method, path, *, json_body=None):
        if path.endswith("/tenant_export_manifest"):
            sequence.append("manifest")
            return _manifest(org_id)
        if path.endswith("/delete_tenant_data"):
            sequence.append("database")
            assert json_body["p_confirmation_slug"] == "DELETE:tenant-a"
            assert json_body["p_storage_deleted"] is True
            assert json_body["p_dry_run"] is False
            return {"contract": lifecycle.CONTRACT, "deleted": True}
        raise AssertionError(path)

    async def fake_delete(paths):
        sequence.append("storage")
        assert paths == ["2026/09/15/example.pdf"]
        return 1

    monkeypatch.setattr(lifecycle, "_supabase_request", fake_request)
    monkeypatch.setattr(lifecycle, "_delete_storage_objects", fake_delete)

    with TestClient(_app()) as client:
        response = client.delete(
            f"/v1/ops/data-lifecycle/tenants/{org_id}?confirmation=DELETE%3Atenant-a",
            headers={"X-Worker-Token": "ops-secret"},
        )

    assert response.status_code == 200
    assert response.json()["storage_objects_deleted"] == 1
    assert sequence == ["manifest", "storage", "database"]


def test_retention_defaults_to_dry_run(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "ops-secret")

    async def fake_request(method, path, *, json_body=None):
        assert path.endswith("/apply_operational_retention")
        assert json_body == {"p_dry_run": True}
        return {"contract": lifecycle.CONTRACT, "dry_run": True, "authoritative_tenant_rows_deleted": 0}

    monkeypatch.setattr(lifecycle, "_supabase_request", fake_request)

    with TestClient(_app()) as client:
        response = client.post(
            "/v1/ops/data-lifecycle/retention",
            headers={"X-Worker-Token": "ops-secret"},
        )

    assert response.status_code == 200
    assert response.json()["dry_run"] is True
    assert response.json()["authoritative_tenant_rows_deleted"] == 0
