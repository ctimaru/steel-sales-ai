from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
from pathlib import PurePosixPath
from uuid import UUID

from fastapi import FastAPI

from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository
from .source_reingest import (
    SourceReingestClaimError,
    _archive_members,
    execute_offer_source_reingest_bytes,
)
from .storage import StorageConfigurationError, StorageUploadError

logger = logging.getLogger(__name__)
pa23016_tasks: set[asyncio.Task[None]] = set()


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"{name} is required when PA2.30.16 bootstrap is enabled.")
    return value


def _manifest() -> list[dict[str, object]]:
    raw = _required_env("OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_MANIFEST")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("PA2.30.16 manifest must be valid JSON.") from exc
    if not isinstance(payload, list) or not payload or len(payload) > 20:
        raise ValueError("PA2.30.16 manifest must contain between 1 and 20 items.")

    seen: set[int] = set()
    items: list[dict[str, object]] = []
    for entry in payload:
        if not isinstance(entry, dict):
            raise ValueError("PA2.30.16 manifest item must be an object.")
        reingest_id = entry.get("reingest_id")
        expected = entry.get("expected_source_filename")
        remediation_id = entry.get("remediation_queue_id")
        if not isinstance(reingest_id, int) or reingest_id <= 0 or reingest_id in seen:
            raise ValueError("PA2.30.16 manifest requires unique positive re-ingest ids.")
        if not isinstance(remediation_id, int) or remediation_id <= 0:
            raise ValueError("PA2.30.16 manifest requires positive remediation ids.")
        if not isinstance(expected, str) or not expected.strip():
            raise ValueError("PA2.30.16 manifest requires expected source filenames.")
        if PurePosixPath(expected).suffix.lower() != ".eml":
            raise ValueError("PA2.30.16 manifest may reference only EML files.")
        seen.add(reingest_id)
        items.append(
            {
                "reingest_id": reingest_id,
                "remediation_queue_id": remediation_id,
                "expected_source_filename": expected.strip(),
            }
        )
    return items


async def execute_offer_source_ambiguous_recovery_bootstrap() -> dict[str, object]:
    transfer_id = _required_env("OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_TRANSFER_ID")
    actor_id = UUID(_required_env("OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_ACTOR_ID"))
    expected_sha = _required_env(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_ARCHIVE_SHA256"
    ).lower()
    if len(expected_sha) != 64 or any(c not in "0123456789abcdef" for c in expected_sha):
        raise ValueError("PA2.30.16 archive SHA-256 must be lowercase hex.")

    items = _manifest()
    repo = WorkerRepository()
    transfer = await repo.get_offer_source_recovery_transfer(transfer_id=transfer_id)
    if transfer.get("status") != "ready":
        return {"status": "blocked", "stage": "transfer", "detail": transfer}

    try:
        payload = base64.b64decode(str(transfer["payload_base64"]), validate=True)
    except (KeyError, ValueError) as exc:
        raise ValueError("PA2.30.16 transfer payload is not valid base64.") from exc

    actual_sha = hashlib.sha256(payload).hexdigest()
    if actual_sha != expected_sha:
        raise ValueError(f"PA2.30.16 archive checksum mismatch: {actual_sha}.")

    archive, members = _archive_members(payload)
    recovered = 0
    failures: list[dict[str, object]] = []
    results: list[dict[str, object]] = []
    try:
        for item in items:
            reingest_id = int(item["reingest_id"])
            expected = str(item["expected_source_filename"])
            info = members.get(expected.casefold())
            if info is None:
                row = {
                    **item,
                    "status": "missing_archive_member",
                }
                failures.append(row)
                results.append(row)
                continue

            content = archive.read(info)
            try:
                outcome = await execute_offer_source_reingest_bytes(
                    reingest_id=reingest_id,
                    owner_id=actor_id,
                    filename=PurePosixPath(expected).name,
                    content=content,
                    expected_source_path=expected,
                )
                status = "recovered" if outcome.get("status") == "consumed" else "failed"
                row = {
                    **item,
                    "status": status,
                    "successor_run_id": outcome.get("successor_run_id"),
                    "reparse_status": (outcome.get("reparse") or {}).get("status")
                    if isinstance(outcome.get("reparse"), dict)
                    else None,
                    "extraction_count": (outcome.get("reparse") or {}).get("extraction_count")
                    if isinstance(outcome.get("reparse"), dict)
                    else None,
                }
                results.append(row)
                if status == "recovered":
                    recovered += 1
                else:
                    failures.append(row)
            except (
                SourceReingestClaimError,
                RepositoryConfigurationError,
                RepositoryError,
                StorageConfigurationError,
                StorageUploadError,
                ValueError,
                RuntimeError,
                KeyError,
            ) as exc:
                row = {
                    **item,
                    "status": "failed",
                    "error": str(exc)[:500],
                }
                failures.append(row)
                results.append(row)
    finally:
        archive.close()

    if failures:
        logger.error("PA2.30.16 ambiguous recovery failures: %s", failures)
        return {
            "status": "partial_failure",
            "recovered": recovered,
            "failed": len(failures),
            "results": results,
            "archive_sha256": actual_sha,
            "automatic_source_selection": False,
            "automatic_promotion": False,
            "control_phase": "PA2.30.16",
        }

    cleanup = await repo.cleanup_offer_source_recovery_transfer(transfer_id=transfer_id)
    return {
        "status": "completed",
        "recovered": recovered,
        "failed": 0,
        "results": results,
        "cleanup": cleanup,
        "archive_sha256": actual_sha,
        "automatic_source_selection": False,
        "automatic_promotion": False,
        "control_phase": "PA2.30.16",
    }


def install_offer_source_ambiguous_recovery_bootstrap(app: FastAPI) -> None:
    @app.on_event("startup")
    async def schedule_pa23016_bootstrap() -> None:
        if not os.getenv("OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_TRANSFER_ID", "").strip():
            return
        try:
            _required_env("OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_ACTOR_ID")
            _required_env("OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_ARCHIVE_SHA256")
            _manifest()
        except (ValueError, TypeError) as exc:
            logger.error("PA2.30.16 bootstrap configuration rejected: %s", exc)
            return

        task = asyncio.create_task(execute_offer_source_ambiguous_recovery_bootstrap())
        pa23016_tasks.add(task)
        task.add_done_callback(pa23016_tasks.discard)
