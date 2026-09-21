from __future__ import annotations

import asyncio
import os
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from supabase import ClientOptions, create_client

from .bulk_import import _require_worker_token
from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository

router = APIRouter(prefix="/v1/evidence", tags=["evidence"])

BUCKET_NAME = os.getenv("SUPABASE_UPLOAD_BUCKET", "commercial-uploads")
SIGNED_URL_TTL_SECONDS = 120


class EvidenceError(RuntimeError):
    pass


class EvidenceRequest(BaseModel):
    actor_user_id: UUID


class EvidenceResponse(BaseModel):
    observation_id: int
    filename: str
    signed_url: str
    expires_in: int


class EvidenceService:
    def __init__(self) -> None:
        self.repo = WorkerRepository()
        self.base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.base_url or not self.key:
            raise RepositoryConfigurationError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
            )

    async def _active_membership(self, actor_user_id: UUID) -> dict[str, object]:
        rows = await self.repo._request(
            "GET",
            "/rest/v1/organization_memberships"
            f"?user_id=eq.{actor_user_id}&status=eq.active"
            "&role=in.(admin,member,viewer)"
            "&select=organization_id,user_id,role,is_default,created_at"
            "&order=is_default.desc,created_at.asc&limit=1",
        )
        if not isinstance(rows, list) or not rows:
            raise EvidenceError("Active organization access is required.")
        return rows[0]

    def _storage_client(self):
        options = ClientOptions(auto_refresh_token=False, persist_session=False)
        return create_client(self.base_url, self.key, options=options).storage.from_(BUCKET_NAME)

    async def resolve(self, observation_id: int, actor_user_id: UUID) -> dict[str, object]:
        membership = await self._active_membership(actor_user_id)
        organization_id = str(membership.get("organization_id") or "")
        if not organization_id:
            raise EvidenceError("Active organization is missing from membership.")

        observations = await self.repo._request(
            "GET",
            "/rest/v1/commercial_observations"
            f"?id=eq.{observation_id}&organization_id=eq.{organization_id}"
            "&select=id,organization_id,source_filename,source_extraction_id&limit=1",
        )
        if not isinstance(observations, list) or not observations:
            raise EvidenceError("Evidence not found for the active organization.")
        observation = observations[0]

        source_extraction_id = observation.get("source_extraction_id")
        if source_extraction_id is None:
            raise EvidenceError("Original file lineage is not available for this observation.")

        staging = await self.repo._request(
            "GET",
            "/rest/v1/worker_staging_observations"
            f"?id=eq.{source_extraction_id}&select=id,job_id&limit=1",
        )
        if not isinstance(staging, list) or not staging or not staging[0].get("job_id"):
            raise EvidenceError("Worker lineage is not available for this observation.")

        jobs = await self.repo._request(
            "GET",
            "/rest/v1/worker_jobs"
            f"?id=eq.{staging[0]['job_id']}&organization_id=eq.{organization_id}"
            "&select=id,organization_id,filename,storage_path&limit=1",
        )
        if not isinstance(jobs, list) or not jobs:
            raise EvidenceError("Original file is not available for the active organization.")
        job = jobs[0]
        storage_path = str(job.get("storage_path") or "")
        required_prefix = f"organizations/{organization_id}/"
        if not storage_path or not storage_path.startswith(required_prefix):
            raise EvidenceError("Original file storage path failed tenant validation.")

        def create_signed_url() -> object:
            return self._storage_client().create_signed_url(
                storage_path,
                SIGNED_URL_TTL_SECONDS,
                {"download": True},
            )

        result = await asyncio.to_thread(create_signed_url)
        if not isinstance(result, dict):
            raise EvidenceError("Supabase Storage returned an invalid signed URL payload.")
        signed_url = result.get("signed_url") or result.get("signedURL")
        if not isinstance(signed_url, str) or not signed_url.startswith(("https://", "http://")):
            raise EvidenceError("Supabase Storage signed URL is missing.")

        return {
            "observation_id": observation_id,
            "filename": str(job.get("filename") or observation.get("source_filename") or "source"),
            "signed_url": signed_url,
            "expires_in": SIGNED_URL_TTL_SECONDS,
        }


@router.post("/{observation_id}", response_model=EvidenceResponse)
async def open_original_evidence(
    observation_id: int,
    request: EvidenceRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> EvidenceResponse:
    _require_worker_token(x_worker_token)
    try:
        payload = await EvidenceService().resolve(observation_id, request.actor_user_id)
        return EvidenceResponse(**payload)
    except (RepositoryConfigurationError, RepositoryError, EvidenceError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
