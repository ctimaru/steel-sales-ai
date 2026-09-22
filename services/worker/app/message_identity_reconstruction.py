from __future__ import annotations

import asyncio
import os
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from supabase import ClientOptions, create_client

from .message_identity import extract_message_identity
from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository
from .retrieval_api import require_worker_token

BUCKET_NAME = os.getenv("SUPABASE_UPLOAD_BUCKET", "commercial-uploads")


class MessageReconstructionRequest(BaseModel):
    actor_user_id: UUID
    job_id: UUID


class MessageReconstructionError(RuntimeError):
    pass


class MessageReconstructionService:
    def __init__(self) -> None:
        self.repo = WorkerRepository()

    async def _membership_ok(self, actor_user_id: UUID, organization_id: str) -> bool:
        rows = await self.repo._request(
            "GET",
            "/rest/v1/organization_memberships"
            f"?user_id=eq.{actor_user_id}"
            f"&organization_id=eq.{organization_id}"
            "&status=eq.active&role=in.(admin,member)"
            "&select=user_id&limit=1",
        )
        return isinstance(rows, list) and bool(rows)

    def _storage_client(self):
        options = ClientOptions(auto_refresh_token=False, persist_session=False)
        return create_client(
            self.repo.base_url,
            self.repo.key,
            options=options,
        ).storage.from_(BUCKET_NAME)

    async def reconstruct(self, request: MessageReconstructionRequest) -> dict[str, object]:
        job = await self.repo.get_job(request.job_id)
        if not job:
            raise MessageReconstructionError("Worker job not found.")
        if job.get("extension") != ".eml":
            raise MessageReconstructionError("Historical reconstruction supports .eml jobs only.")
        organization_id = str(job.get("organization_id") or "")
        if not organization_id:
            raise MessageReconstructionError("Worker job has no organization.")
        if not await self._membership_ok(request.actor_user_id, organization_id):
            raise MessageReconstructionError("Active organization write membership required.")
        storage_path = str(job.get("storage_path") or "")
        if not storage_path:
            raise MessageReconstructionError("Worker job has no stored source object.")
        if not job.get("thread_id"):
            raise MessageReconstructionError("Worker job has no promoted commercial thread.")

        def download() -> object:
            return self._storage_client().download(storage_path)

        payload = await asyncio.to_thread(download)
        if not isinstance(payload, (bytes, bytearray)):
            raise MessageReconstructionError("Supabase Storage returned an invalid download payload.")

        identity = extract_message_identity(str(job["filename"]), bytes(payload))
        if identity is None:
            raise MessageReconstructionError("Stored source is not a supported email message.")

        await self.repo.persist_message_identity(
            job_id=request.job_id,
            identity=identity,
        )
        materialized = await self.repo.materialize_message_identity(request.job_id)
        return {
            "job_id": str(request.job_id),
            "identity": identity,
            "materialization": materialized,
        }


router = APIRouter(prefix="/v1/message-identity", tags=["message-identity"])


@router.post("/reconstruct")
async def reconstruct_message_identity(
    request: MessageReconstructionRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        return await MessageReconstructionService().reconstruct(request)
    except (
        MessageReconstructionError,
        RepositoryConfigurationError,
        RepositoryError,
        RuntimeError,
        ValueError,
    ) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
