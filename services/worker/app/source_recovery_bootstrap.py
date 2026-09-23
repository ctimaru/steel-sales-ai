from __future__ import annotations

import asyncio
import base64
import hashlib
import logging
import os
import secrets
from pathlib import PurePosixPath
from uuid import UUID

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse

from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository
from .source_reingest import (
    SourceReingestClaimError,
    MAX_ARCHIVE_BYTES,
    _archive_members,
    _read_upload,
    execute_offer_source_reingest_bytes,
)
from .storage import StorageConfigurationError, StorageUploadError

logger = logging.getLogger(__name__)
bootstrap_tasks: set[asyncio.Task[None]] = set()


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"{name} is required when PA2.30.10 bootstrap is enabled.")
    return value


def _expected_count(name: str) -> int:
    raw = _required_env(name)
    if not raw.isdigit():
        raise ValueError(f"{name} must be a non-negative integer.")
    value = int(raw)
    if value < 0:
        raise ValueError(f"{name} must be a non-negative integer.")
    return value


async def execute_offer_source_recovery_bootstrap() -> dict[str, object]:
    transfer_id = _required_env("OFFER_SOURCE_RECOVERY_BOOTSTRAP_TRANSFER_ID")
    organization_id = UUID(_required_env("OFFER_SOURCE_RECOVERY_BOOTSTRAP_ORGANIZATION_ID"))
    actor_id = UUID(_required_env("OFFER_SOURCE_RECOVERY_BOOTSTRAP_ACTOR_ID"))
    expected_unique = _expected_count("OFFER_SOURCE_RECOVERY_BOOTSTRAP_EXPECTED_UNIQUE")
    expected_ambiguous = _expected_count("OFFER_SOURCE_RECOVERY_BOOTSTRAP_EXPECTED_AMBIGUOUS")
    expected_archive_sha256 = _required_env(
        "OFFER_SOURCE_RECOVERY_BOOTSTRAP_ARCHIVE_SHA256"
    ).lower()
    if len(expected_archive_sha256) != 64 or any(
        char not in "0123456789abcdef" for char in expected_archive_sha256
    ):
        raise ValueError("OFFER_SOURCE_RECOVERY_BOOTSTRAP_ARCHIVE_SHA256 must be SHA-256 hex.")

    repo = WorkerRepository()
    prepared = await repo.prepare_offer_source_recovery_bootstrap(
        organization_id=organization_id,
        actor_id=actor_id,
        transfer_id=transfer_id,
        expected_unique_count=expected_unique,
        expected_ambiguous_count=expected_ambiguous,
    )
    if prepared.get("status") != "ready":
        logger.error("PA2.30.10 bootstrap preparation blocked: %s", prepared)
        return {"status": "blocked", "stage": "prepare", "detail": prepared}

    transfer = await repo.get_offer_source_recovery_transfer(transfer_id=transfer_id)
    if transfer.get("status") != "ready":
        logger.error("PA2.30.10 transfer unavailable: %s", transfer)
        return {"status": "blocked", "stage": "transfer", "detail": transfer}

    try:
        archive_payload = base64.b64decode(
            str(transfer["payload_base64"]), validate=True
        )
    except (KeyError, ValueError) as exc:
        raise ValueError("PA2.30.10 transfer payload is not valid base64.") from exc

    archive_sha256 = hashlib.sha256(archive_payload).hexdigest()
    if archive_sha256 != expected_archive_sha256:
        raise ValueError(
            f"PA2.30.10 archive checksum mismatch: {archive_sha256}."
        )

    archive, members = _archive_members(archive_payload)
    recovered = 0
    skipped_consumed = 0
    failures: list[str] = []
    try:
        items = prepared.get("items")
        if not isinstance(items, list) or len(items) != expected_unique:
            raise ValueError("PA2.30.10 prepared manifest count mismatch.")

        for item in items:
            if not isinstance(item, dict):
                failures.append("invalid prepared manifest item")
                continue
            reingest_id = int(item["reingest_id"])
            expected_source = str(item["expected_source_filename"])
            if item.get("reingest_status") == "consumed":
                skipped_consumed += 1
                continue

            info = members.get(expected_source.casefold())
            if info is None:
                failures.append(f"{reingest_id}:missing_archive_member")
                continue

            content = archive.read(info)
            try:
                result = await execute_offer_source_reingest_bytes(
                    reingest_id=reingest_id,
                    owner_id=actor_id,
                    filename=PurePosixPath(expected_source).name,
                    content=content,
                    expected_source_path=expected_source,
                )
                if result.get("status") == "consumed":
                    recovered += 1
                else:
                    failures.append(
                        f"{reingest_id}:unexpected_status:{result.get('status')}"
                    )
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
                failures.append(f"{reingest_id}:{exc}")
    finally:
        archive.close()

    logger.info(
        "PA2.30.10 recovery batch finished recovered=%s skipped_consumed=%s failures=%s",
        recovered,
        skipped_consumed,
        failures,
    )

    if failures:
        return {
            "status": "partial_failure",
            "recovered": recovered,
            "skipped_consumed": skipped_consumed,
            "failures": failures,
        }
    if recovered + skipped_consumed != expected_unique:
        logger.error("PA2.30.10 recovery batch terminal count mismatch.")
        return {
            "status": "blocked",
            "stage": "terminal_count",
            "recovered": recovered,
            "skipped_consumed": skipped_consumed,
        }

    cleanup = await repo.cleanup_offer_source_recovery_transfer(transfer_id=transfer_id)
    logger.info("PA2.30.10 transfer cleanup: %s", cleanup)
    return {
        "status": "completed",
        "recovered": recovered,
        "skipped_consumed": skipped_consumed,
        "cleanup": cleanup,
        "automatic_ambiguous_selection": False,
        "automatic_promotion": False,
    }


def install_offer_source_recovery_bootstrap(app: FastAPI) -> None:
    @app.get("/v1/remediation/pa23010-upload", response_class=HTMLResponse)
    async def pa23010_upload_form() -> str:
        if not os.getenv("PA23010_UPLOAD_TOKEN", "").strip():
            raise HTTPException(status_code=404, detail="PA2.30.10 upload bridge is disabled.")
        return """<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PA2.30.10 Recovery Upload</title></head>
<body style="font-family:system-ui;max-width:720px;margin:40px auto;padding:0 20px">
<h1>PA2.30.10 Recovery Upload</h1>
<p>Upload only the validated 14-source recovery ZIP. The server verifies the exact SHA-256 before any recovery starts.</p>
<form method="post" enctype="multipart/form-data">
<label>One-time token<br><input type="password" name="token" required style="width:100%"></label><br><br>
<label>Recovery ZIP<br><input type="file" name="upload" accept=".zip,application/zip" required></label><br><br>
<button type="submit">Execute controlled recovery</button>
</form></body></html>"""

    @app.post("/v1/remediation/pa23010-upload")
    async def pa23010_upload(
        upload: UploadFile = File(...),
        token: str = Form(...),
    ) -> dict[str, object]:
        expected_token = os.getenv("PA23010_UPLOAD_TOKEN", "")
        if not expected_token or not secrets.compare_digest(token, expected_token):
            raise HTTPException(status_code=403, detail="Invalid one-time upload token.")

        archive_payload = await _read_upload(
            upload,
            max_bytes=MAX_ARCHIVE_BYTES,
            label="PA2.30.10 recovery archive",
        )
        expected_sha = _required_env("OFFER_SOURCE_RECOVERY_BOOTSTRAP_ARCHIVE_SHA256").lower()
        actual_sha = hashlib.sha256(archive_payload).hexdigest()
        if actual_sha != expected_sha:
            raise HTTPException(status_code=422, detail="Recovery archive checksum mismatch.")

        # Parse before persistence so malformed ZIPs never enter the transfer buffer.
        archive, _ = _archive_members(archive_payload)
        archive.close()

        transfer_id = _required_env("OFFER_SOURCE_RECOVERY_BOOTSTRAP_TRANSFER_ID")
        repo = WorkerRepository()
        encoded = base64.b64encode(archive_payload).decode("ascii")
        chunk_chars = 150000
        for part_no, offset in enumerate(range(0, len(encoded), chunk_chars)):
            stored = await repo.store_offer_source_recovery_transfer_chunk(
                transfer_id=transfer_id,
                part_no=part_no,
                payload_base64=encoded[offset:offset + chunk_chars],
            )
            if stored.get("status") != "stored":
                raise HTTPException(status_code=503, detail=f"Transfer chunk {part_no} was not stored.")

        result = await execute_offer_source_recovery_bootstrap()
        return {
            **result,
            "archive_sha256": actual_sha,
            "bridge": "PA2.30.10-one-shot",
        }

    @app.on_event("startup")
    async def schedule_offer_source_recovery_bootstrap() -> None:
        if not os.getenv("OFFER_SOURCE_RECOVERY_BOOTSTRAP_TRANSFER_ID", "").strip():
            return
        try:
            # Parse configuration synchronously so malformed settings fail closed
            # before a background task is scheduled.
            _required_env("OFFER_SOURCE_RECOVERY_BOOTSTRAP_ORGANIZATION_ID")
            _required_env("OFFER_SOURCE_RECOVERY_BOOTSTRAP_ACTOR_ID")
            _expected_count("OFFER_SOURCE_RECOVERY_BOOTSTRAP_EXPECTED_UNIQUE")
            _expected_count("OFFER_SOURCE_RECOVERY_BOOTSTRAP_EXPECTED_AMBIGUOUS")
            _required_env("OFFER_SOURCE_RECOVERY_BOOTSTRAP_ARCHIVE_SHA256")
        except (ValueError, TypeError) as exc:
            logger.error("PA2.30.10 bootstrap configuration rejected: %s", exc)
            return

        task = asyncio.create_task(execute_offer_source_recovery_bootstrap())
        bootstrap_tasks.add(task)
        task.add_done_callback(bootstrap_tasks.discard)
