from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import BackgroundTasks, FastAPI, File, Header, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict

from .parser_v31 import ParserInput, ParserV31Adapter
from .queries import latest_price
from .repository import (
    RepositoryConfigurationError,
    RepositoryError,
    WorkerRepository,
)
from .storage import StorageConfigurationError, upload_private_object

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
ALLOWED_EXTENSIONS = {".zip", ".eml", ".pdf", ".xls", ".xlsx"}
UPLOAD_CHUNK_SIZE = 1024 * 1024
parser = ParserV31Adapter()


class JobStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class UploadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: UUID
    filename: str
    extension: str
    size_bytes: int
    status: JobStatus
    created_at: datetime
    storage_path: str | None = None


class JobResponse(UploadResponse):
    error: str | None = None
    result: dict[str, object] | None = None


class LatestPriceRequest(BaseModel):
    grade: str | None = None
    outer_diameter_mm: float | None = None
    thickness_mm: float | None = None
    width_mm: float | None = None
    height_mm: float | None = None


@dataclass
class Job:
    job_id: UUID
    filename: str
    extension: str
    size_bytes: int
    created_at: datetime
    owner_id: UUID | None = None
    status: JobStatus = JobStatus.QUEUED
    storage_path: str | None = None
    error: str | None = None
    result: dict[str, object] | None = None
    _content: bytes = field(repr=False, default=b"")


jobs: dict[UUID, Job] = {}
app = FastAPI(
    title="Steel Sales AI Worker",
    version="0.1.0",
    description="Upload and asynchronous processing boundary for commercial documents.",
)


def durable_mode() -> bool:
    return os.getenv("WORKER_STORAGE_MODE", "supabase") != "memory"


def repository() -> WorkerRepository:
    return WorkerRepository()


def response_for(job: Job) -> JobResponse:
    return JobResponse(
        job_id=job.job_id,
        filename=job.filename,
        extension=job.extension,
        size_bytes=job.size_bytes,
        status=job.status,
        created_at=job.created_at,
        storage_path=job.storage_path,
        error=job.error,
        result=job.result,
    )


async def read_upload(upload: UploadFile) -> bytes:
    content = bytearray()
    while chunk := await upload.read(UPLOAD_CHUNK_SIZE):
        content.extend(chunk)
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Upload exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
            )
    return bytes(content)


async def process_job(job_id: UUID) -> None:
    job = jobs[job_id]
    repo = repository() if durable_mode() else None
    job.status = JobStatus.PROCESSING
    try:
        if repo:
            await repo.update_job(
                job_id,
                {"status": "processing", "started_at": datetime.now(UTC).isoformat()},
            )
        if os.getenv("WORKER_STORAGE_MODE", "supabase") == "memory":
            job.storage_path = f"memory://{job.job_id}/{job.filename}"
        else:
            job.storage_path = await upload_private_object(
                content=job._content,
                filename=job.filename,
                extension=job.extension,
                job_id=job.job_id,
                created_at=job.created_at,
            )
        prepared = parser.prepare(
            ParserInput(
                filename=job.filename,
                extension=job.extension,
                size_bytes=job.size_bytes,
                storage_path=job.storage_path,
            ),
            job._content,
        )
        job.result = {
            "parser_version": prepared.parser_version,
            "input_kind": prepared.input_kind,
            "processing_status": prepared.status,
            "storage_path": prepared.storage_path,
            "extraction_count": len(prepared.observations),
        }
        if repo:
            await repo.insert_observations(
                job_id=job.job_id,
                observations=prepared.observations,
            )
            promotion = await repo.promote_job(job.job_id)
            job.result["promotion"] = promotion
            await repo.update_job(
                job_id,
                {
                    "status": "completed",
                    "storage_path": job.storage_path,
                    "parser_version": prepared.parser_version,
                    "input_kind": prepared.input_kind,
                    "extraction_count": len(prepared.observations),
                    "completed_at": datetime.now(UTC).isoformat(),
                },
            )
        job.status = JobStatus.COMPLETED
    except (
        RepositoryConfigurationError,
        RepositoryError,
        StorageConfigurationError,
        ValueError,
        RuntimeError,
        KeyError,
    ) as exc:
        job.status = JobStatus.FAILED
        job.error = str(exc)
        if repo:
            try:
                await repo.update_job(
                    job_id,
                    {
                        "status": "failed",
                        "error": job.error,
                        "completed_at": datetime.now(UTC).isoformat(),
                    },
                )
            except RepositoryError:
                pass


def require_worker_token(x_worker_token: str | None) -> None:
    expected = os.getenv("WORKER_INTERNAL_TOKEN")
    if expected and x_worker_token != expected:
        raise HTTPException(status_code=401, detail="Invalid worker token.")


def parse_owner_id(x_owner_id: str | None) -> UUID | None:
    if not durable_mode():
        return UUID(x_owner_id) if x_owner_id else None
    if not x_owner_id:
        raise HTTPException(status_code=400, detail="Missing authenticated owner context.")
    try:
        return UUID(x_owner_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid owner context.") from exc


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/uploads", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_upload(
    background_tasks: BackgroundTasks,
    upload: Annotated[UploadFile, File(...)],
    x_worker_token: Annotated[str | None, Header()] = None,
    x_owner_id: Annotated[str | None, Header()] = None,
) -> UploadResponse:
    require_worker_token(x_worker_token)
    owner_id = parse_owner_id(x_owner_id)
    filename = Path(upload.filename or "").name
    extension = Path(filename).suffix.lower()
    if not filename or extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type. Allowed extensions: {allowed}.",
        )

    content = await read_upload(upload)
    job = Job(
        job_id=uuid4(),
        filename=filename,
        extension=extension,
        size_bytes=len(content),
        created_at=datetime.now(UTC),
        owner_id=owner_id,
        _content=content,
    )
    if durable_mode():
        assert owner_id is not None
        try:
            await repository().create_job(
                job_id=job.job_id,
                owner_id=owner_id,
                filename=job.filename,
                extension=job.extension,
                size_bytes=job.size_bytes,
                created_at=job.created_at,
            )
        except (RepositoryConfigurationError, RepositoryError) as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
    jobs[job.job_id] = job
    background_tasks.add_task(process_job, job.job_id)
    return response_for(job)


@app.get("/v1/jobs/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> JobResponse:
    require_worker_token(x_worker_token)
    job = jobs.get(job_id)
    if job is None and durable_mode():
        try:
            row = await repository().get_job(job_id)
        except (RepositoryConfigurationError, RepositoryError) as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        if row:
            job = Job(
                job_id=UUID(row["id"]),
                filename=row["filename"],
                extension=row["extension"],
                size_bytes=row["size_bytes"],
                created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
                owner_id=UUID(row["owner_id"]) if row.get("owner_id") else None,
                status=JobStatus(row["status"]),
                storage_path=row.get("storage_path"),
                error=row.get("error"),
                result={
                    "parser_version": row.get("parser_version"),
                    "input_kind": row.get("input_kind"),
                    "extraction_count": row.get("extraction_count", 0),
                    "dataset_id": row.get("dataset_id"),
                    "thread_id": row.get("thread_id"),
                    "promoted_observation_count": row.get("promoted_observation_count", 0),
                },
            )
            jobs[job_id] = job
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return response_for(job)


@app.post("/v1/ai/latest-price")
async def latest_price_query(
    request: LatestPriceRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        observation = await latest_price(**request.model_dump(exclude_none=True))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"found": observation is not None, "observation": observation}
