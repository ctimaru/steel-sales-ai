from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile, status

from .main import require_worker_token
from .offer_reparse import execute_offer_source_reparse
from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository
from .storage import StorageConfigurationError, StorageUploadError, upload_private_object

router = APIRouter(prefix="/v1/remediation", tags=["remediation"])
MAX_SOURCE_BYTES = 25 * 1024 * 1024
UPLOAD_CHUNK_SIZE = 1024 * 1024


async def _read_source(upload: UploadFile) -> bytes:
    content = bytearray()
    while chunk := await upload.read(UPLOAD_CHUNK_SIZE):
        content.extend(chunk)
        if len(content) > MAX_SOURCE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Source re-ingest exceeds the 25 MB limit.",
            )
    if not content:
        raise HTTPException(status_code=400, detail="Source re-ingest file is empty.")
    return bytes(content)


@router.post("/offer-source-reingest/{reingest_id}")
async def offer_source_reingest(
    reingest_id: int,
    upload: Annotated[UploadFile, File(...)],
    owner_id: Annotated[str, Form(...)],
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    if reingest_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid re-ingest id.")

    try:
        parsed_owner = UUID(owner_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid owner id.") from exc

    repo = WorkerRepository()
    claim = await repo.claim_offer_source_reingest(
        reingest_id=reingest_id,
        owner_id=parsed_owner,
    )
    if claim.get("status") != "claimed":
        code = 404 if claim.get("status") == "not_found" else 409
        raise HTTPException(status_code=code, detail=str(claim.get("reason") or claim.get("status")))

    filename = Path(upload.filename or "").name
    extension = Path(filename).suffix.lower()
    if not filename or extension != ".eml":
        await repo.fail_offer_source_reingest(
            reingest_id=reingest_id,
            error="PA2.30.3 source recovery requires an .eml original source.",
        )
        raise HTTPException(status_code=415, detail="Per questo recovery è richiesto il file EML originale.")

    try:
        content = await _read_source(upload)
        checksum = hashlib.sha256(content).hexdigest()
        source_job_id = uuid4()
        created_at = datetime.now(UTC)
        storage_path = await upload_private_object(
            content=content,
            filename=filename,
            extension=extension,
            job_id=source_job_id,
            created_at=created_at,
        )
        completed = await repo.complete_offer_source_reingest(
            reingest_id=reingest_id,
            source_job_id=source_job_id,
            filename=filename,
            storage_path=storage_path,
            content_checksum=checksum,
            size_bytes=len(content),
        )
        successor_run_id = completed.get("successor_run_id")
        if completed.get("status") != "consumed" or not isinstance(successor_run_id, int):
            raise RepositoryError("Source re-ingest did not create a successor reparse run.")

        reparse = await execute_offer_source_reparse(successor_run_id)
        return {
            **completed,
            "source_checksum_verified": True,
            "source_size_bytes": len(content),
            "reparse": reparse,
        }
    except (
        RepositoryConfigurationError,
        RepositoryError,
        StorageConfigurationError,
        StorageUploadError,
        ValueError,
        RuntimeError,
        KeyError,
    ) as exc:
        try:
            await repo.fail_offer_source_reingest(
                reingest_id=reingest_id,
                error=str(exc),
            )
        except (RepositoryConfigurationError, RepositoryError):
            pass
        if isinstance(exc, (StorageConfigurationError, StorageUploadError)):
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        if isinstance(exc, (RepositoryConfigurationError, RepositoryError)):
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        raise HTTPException(status_code=422, detail=str(exc)) from exc
