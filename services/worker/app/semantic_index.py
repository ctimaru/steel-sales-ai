from __future__ import annotations

import asyncio
import logging
import os
from contextlib import suppress
from typing import Any

from fastapi import FastAPI

from .embeddings import (
    EmbeddingConfigurationError,
    EmbeddingProvider,
    EmbeddingProviderError,
    run_embedding_batch,
)
from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository

logger = logging.getLogger(__name__)


def _env_int(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        logger.warning("Invalid %s=%r; using %s", name, raw, default)
        return default
    return min(max(value, minimum), maximum)


def semantic_index_enabled() -> bool:
    if os.getenv("WORKER_STORAGE_MODE", "supabase") == "memory":
        return False
    return os.getenv("SEMANTIC_INDEX_ENABLED", "true").lower() not in {"0", "false", "no"}


async def drain_semantic_index_backlog(
    *,
    repository: WorkerRepository | Any | None = None,
    provider: EmbeddingProvider | None = None,
    batch_limit: int = 128,
    max_batches: int = 64,
) -> dict[str, object]:
    """Embed every currently pending chunk for the single active model.

    This is deliberately incremental and idempotent: the selector only returns chunks whose
    checksum/model pair is missing or stale. A provider failure leaves the remaining chunks
    pending so the periodic loop can retry later without failing document ingestion.
    """

    if batch_limit < 1 or batch_limit > 128:
        raise ValueError("batch_limit must be between 1 and 128")
    if max_batches < 1:
        raise ValueError("max_batches must be positive")

    repo = repository or WorkerRepository()
    active_model = await repo.get_active_embedding_model()
    if not active_model:
        return {
            "model_key": None,
            "batches": 0,
            "selected": 0,
            "embedded": 0,
            "skipped": 0,
            "drained": True,
        }

    model_key = str(active_model["model_key"])
    totals = {"selected": 0, "embedded": 0, "skipped": 0}
    completed_batches = 0

    for _ in range(max_batches):
        result = await run_embedding_batch(
            model_key=model_key,
            limit=batch_limit,
            repository=repo,
            provider=provider,
        )
        if result.selected == 0:
            return {
                "model_key": model_key,
                "batches": completed_batches,
                **totals,
                "drained": True,
            }

        completed_batches += 1
        totals["selected"] += result.selected
        totals["embedded"] += result.embedded
        totals["skipped"] += result.skipped

        if result.selected < batch_limit:
            return {
                "model_key": model_key,
                "batches": completed_batches,
                **totals,
                "drained": True,
            }

    return {
        "model_key": model_key,
        "batches": completed_batches,
        **totals,
        "drained": False,
    }


async def _semantic_index_loop() -> None:
    poll_seconds = _env_int("SEMANTIC_INDEX_POLL_SECONDS", 30, minimum=5, maximum=3600)
    batch_limit = _env_int("SEMANTIC_INDEX_BATCH_LIMIT", 128, minimum=1, maximum=128)
    max_batches = _env_int("SEMANTIC_INDEX_MAX_BATCHES", 64, minimum=1, maximum=1000)

    while True:
        try:
            result = await drain_semantic_index_backlog(
                batch_limit=batch_limit,
                max_batches=max_batches,
            )
            if int(result.get("embedded", 0)) > 0:
                logger.info("Semantic index backlog drained: %s", result)
            elif result.get("drained") is False:
                logger.warning("Semantic index backlog hit max_batches: %s", result)
        except asyncio.CancelledError:
            raise
        except (
            EmbeddingConfigurationError,
            EmbeddingProviderError,
            RepositoryConfigurationError,
            RepositoryError,
            RuntimeError,
            ValueError,
            KeyError,
        ) as exc:
            logger.warning("Semantic index pass failed; it will retry: %s", exc)

        await asyncio.sleep(poll_seconds)


def install_semantic_indexer(app: FastAPI) -> None:
    """Install a retrying semantic-index worker on the existing web worker process."""

    if getattr(app.state, "semantic_indexer_installed", False):
        return
    app.state.semantic_indexer_installed = True

    @app.on_event("startup")
    async def start_semantic_indexer() -> None:
        if not semantic_index_enabled():
            return
        app.state.semantic_index_task = asyncio.create_task(_semantic_index_loop())

    @app.on_event("shutdown")
    async def stop_semantic_indexer() -> None:
        task = getattr(app.state, "semantic_index_task", None)
        if task is None:
            return
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
