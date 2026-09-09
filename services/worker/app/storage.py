from __future__ import annotations

import os
from datetime import datetime
from pathlib import PurePosixPath
from uuid import UUID

import httpx

BUCKET_NAME = os.getenv("SUPABASE_UPLOAD_BUCKET", "commercial-uploads")
CONTENT_TYPES = {
    ".zip": "application/zip",
    ".eml": "message/rfc822",
    ".pdf": "application/pdf",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


class StorageConfigurationError(RuntimeError):
    pass


class StorageUploadError(RuntimeError):
    pass


def build_storage_path(job_id: UUID, filename: str, created_at: datetime) -> str:
    safe_name = PurePosixPath(filename).name.replace(" ", "_")
    return f"{created_at:%Y/%m/%d}/{job_id}-{safe_name}"


async def upload_private_object(
    *,
    content: bytes,
    filename: str,
    extension: str,
    job_id: UUID,
    created_at: datetime,
) -> str:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_role_key:
        raise StorageConfigurationError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Storage uploads."
        )

    path = build_storage_path(job_id, filename, created_at)
    endpoint = f"{supabase_url}/storage/v1/object/{BUCKET_NAME}/{path}"
    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": CONTENT_TYPES.get(extension, "application/octet-stream"),
        "x-upsert": "false",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(endpoint, content=content, headers=headers)
    if response.is_error:
        raise StorageUploadError(
            f"Supabase Storage upload failed with HTTP {response.status_code}."
        )
    return path
