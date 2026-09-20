from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

import httpx
from fastapi import BackgroundTasks, FastAPI, File, Form, Header, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field

from .assistant_market import answer_assistant
from .embeddings import (
    EmbeddingConfigurationError,
    EmbeddingProviderError,
    run_embedding_batch,
)
from .knowledge_ingest import build_knowledge_document
from .market import MarketConfigurationError, MarketDataError, get_market_overview
from .market_overlay import get_price_market_overlay
from .parser_v31 import ParserInput, ParserV31Adapter
from .queries import latest_price, offers_without_order, price_history
from .repository import (
    RepositoryConfigurationError,
    RepositoryError,
    WorkerRepository,
)
from .storage import StorageConfigurationError, upload_private_object
from .shared_reference import validate_parser_observations_with_shared_reference

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
ALLOWED_EXTENSIONS = {".zip", ".eml", ".pdf", ".xls", ".xlsx"}
UPLOAD_CHUNK_SIZE = 1024 * 1024
parser = ParserV31Adapter()
logger = logging.getLogger(__name__)
startup_tasks: set[asyncio.Task[None]] = set()


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


class ProductQueryRequest(BaseModel):
    owner_id: UUID
    grade: str | None = None
    outer_diameter_mm: float | None = None
    thickness_mm: float | None = None
    width_mm: float | None = None
    height_mm: float | None = None


class LatestPriceRequest(ProductQueryRequest):
    pass


class PriceHistoryRequest(ProductQueryRequest):
    limit: int = Field(default=50, ge=1, le=200)


class MarketPriceOverlayRequest(ProductQueryRequest):
    limit: int = Field(default=50, ge=1, le=200)


class OffersWithoutOrderRequest(BaseModel):
    owner_id: UUID
    grade: str | None = None
    since: datetime | None = None
    limit: int = Field(default=100, ge=1, le=200)


class AssistantRequest(BaseModel):
    owner_id: UUID
    query: str = Field(min_length=2, max_length=500)
    context: dict[str, object] | None = None


class MarketOverviewRequest(BaseModel):
    owner_id: UUID
    refresh: bool = True
    force: bool = False


class EmbeddingBatchRequest(BaseModel):
    model_key: str = Field(min_length=1, max_length=120)
    limit: int = Field(default=32, ge=1, le=128)


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
        observations = prepared.observations
        if repo:
            observations = await validate_parser_observations_with_shared_reference(repo, observations)

        job.result = {
            "parser_version": prepared.parser_version,
            "input_kind": prepared.input_kind,
            "processing_status": prepared.status,
            "storage_path": prepared.storage_path,
            "extraction_count": len(observations),
        }
        if repo:
            assert job.owner_id is not None
            await repo.insert_observations(
                job_id=job.job_id,
                observations=observations,
            )
            knowledge_document = build_knowledge_document(
                filename=job.filename,
                payload=job._content,
                storage_path=job.storage_path or "",
                document_type=prepared.input_kind,
                extraction_version=f"{prepared.parser_version}+knowledge-v1",
            )
            knowledge = await repo.ingest_knowledge_upload(
                owner_id=job.owner_id,
                document=knowledge_document,
            )
            job.result["knowledge"] = knowledge
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
                    "knowledge_document_id": knowledge.get("document_id"),
                    "knowledge_chunk_count": knowledge.get("chunk_count", 0),
                    "knowledge_deduplicated": knowledge.get("deduplicated"),
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


def parse_owner_id(owner_context: str | None) -> UUID | None:
    if not durable_mode():
        return UUID(owner_context) if owner_context else None
    if not owner_context:
        raise HTTPException(status_code=400, detail="Missing authenticated owner context.")
    try:
        return UUID(owner_context)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid owner context.") from exc


async def warm_market_cache() -> None:
    """Best-effort cache warm-up that never blocks worker health checks."""
    try:
        await get_market_overview(refresh=True, force=False)
    except (MarketConfigurationError, MarketDataError, httpx.HTTPError) as exc:
        logger.warning("Market cache warm-up failed: %s", exc)


@app.on_event("startup")
async def schedule_market_cache_warmup() -> None:
    if not durable_mode():
        return
    task = asyncio.create_task(warm_market_cache())
    startup_tasks.add(task)
    task.add_done_callback(startup_tasks.discard)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/uploads", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_upload(
    background_tasks: BackgroundTasks,
    upload: Annotated[UploadFile, File(...)],
    owner_id: Annotated[str | None, Form()] = None,
    x_worker_token: Annotated[str | None, Header()] = None,
    x_owner_id: Annotated[str | None, Header()] = None,
) -> UploadResponse:
    require_worker_token(x_worker_token)
    authenticated_owner_id = parse_owner_id(owner_id or x_owner_id)
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
        owner_id=authenticated_owner_id,
        _content=content,
    )
    if durable_mode():
        assert authenticated_owner_id is not None
        try:
            await repository().create_job(
                job_id=job.job_id,
                owner_id=authenticated_owner_id,
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
                    "knowledge_document_id": row.get("knowledge_document_id"),
                    "knowledge_chunk_count": row.get("knowledge_chunk_count", 0),
                    "knowledge_deduplicated": row.get("knowledge_deduplicated"),
                },
            )
            jobs[job_id] = job
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return response_for(job)


@app.post("/v1/knowledge/embeddings/run")
async def embedding_batch_query(
    request: EmbeddingBatchRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    if not durable_mode():
        raise HTTPException(status_code=409, detail="Embedding batches require durable mode.")
    try:
        result = await run_embedding_batch(
            model_key=request.model_key,
            limit=request.limit,
        )
    except (
        EmbeddingConfigurationError,
        EmbeddingProviderError,
        RepositoryConfigurationError,
        RepositoryError,
        RuntimeError,
        ValueError,
    ) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return result.as_dict()


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


@app.post("/v1/ai/price-history")
async def price_history_query(
    request: PriceHistoryRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        observations = await price_history(**request.model_dump(exclude_none=True))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "found": bool(observations),
        "count": len(observations),
        "observations": observations,
    }


@app.post("/v1/ai/offers-without-order")
async def offers_without_order_query(
    request: OffersWithoutOrderRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        observations = await offers_without_order(**request.model_dump(exclude_none=True))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    thread_ids = {row.get("thread_id") for row in observations if row.get("thread_id")}
    return {
        "found": bool(observations),
        "count": len(observations),
        "thread_count": len(thread_ids),
        "observations": observations,
    }


@app.post("/v1/ai/assistant")
async def assistant_query(
    request: AssistantRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        return await answer_assistant(
            owner_id=request.owner_id,
            query=request.query,
            context=request.context,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/v1/market/overview")
async def market_overview_query(
    request: MarketOverviewRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    _ = request.owner_id
    try:
        return await get_market_overview(refresh=request.refresh, force=request.force)
    except (MarketConfigurationError, MarketDataError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/v1/market/price-overlay")
async def market_price_overlay_query(
    request: MarketPriceOverlayRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        return await get_price_market_overlay(**request.model_dump(exclude_none=True))
    except (MarketConfigurationError, MarketDataError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
