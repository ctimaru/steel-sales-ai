from __future__ import annotations

import asyncio
import hashlib
import os
from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import Annotated, Literal
from urllib.parse import parse_qs, urlparse
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from supabase import ClientOptions, create_client

from .knowledge_ingest import build_knowledge_document
from .parser_v31 import ParserInput, ParserV31Adapter
from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository

router = APIRouter(prefix="/v1/import-batches", tags=["bulk-import"])

BUCKET_NAME = os.getenv("SUPABASE_UPLOAD_BUCKET", "commercial-uploads")
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_BATCH_BYTES = 100 * 1024 * 1024
MAX_BATCH_FILES = 25
ALLOWED_EXTENSIONS = {".eml", ".pdf", ".xls", ".xlsx"}
parser = ParserV31Adapter()


class BulkImportError(RuntimeError):
    pass


class BulkFileDescriptor(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0, le=MAX_FILE_BYTES)
    content_checksum: str = Field(pattern=r"^[a-f0-9]{64}$")

    @property
    def extension(self) -> str:
        return PurePosixPath(self.filename).suffix.lower()


class PrepareBatchRequest(BaseModel):
    actor_user_id: UUID
    files: list[BulkFileDescriptor] = Field(min_length=1, max_length=MAX_BATCH_FILES)

    @model_validator(mode="after")
    def validate_batch(self) -> "PrepareBatchRequest":
        if sum(item.size_bytes for item in self.files) > MAX_BATCH_BYTES:
            raise ValueError("Bulk import exceeds the 100 MB batch limit.")
        checksums = [item.content_checksum for item in self.files]
        if len(set(checksums)) != len(checksums):
            raise ValueError("The same file content cannot appear twice in one batch.")
        for item in self.files:
            if item.extension not in ALLOWED_EXTENSIONS:
                raise ValueError(
                    f"Unsupported file type for {item.filename}. Allowed: EML, PDF, XLS, XLSX."
                )
        return self


class PreparedItem(BaseModel):
    item_id: UUID
    filename: str
    status: Literal["queued", "completed"]
    storage_path: str
    upload_token: str | None = None
    deduplicated: bool = False


class PrepareBatchResponse(BaseModel):
    batch_id: UUID
    status: str
    total_items: int
    items: list[PreparedItem]


class StartBatchRequest(BaseModel):
    actor_user_id: UUID
    item_ids: list[UUID] | None = None


class StartBatchResponse(BaseModel):
    batch_id: UUID
    accepted_items: int
    skipped_items: int


class RetryBatchRequest(BaseModel):
    actor_user_id: UUID
    item_ids: list[UUID] | None = None


class RetryBatchResponse(BaseModel):
    batch_id: UUID
    accepted_items: int
    reconciled_items: int
    skipped_items: int


def _require_worker_token(x_worker_token: str | None) -> None:
    expected = os.getenv("WORKER_INTERNAL_TOKEN")
    if expected and x_worker_token != expected:
        raise HTTPException(status_code=401, detail="Invalid worker token.")


def _safe_name(filename: str) -> str:
    return PurePosixPath(filename).name.replace(" ", "_")


def _storage_path(*, organization_id: UUID, batch_id: UUID, item_id: UUID, filename: str) -> str:
    return (
        f"organizations/{organization_id}/imports/{batch_id}/{item_id}/"
        f"{_safe_name(filename)}"
    )


class BulkImportService:
    def __init__(self) -> None:
        self.base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.base_url or not self.key:
            raise RepositoryConfigurationError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
            )
        self.repo = WorkerRepository()
        self.headers = {
            "Authorization": f"Bearer {self.key}",
            "apikey": self.key,
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: object | None = None,
        prefer: str | None = None,
    ) -> object:
        return await self.repo._request(method, path, json=json, prefer=prefer)

    async def _write_membership(self, actor_user_id: UUID) -> dict[str, object]:
        rows = await self._request(
            "GET",
            "/rest/v1/organization_memberships"
            f"?user_id=eq.{actor_user_id}&status=eq.active"
            "&role=in.(admin,member)"
            "&select=organization_id,user_id,role,is_default,created_at"
            "&order=is_default.desc,created_at.asc&limit=1",
        )
        if not isinstance(rows, list) or not rows:
            raise BulkImportError("Active admin/member organization access is required.")
        return rows[0]

    async def _batch_for_actor(self, batch_id: UUID, actor_user_id: UUID) -> dict[str, object]:
        membership = await self._write_membership(actor_user_id)
        organization_id = membership["organization_id"]
        rows = await self._request(
            "GET",
            "/rest/v1/import_batches"
            f"?id=eq.{batch_id}&organization_id=eq.{organization_id}"
            "&select=id,organization_id,owner_id,status&limit=1",
        )
        if not isinstance(rows, list) or not rows:
            raise BulkImportError("Import batch not found for the active organization.")
        return rows[0]

    async def _completed_duplicate(
        self, *, organization_id: UUID, checksum: str
    ) -> dict[str, object] | None:
        rows = await self._request(
            "GET",
            "/rest/v1/import_batch_items"
            f"?organization_id=eq.{organization_id}"
            f"&content_checksum=eq.{checksum}&status=eq.completed"
            "&storage_path=not.is.null"
            "&select=id,storage_path,worker_job_id,completed_at"
            "&order=completed_at.desc&limit=1",
        )
        if not isinstance(rows, list):
            raise BulkImportError("Import deduplication lookup returned an invalid payload.")
        return rows[0] if rows else None

    def _storage_client(self):
        options = ClientOptions(auto_refresh_token=False, persist_session=False)
        return create_client(self.base_url, self.key, options=options).storage.from_(BUCKET_NAME)

    async def _signed_upload_token(self, path: str) -> str:
        def create() -> object:
            return self._storage_client().create_signed_upload_url(path)

        result = await asyncio.to_thread(create)
        if not isinstance(result, dict):
            raise BulkImportError("Supabase Storage returned an invalid signed-upload payload.")
        token = result.get("token")
        if isinstance(token, str) and token:
            return token
        signed_url = result.get("signed_url") or result.get("signedURL")
        if isinstance(signed_url, str):
            parsed = parse_qs(urlparse(signed_url).query)
            values = parsed.get("token")
            if values and values[0]:
                return values[0]
        raise BulkImportError("Supabase Storage signed-upload token is missing.")

    async def _download(self, path: str) -> bytes:
        def download() -> object:
            return self._storage_client().download(path)

        result = await asyncio.to_thread(download)
        if not isinstance(result, (bytes, bytearray)):
            raise BulkImportError("Supabase Storage returned an invalid download payload.")
        return bytes(result)

    async def _delete_batch(self, batch_id: UUID) -> None:
        try:
            await self._request(
                "DELETE",
                f"/rest/v1/import_batches?id=eq.{batch_id}",
                prefer="return=minimal",
            )
        except Exception:
            pass

    async def prepare_batch(
        self, *, actor_user_id: UUID, files: list[BulkFileDescriptor]
    ) -> dict[str, object]:
        membership = await self._write_membership(actor_user_id)
        organization_id = UUID(str(membership["organization_id"]))
        batch_id = uuid4()
        now = datetime.now(UTC)
        await self._request(
            "POST",
            "/rest/v1/import_batches",
            json={
                "id": str(batch_id),
                "organization_id": str(organization_id),
                "owner_id": str(actor_user_id),
                "source": "manual_bulk",
                "status": "queued",
                "metadata": {"contract_version": "p1.2-v1"},
                "created_at": now.isoformat(),
            },
            prefer="return=minimal",
        )

        prepared_items: list[dict[str, object]] = []
        try:
            for ordinal, descriptor in enumerate(files, start=1):
                item_id = uuid4()
                duplicate = await self._completed_duplicate(
                    organization_id=organization_id,
                    checksum=descriptor.content_checksum,
                )
                if duplicate:
                    storage_path = str(duplicate["storage_path"])
                    payload = {
                        "id": str(item_id),
                        "batch_id": str(batch_id),
                        "organization_id": str(organization_id),
                        "owner_id": str(actor_user_id),
                        "ordinal": ordinal,
                        "filename": _safe_name(descriptor.filename),
                        "extension": descriptor.extension,
                        "size_bytes": descriptor.size_bytes,
                        "content_checksum": descriptor.content_checksum,
                        "status": "completed",
                        "worker_job_id": duplicate.get("worker_job_id"),
                        "storage_path": storage_path,
                        "deduplicated": True,
                        "deduplicated_from_item_id": duplicate["id"],
                        "completed_at": now.isoformat(),
                    }
                    await self._request(
                        "POST",
                        "/rest/v1/import_batch_items",
                        json=payload,
                        prefer="return=minimal",
                    )
                    prepared_items.append(
                        {
                            "item_id": item_id,
                            "filename": descriptor.filename,
                            "status": "completed",
                            "storage_path": storage_path,
                            "upload_token": None,
                            "deduplicated": True,
                        }
                    )
                    continue

                storage_path = _storage_path(
                    organization_id=organization_id,
                    batch_id=batch_id,
                    item_id=item_id,
                    filename=descriptor.filename,
                )
                token = await self._signed_upload_token(storage_path)
                await self._request(
                    "POST",
                    "/rest/v1/import_batch_items",
                    json={
                        "id": str(item_id),
                        "batch_id": str(batch_id),
                        "organization_id": str(organization_id),
                        "owner_id": str(actor_user_id),
                        "ordinal": ordinal,
                        "filename": _safe_name(descriptor.filename),
                        "extension": descriptor.extension,
                        "size_bytes": descriptor.size_bytes,
                        "content_checksum": descriptor.content_checksum,
                        "status": "queued",
                        "storage_path": storage_path,
                    },
                    prefer="return=minimal",
                )
                prepared_items.append(
                    {
                        "item_id": item_id,
                        "filename": descriptor.filename,
                        "status": "queued",
                        "storage_path": storage_path,
                        "upload_token": token,
                        "deduplicated": False,
                    }
                )
        except Exception:
            await self._delete_batch(batch_id)
            raise

        return {
            "batch_id": batch_id,
            "status": "queued",
            "total_items": len(prepared_items),
            "items": prepared_items,
        }

    async def _batch_items(
        self,
        *,
        batch_id: UUID,
        organization_id: UUID,
        statuses: tuple[str, ...],
        item_ids: list[UUID] | None,
    ) -> list[dict[str, object]]:
        status_filter = ",".join(statuses)
        path = (
            "/rest/v1/import_batch_items"
            f"?batch_id=eq.{batch_id}&organization_id=eq.{organization_id}"
            f"&status=in.({status_filter})"
            "&select=*"
            "&order=ordinal.asc"
        )
        if item_ids:
            path += "&id=in.(" + ",".join(str(item_id) for item_id in item_ids) + ")"
        rows = await self._request("GET", path)
        if not isinstance(rows, list):
            raise BulkImportError("Import batch item lookup returned an invalid payload.")
        return rows

    async def start_batch(
        self,
        *,
        background_tasks: BackgroundTasks,
        batch_id: UUID,
        actor_user_id: UUID,
        item_ids: list[UUID] | None,
    ) -> dict[str, int | UUID]:
        batch = await self._batch_for_actor(batch_id, actor_user_id)
        organization_id = UUID(str(batch["organization_id"]))
        items = await self._batch_items(
            batch_id=batch_id,
            organization_id=organization_id,
            statuses=("queued",),
            item_ids=item_ids,
        )
        for item in items:
            background_tasks.add_task(self.process_item, UUID(str(item["id"])))
        requested = len(item_ids) if item_ids else len(items)
        return {
            "batch_id": batch_id,
            "accepted_items": len(items),
            "skipped_items": max(requested - len(items), 0),
        }

    async def retry_batch(
        self,
        *,
        background_tasks: BackgroundTasks,
        batch_id: UUID,
        actor_user_id: UUID,
        item_ids: list[UUID] | None,
    ) -> dict[str, int | UUID]:
        batch = await self._batch_for_actor(batch_id, actor_user_id)
        organization_id = UUID(str(batch["organization_id"]))
        items = await self._batch_items(
            batch_id=batch_id,
            organization_id=organization_id,
            statuses=("failed",),
            item_ids=item_ids,
        )
        accepted = 0
        reconciled = 0
        for item in items:
            previous_job_id = item.get("worker_job_id")
            if previous_job_id:
                previous = await self.repo.get_job(UUID(str(previous_job_id)))
                if previous and int(previous.get("promoted_observation_count") or 0) > 0:
                    await self._request(
                        "PATCH",
                        f"/rest/v1/import_batch_items?id=eq.{item['id']}",
                        json={
                            "status": "completed",
                            "last_error": None,
                            "completed_at": datetime.now(UTC).isoformat(),
                            "updated_at": datetime.now(UTC).isoformat(),
                        },
                        prefer="return=minimal",
                    )
                    reconciled += 1
                    continue
            await self._request(
                "PATCH",
                f"/rest/v1/import_batch_items?id=eq.{item['id']}",
                json={
                    "status": "queued",
                    "last_error": None,
                    "completed_at": None,
                    "updated_at": datetime.now(UTC).isoformat(),
                },
                prefer="return=minimal",
            )
            background_tasks.add_task(self.process_item, UUID(str(item["id"])))
            accepted += 1
        requested = len(item_ids) if item_ids else len(items)
        return {
            "batch_id": batch_id,
            "accepted_items": accepted,
            "reconciled_items": reconciled,
            "skipped_items": max(requested - accepted - reconciled, 0),
        }

    async def process_item(self, item_id: UUID) -> None:
        rows = await self._request(
            "GET",
            "/rest/v1/import_batch_items"
            f"?id=eq.{item_id}&select=*&limit=1",
        )
        if not isinstance(rows, list) or not rows:
            return
        item = rows[0]
        if item.get("status") == "completed" or item.get("deduplicated"):
            return

        now = datetime.now(UTC)
        attempt = int(item.get("attempt_count") or 0) + 1
        job_id = uuid4()
        owner_id = UUID(str(item["owner_id"]))
        storage_path = str(item["storage_path"])
        filename = str(item["filename"])
        extension = str(item["extension"])
        size_bytes = int(item["size_bytes"])
        checksum = str(item["content_checksum"])

        try:
            await self._request(
                "POST",
                "/rest/v1/worker_jobs",
                json={
                    "id": str(job_id),
                    "owner_id": str(owner_id),
                    "organization_id": str(item["organization_id"]),
                    "filename": filename,
                    "extension": extension,
                    "size_bytes": size_bytes,
                    "storage_path": storage_path,
                    "status": "queued",
                    "created_at": now.isoformat(),
                    "import_batch_id": str(item["batch_id"]),
                    "import_batch_item_id": str(item_id),
                    "attempt_number": attempt,
                    "content_checksum": checksum,
                },
                prefer="return=minimal",
            )
            await self._request(
                "PATCH",
                f"/rest/v1/import_batch_items?id=eq.{item_id}",
                json={
                    "status": "processing",
                    "worker_job_id": str(job_id),
                    "attempt_count": attempt,
                    "last_error": None,
                    "started_at": now.isoformat(),
                    "completed_at": None,
                    "updated_at": now.isoformat(),
                },
                prefer="return=minimal",
            )
            await self.repo.update_job(
                job_id,
                {"status": "processing", "started_at": now.isoformat()},
            )

            content = await self._download(storage_path)
            if len(content) != size_bytes:
                raise BulkImportError(
                    f"Stored object size mismatch: expected {size_bytes}, received {len(content)} bytes."
                )
            actual_checksum = hashlib.sha256(content).hexdigest()
            if actual_checksum != checksum:
                raise BulkImportError("Stored object checksum does not match the prepared batch item.")

            prepared = parser.prepare(
                ParserInput(
                    filename=filename,
                    extension=extension,
                    size_bytes=size_bytes,
                    storage_path=storage_path,
                ),
                content,
            )
            await self.repo.insert_observations(
                job_id=job_id,
                observations=prepared.observations,
            )
            knowledge_document = build_knowledge_document(
                filename=filename,
                payload=content,
                storage_path=storage_path,
                document_type=prepared.input_kind,
                extraction_version=f"{prepared.parser_version}+knowledge-v1",
            )
            knowledge = await self.repo.ingest_knowledge_upload(
                owner_id=owner_id,
                document=knowledge_document,
            )
            promotion = await self.repo.promote_job(job_id)
            completed_at = datetime.now(UTC).isoformat()
            await self.repo.update_job(
                job_id,
                {
                    "status": "completed",
                    "parser_version": prepared.parser_version,
                    "input_kind": prepared.input_kind,
                    "extraction_count": len(prepared.observations),
                    "knowledge_document_id": knowledge.get("document_id"),
                    "knowledge_chunk_count": knowledge.get("chunk_count", 0),
                    "knowledge_deduplicated": knowledge.get("deduplicated"),
                    "completed_at": completed_at,
                    "error": None,
                },
            )
            await self._request(
                "PATCH",
                f"/rest/v1/import_batch_items?id=eq.{item_id}",
                json={
                    "status": "completed",
                    "last_error": None,
                    "completed_at": completed_at,
                    "updated_at": completed_at,
                    "worker_job_id": str(job_id),
                },
                prefer="return=minimal",
            )
            _ = promotion
        except Exception as exc:
            message = str(exc).strip() or exc.__class__.__name__
            message = message[:1000]
            failed_at = datetime.now(UTC).isoformat()
            try:
                await self.repo.update_job(
                    job_id,
                    {
                        "status": "failed",
                        "error": message,
                        "completed_at": failed_at,
                    },
                )
            except Exception:
                pass
            try:
                await self._request(
                    "PATCH",
                    f"/rest/v1/import_batch_items?id=eq.{item_id}",
                    json={
                        "status": "failed",
                        "last_error": message,
                        "completed_at": failed_at,
                        "updated_at": failed_at,
                        "worker_job_id": str(job_id),
                    },
                    prefer="return=minimal",
                )
            except Exception:
                pass


@router.post("/prepare", response_model=PrepareBatchResponse, status_code=status.HTTP_201_CREATED)
async def prepare_import_batch(
    request: PrepareBatchRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> PrepareBatchResponse:
    _require_worker_token(x_worker_token)
    try:
        result = await BulkImportService().prepare_batch(**request.model_dump())
        return PrepareBatchResponse(**result)
    except (RepositoryConfigurationError, RepositoryError, BulkImportError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{batch_id}/start", response_model=StartBatchResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_import_batch(
    batch_id: UUID,
    request: StartBatchRequest,
    background_tasks: BackgroundTasks,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> StartBatchResponse:
    _require_worker_token(x_worker_token)
    try:
        result = await BulkImportService().start_batch(
            background_tasks=background_tasks,
            batch_id=batch_id,
            **request.model_dump(),
        )
        return StartBatchResponse(**result)
    except (RepositoryConfigurationError, RepositoryError, BulkImportError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{batch_id}/retry", response_model=RetryBatchResponse, status_code=status.HTTP_202_ACCEPTED)
async def retry_import_batch(
    batch_id: UUID,
    request: RetryBatchRequest,
    background_tasks: BackgroundTasks,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> RetryBatchResponse:
    _require_worker_token(x_worker_token)
    try:
        result = await BulkImportService().retry_batch(
            background_tasks=background_tasks,
            batch_id=batch_id,
            **request.model_dump(),
        )
        return RetryBatchResponse(**result)
    except (RepositoryConfigurationError, RepositoryError, BulkImportError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
