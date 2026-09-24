from __future__ import annotations

import hashlib
import json
import zipfile
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path, PurePosixPath
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile, status

from .main import require_worker_token
from .offer_reparse import execute_offer_source_reparse
from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository
from .storage import StorageConfigurationError, StorageUploadError, upload_private_object

router = APIRouter(prefix="/v1/remediation", tags=["remediation"])
MAX_SOURCE_BYTES = 25 * 1024 * 1024
MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
MAX_ARCHIVE_UNCOMPRESSED_BYTES = 250 * 1024 * 1024
MAX_ARCHIVE_MEMBERS = 5000
UPLOAD_CHUNK_SIZE = 1024 * 1024


class SourceReingestClaimError(ValueError):
    def __init__(self, status: str, reason: str | None = None) -> None:
        self.status = status
        self.reason = reason or status
        super().__init__(self.reason)


async def _read_upload(upload: UploadFile, *, max_bytes: int, label: str) -> bytes:
    content = bytearray()
    while chunk := await upload.read(UPLOAD_CHUNK_SIZE):
        content.extend(chunk)
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"{label} exceeds the {max_bytes // (1024 * 1024)} MB limit.",
            )
    if not content:
        raise HTTPException(status_code=400, detail=f"{label} is empty.")
    return bytes(content)


async def _read_source(upload: UploadFile) -> bytes:
    return await _read_upload(upload, max_bytes=MAX_SOURCE_BYTES, label="Source re-ingest")


def _normalize_archive_path(value: str) -> str:
    path = value.replace("\\", "/")
    while path.startswith("./"):
        path = path[2:]
    pure = PurePosixPath(path)
    if not path or path.startswith("/") or ".." in pure.parts:
        raise ValueError("Unsafe archive member path.")
    return pure.as_posix()


def _parse_manifest(raw: str) -> list[dict[str, Any]]:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid bulk recovery manifest.") from exc
    if not isinstance(payload, list) or not payload or len(payload) > 100:
        raise ValueError("Bulk recovery manifest must contain between 1 and 100 items.")

    seen_ids: set[int] = set()
    items: list[dict[str, Any]] = []
    for entry in payload:
        if not isinstance(entry, dict):
            raise ValueError("Invalid bulk recovery manifest item.")
        run_id = entry.get("reingest_id")
        expected = entry.get("expected_source_filename")
        if not isinstance(run_id, int) or run_id <= 0 or run_id in seen_ids:
            raise ValueError("Bulk recovery manifest requires unique positive re-ingest ids.")
        if not isinstance(expected, str) or not expected.strip():
            raise ValueError("Bulk recovery manifest requires an expected source filename.")
        expected_path = _normalize_archive_path(expected.strip())
        if PurePosixPath(expected_path).suffix.lower() != ".eml":
            raise ValueError("Bulk recovery manifest may reference only EML sources.")
        seen_ids.add(run_id)
        items.append(
            {
                "reingest_id": run_id,
                "expected_source_filename": expected_path,
            }
        )
    return items


def _archive_members(payload: bytes) -> tuple[zipfile.ZipFile, dict[str, zipfile.ZipInfo]]:
    try:
        archive = zipfile.ZipFile(BytesIO(payload))
    except zipfile.BadZipFile as exc:
        raise ValueError("Invalid ZIP archive.") from exc

    infos = [info for info in archive.infolist() if not info.is_dir()]
    if len(infos) > MAX_ARCHIVE_MEMBERS:
        archive.close()
        raise ValueError("ZIP archive contains too many files.")
    if sum(info.file_size for info in infos) > MAX_ARCHIVE_UNCOMPRESSED_BYTES:
        archive.close()
        raise ValueError("ZIP archive exceeds the uncompressed size limit.")

    members: dict[str, zipfile.ZipInfo] = {}
    for info in infos:
        normalized = _normalize_archive_path(info.filename)
        key = normalized.casefold()
        if key in members:
            archive.close()
            raise ValueError("ZIP archive contains duplicate normalized paths.")
        members[key] = info
    return archive, members


async def execute_offer_source_reingest_bytes(
    *,
    reingest_id: int,
    owner_id: UUID,
    filename: str,
    content: bytes,
    expected_source_path: str | None = None,
) -> dict[str, object]:
    repo = WorkerRepository()
    claim = await repo.claim_offer_source_reingest(
        reingest_id=reingest_id,
        owner_id=owner_id,
    )
    if claim.get("status") != "claimed":
        raise SourceReingestClaimError(
            str(claim.get("status") or "not_claimable"),
            str(claim.get("reason") or claim.get("status") or "re-ingest not claimable"),
        )

    expected_source_filenames = claim.get("expected_source_filenames") or []
    expected_basenames = {
        Path(str(source_filename)).name.lower()
        for source_filename in expected_source_filenames
        if source_filename
    }
    extension = Path(filename).suffix.lower()

    try:
        if not filename or extension != ".eml":
            raise ValueError("PA2.30.3 source recovery requires an .eml original source.")
        if not content:
            raise ValueError("Source re-ingest file is empty.")
        if len(content) > MAX_SOURCE_BYTES:
            raise ValueError("Source re-ingest exceeds the 25 MB limit.")
        if expected_basenames and filename.lower() not in expected_basenames:
            raise ValueError("Uploaded EML filename does not match the target thread source history.")

        selected_source_filename = claim.get("selected_source_filename")
        if isinstance(selected_source_filename, str) and selected_source_filename:
            selected_basename = Path(selected_source_filename).name.lower()
            if filename.lower() != selected_basename:
                raise ValueError(
                    "Uploaded EML filename does not match the explicitly selected offered source."
                )

        if expected_source_path is not None:
            preferred = claim.get("preferred_source_filename")
            selection_status = claim.get("source_selection_status")
            if selection_status not in {
                "unique_offered_source",
                "manually_selected_offered_source",
            } or not isinstance(preferred, str):
                raise ValueError(
                    "Bulk recovery requires a database-selected offered source."
                )
            if _normalize_archive_path(preferred).casefold() != _normalize_archive_path(
                expected_source_path
            ).casefold():
                raise ValueError(
                    "Bulk recovery manifest does not match the database-selected source."
                )

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
        raise


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

    filename = Path(upload.filename or "").name
    try:
        content = await _read_source(upload)
        return await execute_offer_source_reingest_bytes(
            reingest_id=reingest_id,
            owner_id=parsed_owner,
            filename=filename,
            content=content,
        )
    except SourceReingestClaimError as exc:
        code = 404 if exc.status == "not_found" else 409
        raise HTTPException(status_code=code, detail=exc.reason) from exc
    except (StorageConfigurationError, StorageUploadError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except (RepositoryConfigurationError, RepositoryError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (ValueError, RuntimeError, KeyError) as exc:
        detail = str(exc)
        code = 415 if "requires an .eml" in detail else 422
        raise HTTPException(status_code=code, detail=detail) from exc


@router.post("/offer-source-reingest-batch")
async def offer_source_reingest_batch(
    upload: Annotated[UploadFile, File(...)],
    owner_id: Annotated[str, Form(...)],
    manifest: Annotated[str, Form(...)],
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        parsed_owner = UUID(owner_id)
        items = _parse_manifest(manifest)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    archive_name = Path(upload.filename or "").name
    if Path(archive_name).suffix.lower() != ".zip":
        raise HTTPException(status_code=415, detail="Bulk source recovery requires a ZIP archive.")

    archive_payload = await _read_upload(
        upload,
        max_bytes=MAX_ARCHIVE_BYTES,
        label="Source recovery archive",
    )
    try:
        archive, members = _archive_members(archive_payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    results: list[dict[str, object]] = []
    try:
        for item in items:
            expected = str(item["expected_source_filename"])
            info = members.get(expected.casefold())
            if info is None:
                results.append(
                    {
                        "reingest_id": item["reingest_id"],
                        "expected_source_filename": expected,
                        "status": "missing_archive_member",
                    }
                )
                continue
            if info.file_size <= 0 or info.file_size > MAX_SOURCE_BYTES:
                results.append(
                    {
                        "reingest_id": item["reingest_id"],
                        "expected_source_filename": expected,
                        "status": "invalid_source_size",
                    }
                )
                continue

            content = archive.read(info)
            try:
                recovered = await execute_offer_source_reingest_bytes(
                    reingest_id=int(item["reingest_id"]),
                    owner_id=parsed_owner,
                    filename=PurePosixPath(expected).name,
                    content=content,
                    expected_source_path=expected,
                )
                results.append(
                    {
                        "reingest_id": item["reingest_id"],
                        "expected_source_filename": expected,
                        "status": "recovered",
                        "successor_run_id": recovered.get("successor_run_id"),
                        "reparse_status": (recovered.get("reparse") or {}).get("status")
                        if isinstance(recovered.get("reparse"), dict)
                        else None,
                        "extraction_count": (recovered.get("reparse") or {}).get("extraction_count")
                        if isinstance(recovered.get("reparse"), dict)
                        else None,
                    }
                )
            except (
                RepositoryConfigurationError,
                RepositoryError,
                StorageConfigurationError,
                StorageUploadError,
                ValueError,
                RuntimeError,
                KeyError,
            ) as exc:
                results.append(
                    {
                        "reingest_id": item["reingest_id"],
                        "expected_source_filename": expected,
                        "status": "failed",
                        "error": str(exc)[:500],
                    }
                )
    finally:
        archive.close()

    return {
        "status": "completed",
        "archive_filename": archive_name,
        "manifest_count": len(items),
        "recovered": sum(1 for row in results if row["status"] == "recovered"),
        "missing": sum(1 for row in results if row["status"] == "missing_archive_member"),
        "failed": sum(
            1
            for row in results
            if row["status"] not in {"recovered", "missing_archive_member"}
        ),
        "results": results,
        "automatic_ambiguous_selection": False,
        "observation_mutation": False,
        "automatic_promotion": False,
    }
