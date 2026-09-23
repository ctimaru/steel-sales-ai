from __future__ import annotations

import asyncio
import hashlib
import logging
import os
from pathlib import PurePosixPath
from typing import Annotated, Any

from fastapi import APIRouter, FastAPI, Header, HTTPException

from .main import require_worker_token
from .parser_v4 import ParserInput, ParserV4Adapter
from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository
from .storage import StorageConfigurationError, StorageUploadError, download_private_object

router = APIRouter(prefix="/v1/remediation", tags=["remediation"])
parser = ParserV4Adapter()
logger = logging.getLogger(__name__)
bootstrap_tasks: set[asyncio.Task[None]] = set()


def _source_identity(claim: dict[str, Any]) -> tuple[str, str, int]:
    snapshot = claim.get("source_snapshot") or {}
    filename = str(snapshot.get("filename") or PurePosixPath(str(claim["source_storage_path"])).name)
    extension = str(snapshot.get("extension") or PurePosixPath(filename).suffix).lower()
    size_bytes = int(snapshot.get("size_bytes") or 0)
    if not filename or extension not in {".eml", ".pdf", ".xls", ".xlsx", ".zip"}:
        raise ValueError("Unsupported or missing source identity for reparse.")
    return filename, extension, size_bytes


async def execute_offer_source_reparse(run_id: int) -> dict[str, Any]:
    repo = WorkerRepository()
    claim = await repo.claim_offer_source_reparse_run(run_id)
    status = claim.get("status")
    if status != "claimed":
        return claim

    try:
        storage_path = str(claim["source_storage_path"])
        payload = await download_private_object(storage_path=storage_path)

        expected_checksum = claim.get("source_checksum")
        actual_checksum = hashlib.sha256(payload).hexdigest()
        if expected_checksum and str(expected_checksum).lower() != actual_checksum:
            raise ValueError("Original source checksum mismatch.")

        filename, extension, snapshot_size = _source_identity(claim)
        if snapshot_size and snapshot_size != len(payload):
            raise ValueError("Original source size mismatch.")

        prepared = parser.prepare(
            ParserInput(
                filename=filename,
                extension=extension,
                size_bytes=len(payload),
                storage_path=storage_path,
            ),
            payload,
        )
        if prepared.parser_version != claim.get("requested_parser_version"):
            raise ValueError("Parser version does not match requested reparse contract.")

        candidates = prepared.observations
        result = await repo.complete_offer_source_reparse_run(
            run_id=run_id,
            candidates=candidates,
        )
        return {
            **result,
            "parser_version": prepared.parser_version,
            "input_kind": prepared.input_kind,
            "source_checksum_verified": True,
            "extraction_count": len(candidates),
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
            await repo.fail_offer_source_reparse_run(run_id=run_id, error=str(exc))
        except (RepositoryConfigurationError, RepositoryError):
            pass
        raise


def _bootstrap_run_ids(raw: str | None) -> list[int]:
    if not raw or not raw.strip():
        return []
    ids: list[int] = []
    seen: set[int] = set()
    for token in raw.split(","):
        value = token.strip()
        if not value:
            continue
        if not value.isdigit():
            raise ValueError("OFFER_REPARSE_BOOTSTRAP_RUN_IDS must contain positive integer run ids.")
        run_id = int(value)
        if run_id <= 0:
            raise ValueError("OFFER_REPARSE_BOOTSTRAP_RUN_IDS must contain positive integer run ids.")
        if run_id not in seen:
            ids.append(run_id)
            seen.add(run_id)
    if len(ids) > 100:
        raise ValueError("OFFER_REPARSE_BOOTSTRAP_RUN_IDS is limited to 100 explicit run ids.")
    return ids


async def execute_explicit_offer_reparse_batch(run_ids: list[int]) -> None:
    for run_id in run_ids:
        try:
            result = await execute_offer_source_reparse(run_id)
            logger.info(
                "PA2.30.1 explicit offer reparse run=%s status=%s extraction_count=%s",
                run_id,
                result.get("status"),
                result.get("extraction_count"),
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
            logger.error("PA2.30.1 explicit offer reparse run=%s failed: %s", run_id, exc)


def install_offer_reparse_bootstrap(app: FastAPI) -> None:
    @app.on_event("startup")
    async def schedule_explicit_offer_reparse_batch() -> None:
        raw = os.getenv("OFFER_REPARSE_BOOTSTRAP_RUN_IDS")
        try:
            run_ids = _bootstrap_run_ids(raw)
        except ValueError as exc:
            logger.error("PA2.30.1 bootstrap configuration rejected: %s", exc)
            return
        if not run_ids:
            return

        logger.info("PA2.30.1 scheduling explicit offer reparse runs: %s", run_ids)
        task = asyncio.create_task(execute_explicit_offer_reparse_batch(run_ids))
        bootstrap_tasks.add(task)
        task.add_done_callback(bootstrap_tasks.discard)


@router.post("/offer-reparse/{run_id}")
async def execute_offer_reparse_endpoint(
    run_id: int,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    require_worker_token(x_worker_token)
    if run_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid reparse run id.")

    try:
        result = await execute_offer_source_reparse(run_id)
    except (RepositoryConfigurationError, RepositoryError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (StorageConfigurationError, StorageUploadError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except (ValueError, RuntimeError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if result.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Reparse run not found.")
    if result.get("status") == "not_claimable":
        raise HTTPException(status_code=409, detail=f"Reparse run is {result.get('run_status')}.")
    return result
