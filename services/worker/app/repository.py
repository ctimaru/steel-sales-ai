from __future__ import annotations

import os
from datetime import datetime
from typing import Any
from uuid import UUID

import httpx


class RepositoryConfigurationError(RuntimeError):
    pass


class RepositoryError(RuntimeError):
    pass


STAGING_OBSERVATION_FIELDS = (
    "source_filename",
    "source_text",
    "item_role",
    "grade",
    "standard",
    "outer_diameter_mm",
    "width_mm",
    "height_mm",
    "thickness_mm",
    "length_mm",
    "quantity",
    "quantity_unit",
    "price_value",
    "price_unit",
    "currency",
    "availability_status",
    "confidence",
    "metadata",
)


def normalize_observation(job_id: UUID, observation: dict[str, Any]) -> dict[str, Any]:
    """Return a stable PostgREST row shape for bulk staging inserts."""
    row = {
        "job_id": str(job_id),
        **{field: observation.get(field) for field in STAGING_OBSERVATION_FIELDS},
    }
    # public.worker_staging_observations.metadata is NOT NULL with default {}.
    # PostgREST only applies the default when the key is omitted; our stable bulk
    # shape includes the key, so missing metadata must be normalized explicitly.
    row["metadata"] = observation.get("metadata") or {}
    return row


class WorkerRepository:
    def __init__(self) -> None:
        self.base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.base_url or not self.key:
            raise RepositoryConfigurationError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
            )
        self.headers = {
            "Authorization": f"Bearer {self.key}",
            "apikey": self.key,
            "Content-Type": "application/json",
        }

    async def create_job(
        self,
        *,
        job_id: UUID,
        filename: str,
        extension: str,
        size_bytes: int,
        created_at: datetime,
    ) -> None:
        payload = {
            "id": str(job_id),
            "filename": filename,
            "extension": extension,
            "size_bytes": size_bytes,
            "status": "queued",
            "created_at": created_at.isoformat(),
        }
        await self._request("POST", "/rest/v1/worker_jobs", json=payload, prefer="return=minimal")

    async def update_job(self, job_id: UUID, values: dict[str, Any]) -> None:
        await self._request(
            "PATCH",
            f"/rest/v1/worker_jobs?id=eq.{job_id}",
            json=values,
            prefer="return=minimal",
        )

    async def insert_observations(
        self,
        *,
        job_id: UUID,
        observations: list[dict[str, Any]],
    ) -> None:
        if not observations:
            return
        rows = [normalize_observation(job_id, observation) for observation in observations]
        await self._request(
            "POST",
            "/rest/v1/worker_staging_observations",
            json=rows,
            prefer="return=minimal",
        )

    async def get_job(self, job_id: UUID) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            f"/rest/v1/worker_jobs?id=eq.{job_id}&select=*",
        )
        return rows[0] if rows else None

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        prefer: str | None = None,
    ) -> Any:
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(
                method,
                f"{self.base_url}{path}",
                headers=headers,
                json=json,
            )
        if response.is_error:
            detail = response.text.strip()
            suffix = f" Response: {detail[:500]}" if detail else ""
            raise RepositoryError(
                f"Supabase worker persistence failed with HTTP {response.status_code}.{suffix}"
            )
        if not response.content:
            return None
        return response.json()
