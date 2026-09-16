from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, status

from .bulk_import import (
    BulkImportError,
    BulkImportService,
    PrepareBatchRequest,
    PrepareBatchResponse,
    RetryBatchRequest,
    RetryBatchResponse,
    StartBatchRequest,
    StartBatchResponse,
    _require_worker_token,
)
from .repository import RepositoryConfigurationError, RepositoryError

router = APIRouter(prefix="/v1/import-batches", tags=["bulk-import"])


@router.post("/prepare", response_model=PrepareBatchResponse, status_code=status.HTTP_201_CREATED)
async def prepare_import_batch(
    request: PrepareBatchRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> PrepareBatchResponse:
    _require_worker_token(x_worker_token)
    try:
        result = await BulkImportService().prepare_batch(
            actor_user_id=request.actor_user_id,
            files=request.files,
        )
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
            actor_user_id=request.actor_user_id,
            item_ids=request.item_ids,
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
            actor_user_id=request.actor_user_id,
            item_ids=request.item_ids,
        )
        return RetryBatchResponse(**result)
    except (RepositoryConfigurationError, RepositoryError, BulkImportError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
