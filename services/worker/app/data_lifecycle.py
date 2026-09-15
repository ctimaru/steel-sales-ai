from __future__ import annotations

import hmac
import io
import json
import os
import re
import zipfile
from datetime import UTC, datetime
from typing import Any, AsyncIterator
from urllib.parse import quote
from uuid import UUID

import httpx
from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import StreamingResponse

CONTRACT = "p0.10-v1"
BUCKET_NAME = os.getenv("SUPABASE_UPLOAD_BUCKET", "commercial-uploads")
ARCHIVE_CHUNK_SIZE = 1024 * 1024

router = APIRouter(prefix="/v1/ops/data-lifecycle", tags=["operations", "data-lifecycle"])


def _require_ops_token(x_worker_token: str | None) -> None:
    expected = os.getenv("WORKER_INTERNAL_TOKEN", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Worker internal token is not configured.")
    if not hmac.compare_digest(x_worker_token or "", expected):
        raise HTTPException(status_code=401, detail="Invalid worker token.")


def _supabase_config() -> tuple[str, str]:
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base_url or not key:
        raise HTTPException(status_code=503, detail="Data lifecycle backend is not configured.")
    return base_url, key


def _service_headers(*, content_type: str = "application/json") -> dict[str, str]:
    _, key = _supabase_config()
    return {
        "Authorization": f"Bearer {key}",
        "apikey": key,
        "Content-Type": content_type,
    }


async def _supabase_request(method: str, path: str, *, json_body: Any = None) -> Any:
    base_url, _ = _supabase_config()
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.request(
                method,
                f"{base_url}{path}",
                headers=_service_headers(),
                json=json_body,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Data lifecycle backend unavailable.") from exc

    if response.is_error:
        raise HTTPException(
            status_code=503,
            detail=f"Data lifecycle backend returned HTTP {response.status_code}.",
        )
    if not response.content:
        return None
    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Data lifecycle backend returned invalid JSON.") from exc


async def _download_storage_object(path: str) -> bytes:
    base_url, _ = _supabase_config()
    encoded_path = quote(path.lstrip("/"), safe="/")
    endpoint = f"{base_url}/storage/v1/object/authenticated/{quote(BUCKET_NAME, safe='')}/{encoded_path}"
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.get(endpoint, headers=_service_headers(content_type="application/octet-stream"))
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Storage export backend unavailable.") from exc
    if response.is_error:
        raise HTTPException(
            status_code=503,
            detail=f"Storage export failed with HTTP {response.status_code}.",
        )
    return response.content


async def _delete_storage_objects(paths: list[str]) -> int:
    clean_paths = sorted({path.lstrip("/") for path in paths if path and path.strip()})
    if not clean_paths:
        return 0

    base_url, _ = _supabase_config()
    endpoint = f"{base_url}/storage/v1/object/{quote(BUCKET_NAME, safe='')}"
    deleted = 0
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            for start in range(0, len(clean_paths), 1000):
                batch = clean_paths[start : start + 1000]
                response = await client.request(
                    "DELETE",
                    endpoint,
                    headers=_service_headers(),
                    json={"prefixes": batch},
                )
                if response.is_error:
                    raise HTTPException(
                        status_code=503,
                        detail=f"Storage deletion failed with HTTP {response.status_code}.",
                    )
                deleted += len(batch)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Storage deletion backend unavailable.") from exc
    return deleted


def _storage_paths(manifest: dict[str, Any]) -> list[str]:
    storage = manifest.get("storage")
    if not isinstance(storage, dict):
        return []
    paths = storage.get("paths")
    if not isinstance(paths, list):
        return []
    return [str(path) for path in paths if isinstance(path, str) and path.strip()]


def _safe_archive_path(path: str) -> str:
    segments = [
        re.sub(r"[^A-Za-z0-9._ -]", "_", segment)
        for segment in path.replace("\\", "/").split("/")
        if segment not in {"", ".", ".."}
    ]
    if not segments:
        return "unnamed-object"
    return "/".join(segments)


async def _manifest(organization_id: UUID) -> dict[str, Any]:
    result = await _supabase_request(
        "POST",
        "/rest/v1/rpc/tenant_export_manifest",
        json_body={"p_organization_id": str(organization_id)},
    )
    if not isinstance(result, dict) or result.get("contract") != CONTRACT:
        raise HTTPException(status_code=503, detail="Tenant export manifest returned an invalid payload.")
    return result


async def _record_lifecycle_event(
    *,
    action: str,
    status: str,
    organization_id: UUID | None,
    organization_slug: str | None,
    details: dict[str, Any],
) -> None:
    await _supabase_request(
        "POST",
        "/rest/v1/rpc/record_data_lifecycle_event",
        json_body={
            "p_action": action,
            "p_status": status,
            "p_organization_id": str(organization_id) if organization_id else None,
            "p_organization_slug": organization_slug,
            "p_details": details,
        },
    )


@router.get("/health")
async def data_lifecycle_health(
    x_worker_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_ops_token(x_worker_token)
    result = await _supabase_request("POST", "/rest/v1/rpc/data_lifecycle_health", json_body={})
    if not isinstance(result, dict):
        raise HTTPException(status_code=503, detail="Data lifecycle health returned an invalid payload.")
    return result


@router.post("/retention")
async def run_retention(
    dry_run: bool = Query(default=True),
    x_worker_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_ops_token(x_worker_token)
    result = await _supabase_request(
        "POST",
        "/rest/v1/rpc/apply_operational_retention",
        json_body={"p_dry_run": dry_run},
    )
    if not isinstance(result, dict):
        raise HTTPException(status_code=503, detail="Retention run returned an invalid payload.")
    return result


@router.get("/tenants/{organization_id}/export-manifest")
async def tenant_export_manifest(
    organization_id: UUID,
    x_worker_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_ops_token(x_worker_token)
    return await _manifest(organization_id)


@router.get("/tenants/{organization_id}/export")
async def tenant_export_archive(
    organization_id: UUID,
    x_worker_token: str | None = Header(default=None),
) -> StreamingResponse:
    _require_ops_token(x_worker_token)
    manifest = await _manifest(organization_id)
    snapshot = await _supabase_request(
        "POST",
        "/rest/v1/rpc/tenant_export_snapshot",
        json_body={"p_organization_id": str(organization_id)},
    )
    if not isinstance(snapshot, dict) or snapshot.get("contract") != CONTRACT:
        raise HTTPException(status_code=503, detail="Tenant export snapshot returned an invalid payload.")

    organization = manifest.get("organization") or {}
    slug = str(organization.get("slug") or organization_id)
    storage_paths = _storage_paths(manifest)

    archive = io.BytesIO()
    with zipfile.ZipFile(archive, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, default=str, indent=2, sort_keys=True))
        zf.writestr("database.json", json.dumps(snapshot, default=str, indent=2, sort_keys=True))
        zf.writestr(
            "RESTORE-NOTES.txt",
            "Steel Sales AI P0.10 tenant export.\n"
            "database.json contains customer-authoritative tenant data and provenance.\n"
            "storage/ contains raw uploaded objects. Rebuildable embeddings/chunks may be regenerated.\n",
        )
        for path in storage_paths:
            content = await _download_storage_object(path)
            zf.writestr(f"storage/{_safe_archive_path(path)}", content)
    archive.seek(0)

    await _record_lifecycle_event(
        action="tenant_export",
        status="completed",
        organization_id=organization_id,
        organization_slug=slug,
        details={
            "storage_object_count": len(storage_paths),
            "archive_scope": "authoritative_data_plus_storage",
        },
    )

    safe_slug = re.sub(r"[^A-Za-z0-9._-]", "-", slug).strip("-") or str(organization_id)
    filename = f"steel-sales-ai-{safe_slug}-{datetime.now(UTC):%Y%m%dT%H%M%SZ}.zip"

    async def stream_archive() -> AsyncIterator[bytes]:
        try:
            while True:
                chunk = archive.read(ARCHIVE_CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk
        finally:
            archive.close()

    return StreamingResponse(
        stream_archive(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/tenants/{organization_id}/delete-preview")
async def tenant_delete_preview(
    organization_id: UUID,
    x_worker_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_ops_token(x_worker_token)
    result = await _supabase_request(
        "POST",
        "/rest/v1/rpc/delete_tenant_data",
        json_body={
            "p_organization_id": str(organization_id),
            "p_dry_run": True,
        },
    )
    if not isinstance(result, dict):
        raise HTTPException(status_code=503, detail="Tenant delete preview returned an invalid payload.")
    return result


@router.delete("/tenants/{organization_id}")
async def delete_tenant(
    organization_id: UUID,
    confirmation: str = Query(min_length=8, max_length=260),
    x_worker_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_ops_token(x_worker_token)
    manifest = await _manifest(organization_id)
    organization = manifest.get("organization") or {}
    slug = str(organization.get("slug") or "")
    required_confirmation = f"DELETE:{slug}"
    if not slug or confirmation != required_confirmation:
        raise HTTPException(
            status_code=400,
            detail=f"confirmation must exactly equal {required_confirmation!r}.",
        )

    storage_paths = _storage_paths(manifest)
    deleted_storage_count = await _delete_storage_objects(storage_paths)

    result = await _supabase_request(
        "POST",
        "/rest/v1/rpc/delete_tenant_data",
        json_body={
            "p_organization_id": str(organization_id),
            "p_confirmation_slug": confirmation,
            "p_storage_deleted": True,
            "p_dry_run": False,
        },
    )
    if not isinstance(result, dict) or result.get("deleted") is not True:
        raise HTTPException(status_code=503, detail="Tenant database deletion returned an invalid payload.")
    result["storage_objects_deleted"] = deleted_storage_count
    return result
