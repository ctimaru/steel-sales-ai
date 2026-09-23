from __future__ import annotations

import asyncio
import base64
import hashlib
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


async def execute_offer_source_recovery_bootstrap() -> None:
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
        return

    transfer = await repo.get_offer_source_recovery_transfer(transfer_id=transfer_id)
    if transfer.get("status") != "ready":
        logger.error("PA2.30.10 transfer unavailable: %s", transfer)
        return

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
        return
    if recovered + skipped_consumed != expected_unique:
        logger.error("PA2.30.10 recovery batch terminal count mismatch.")
        return

    cleanup = await repo.cleanup_offer_source_recovery_transfer(transfer_id=transfer_id)
    logger.info("PA2.30.10 transfer cleanup: %s", cleanup)


def install_offer_source_recovery_bootstrap(app: FastAPI) -> None:
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
