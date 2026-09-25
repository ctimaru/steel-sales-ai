from __future__ import annotations

import asyncio
import base64
import hashlib
import json
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


async def _stage_archive_payload(
    *,
    payload: bytes,
    transfer_id: str,
    expected_sha: str,
) -> dict[str, object]:
    verified = _verify_stage_payload(payload=payload, expected_sha=expected_sha)
    actual_sha = str(verified["archive_sha256"])
    eml_count = int(verified["eml_count"])

    repo = WorkerRepository()
    encoded = base64.b64encode(payload).decode("ascii")
    chunk_chars = 150000
    stored_parts = 0
    for part_no, offset in enumerate(range(0, len(encoded), chunk_chars)):
        stored = await repo.store_offer_source_recovery_transfer_chunk(
            transfer_id=transfer_id,
            part_no=part_no,
            payload_base64=encoded[offset:offset + chunk_chars],
        )
        if stored.get("status") != "stored":
            raise RuntimeError(f"PA2.30.16 transfer chunk {part_no} was not stored.")
        stored_parts += 1

    return {
        "status": "staged",
        "transfer_id": transfer_id,
        "archive_sha256": actual_sha,
        "archive_bytes": len(payload),
        "part_count": stored_parts,
        "eml_count": eml_count,
        "automatic_source_selection": False,
        "reingest_executed": False,
        "control_phase": "PA2.30.16c",
    }


def _expected_stage_members() -> set[str]:
    raw = os.getenv("PA23016_STAGE_EXPECTED_MEMBERS", "").strip()
    if not raw:
        raise ValueError("PA23016_STAGE_EXPECTED_MEMBERS is required.")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("PA23016_STAGE_EXPECTED_MEMBERS must be valid JSON.") from exc
    if not isinstance(payload, list) or len(payload) != 2:
        raise ValueError("PA23016_STAGE_EXPECTED_MEMBERS must contain exactly two paths.")
    members: set[str] = set()
    for value in payload:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("PA23016_STAGE_EXPECTED_MEMBERS contains an invalid path.")
        normalized = PurePosixPath(value.strip().replace("\\", "/")).as_posix()
        if normalized.startswith("/") or ".." in PurePosixPath(normalized).parts:
            raise ValueError("PA23016_STAGE_EXPECTED_MEMBERS contains an unsafe path.")
        if PurePosixPath(normalized).suffix.lower() != ".eml":
            raise ValueError("PA23016_STAGE_EXPECTED_MEMBERS may reference only EML files.")
        members.add(normalized.casefold())
    if len(members) != 2:
        raise ValueError("PA23016_STAGE_EXPECTED_MEMBERS must contain two distinct paths.")
    return members


def _verify_stage_payload(*, payload: bytes, expected_sha: str) -> dict[str, object]:
    actual_sha = hashlib.sha256(payload).hexdigest()
    if actual_sha != expected_sha:
        raise ValueError(f"PA2.30.16 archive checksum mismatch: {actual_sha}.")

    expected_members = _expected_stage_members()
    archive, _ = _archive_members(payload)
    try:
        eml_members = [
            PurePosixPath(info.filename.replace("\\", "/")).as_posix()
            for info in archive.infolist()
            if not info.is_dir() and PurePosixPath(info.filename).suffix.lower() == ".eml"
        ]
        if len(eml_members) != 2:
            raise ValueError("PA2.30.16 archive must contain exactly two EML sources.")
        if {member.casefold() for member in eml_members} != expected_members:
            raise ValueError("PA2.30.16 archive EML members do not match the selected sources.")
    finally:
        archive.close()

    return {
        "archive_sha256": actual_sha,
        "archive_bytes": len(payload),
        "eml_count": len(eml_members),
    }


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
    @app.post("/v1/remediation/pa23016-stage")
    async def pa23016_stage(
        upload: UploadFile = File(...),
        token: str = Form(...),
    ) -> dict[str, object]:
        expected_token = os.getenv("PA23016_STAGE_TOKEN", "")
        if not expected_token or not secrets.compare_digest(token, expected_token):
            raise HTTPException(status_code=403, detail="Invalid PA2.30.16 staging token.")

        transfer_id = os.getenv("PA23016_STAGE_TRANSFER_ID", "").strip()
        expected_sha = os.getenv("PA23016_STAGE_ARCHIVE_SHA256", "").strip().lower()
        if not transfer_id or len(expected_sha) != 64:
            raise HTTPException(status_code=503, detail="PA2.30.16 staging is not configured.")

        payload = await _read_upload(
            upload,
            max_bytes=MAX_ARCHIVE_BYTES,
            label="PA2.30.16 selected-source archive",
        )
        try:
            return await _stage_archive_payload(
                payload=payload,
                transfer_id=transfer_id,
                expected_sha=expected_sha,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.get("/v1/remediation/pa23016-stage-console", response_class=HTMLResponse)
    async def pa23016_stage_console() -> str:
        return """
        <!doctype html>
        <html>
          <head><meta charset="utf-8"><title>PA2.30.16c.3c staging</title></head>
          <body>
            <h1>PA2.30.16c.3c — staging only</h1>
            <form method="post" action="/v1/remediation/pa23016-stage-chunk">
              <label>Token <input name="token" type="password"></label><br>
              <label>Part <input name="part_no" type="number" min="0" max="19"></label><br>
              <label>Base64 chunk<br><textarea name="payload_base64" rows="8" cols="100"></textarea></label><br>
              <button type="submit">Store chunk</button>
            </form>
            <hr>
            <form method="post" action="/v1/remediation/pa23016-stage-finalize">
              <label>Token <input name="token" type="password"></label><br>
              <button type="submit">Verify staged archive</button>
            </form>
            <p>No re-ingest or promotion is reachable from this console.</p>
          </body>
        </html>
        """

    @app.post("/v1/remediation/pa23016-stage-chunk")
    async def pa23016_stage_chunk(
        token: str = Form(...),
        part_no: int = Form(...),
        payload_base64: str = Form(...),
    ) -> dict[str, object]:
        expected_token = os.getenv("PA23016_STAGE_TOKEN", "")
        if not expected_token or not secrets.compare_digest(token, expected_token):
            raise HTTPException(status_code=403, detail="Invalid PA2.30.16 staging token.")
        transfer_id = os.getenv("PA23016_STAGE_TRANSFER_ID", "").strip()
        if not transfer_id:
            raise HTTPException(status_code=503, detail="PA2.30.16 staging is not configured.")
        if part_no < 0 or part_no > 19:
            raise HTTPException(status_code=400, detail="Invalid PA2.30.16 staging part number.")
        chunk = payload_base64.strip()
        if not chunk or len(chunk) > 150000:
            raise HTTPException(status_code=413, detail="Invalid PA2.30.16 staging chunk size.")
        try:
            base64.b64decode(chunk, validate=True)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid base64 staging chunk.") from exc

        repo = WorkerRepository()
        stored = await repo.store_offer_source_recovery_transfer_chunk(
            transfer_id=transfer_id,
            part_no=part_no,
            payload_base64=chunk,
        )
        if stored.get("status") != "stored":
            raise HTTPException(status_code=503, detail="PA2.30.16 staging chunk was not stored.")
        return {
            "status": "stored",
            "transfer_id": transfer_id,
            "part_no": part_no,
            "encoded_chars": len(chunk),
            "reingest_executed": False,
            "control_phase": "PA2.30.16c.3c",
        }

    @app.post("/v1/remediation/pa23016-stage-finalize")
    async def pa23016_stage_finalize(token: str = Form(...)) -> dict[str, object]:
        expected_token = os.getenv("PA23016_STAGE_TOKEN", "")
        if not expected_token or not secrets.compare_digest(token, expected_token):
            raise HTTPException(status_code=403, detail="Invalid PA2.30.16 staging token.")
        transfer_id = os.getenv("PA23016_STAGE_TRANSFER_ID", "").strip()
        expected_sha = os.getenv("PA23016_STAGE_ARCHIVE_SHA256", "").strip().lower()
        if not transfer_id or len(expected_sha) != 64:
            raise HTTPException(status_code=503, detail="PA2.30.16 staging is not configured.")

        repo = WorkerRepository()
        transfer = await repo.get_offer_source_recovery_transfer(transfer_id=transfer_id)
        if transfer.get("status") != "ready":
            raise HTTPException(status_code=409, detail="PA2.30.16 transfer is not ready.")
        try:
            payload = base64.b64decode(str(transfer["payload_base64"]), validate=True)
            verified = _verify_stage_payload(payload=payload, expected_sha=expected_sha)
        except (KeyError, ValueError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        return {
            "status": "verified_staged",
            "transfer_id": transfer_id,
            **verified,
            "automatic_source_selection": False,
            "reingest_executed": False,
            "control_phase": "PA2.30.16c.3c",
        }

    @app.on_event("startup")
    async def stage_pa23016_from_env() -> None:
        raw_parts = os.getenv("PA23016_STAGE_ARCHIVE_B64_PARTS", "").strip()
        if not raw_parts:
            return
        transfer_id = os.getenv("PA23016_STAGE_TRANSFER_ID", "").strip()
        expected_sha = os.getenv("PA23016_STAGE_ARCHIVE_SHA256", "").strip().lower()
        if not transfer_id or len(expected_sha) != 64:
            logger.error("PA2.30.16 env staging configuration rejected.")
            return
        try:
            part_count = int(raw_parts)
            if part_count <= 0 or part_count > 20:
                raise ValueError("invalid part count")
            encoded = "".join(
                _required_env(f"PA23016_STAGE_ARCHIVE_B64_PART_{index}")
                for index in range(part_count)
            )
            payload = base64.b64decode(encoded, validate=True)
            result = await _stage_archive_payload(
                payload=payload,
                transfer_id=transfer_id,
                expected_sha=expected_sha,
            )
            logger.info("PA2.30.16 env staging completed: %s", result)
        except (ValueError, RuntimeError, RepositoryConfigurationError, RepositoryError) as exc:
            logger.error("PA2.30.16 env staging failed: %s", exc)

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
