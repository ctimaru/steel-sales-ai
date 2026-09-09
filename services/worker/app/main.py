from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
ALLOWED_EXTENSIONS = {".zip", ".eml", ".pdf", ".xls", ".xlsx"}
UPLOAD_CHUNK_SIZE = 1024 * 1024


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


class JobResponse(UploadResponse):
    error: str | None = None
    result: dict[str, object] | None = None


@dataclass
class Job:
    job_id: UUID
    filename: str
    extension: str
    size_bytes: int
    created_at: datetime
    status: JobStatus = JobStatus.QUEUED
    error: str | None = None
    result: dict[str, object] | None = None
    _content: bytes = field(repr=False, default=b"")


jobs: dict[UUID, Job] = {}

app = FastAPI(
    title="Steel Sales AI Worker",
    version="0.1.0",
    description="Upload and asynchronous processing boundary for commercial documents.",
)


def response_for(job: Job) -> JobResponse:
    return JobResponse(
        job_id=job.job_id,
        filename=job.filename,
        extension=job.extension,
        size_bytes=job.size_bytes,
        status=job.status,
        created_at=job.created_at,
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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/uploads", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_upload(upload: Annotated[UploadFile, File(...)]) -> UploadResponse:
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
        _content=content,
    )
    jobs[job.job_id] = job
    return response_for(job)


@app.get("/v1/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: UUID) -> JobResponse:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return response_for(job)
