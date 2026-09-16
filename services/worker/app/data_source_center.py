from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .bulk_import import _require_worker_token
from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository

router = APIRouter(prefix="/v1/data-sources", tags=["data-sources"])


class DataSourceCenterError(RuntimeError):
    pass


DataSourceState = Literal[
    "all",
    "ready",
    "indexed",
    "indexing",
    "processing",
    "duplicate",
    "error",
    "discarded",
]


class DataSourceCenterRequest(BaseModel):
    actor_user_id: UUID
    search: str | None = Field(default=None, max_length=160)
    state: DataSourceState | None = None
    source_key: str | None = Field(default=None, max_length=160)
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class DataSourceSummary(BaseModel):
    total: int = 0
    indexed: int = 0
    indexing: int = 0
    duplicates: int = 0
    errors: int = 0
    discarded: int = 0
    processing: int = 0
    last_sync_at: datetime | None = None
    active_model_key: str | None = None
    active_model_name: str | None = None


class DataSourceOverview(BaseModel):
    source_key: str
    source_name: str
    source_type: str
    total_items: int = 0
    indexed_items: int = 0
    duplicate_items: int = 0
    error_items: int = 0
    last_sync_at: datetime | None = None


class ImportHistoryItem(BaseModel):
    history_id: str
    batch_id: UUID | None = None
    item_id: UUID | None = None
    document_id: UUID | None = None
    display_name: str
    media_type: Literal["email", "file"]
    source_key: str
    source_name: str
    source_type: str
    state: Literal["ready", "processing", "duplicate", "error", "discarded"]
    indexing_state: Literal[
        "indexed",
        "indexing",
        "pending",
        "no_content",
        "not_available",
        "not_applicable",
    ]
    deduplicated: bool = False
    error: str | None = None
    attempt_count: int = 0
    size_bytes: int | None = None
    chunk_count: int = 0
    embedded_count: int = 0
    imported_at: datetime
    last_sync_at: datetime | None = None


class DataSourceCenterResponse(BaseModel):
    summary: DataSourceSummary
    sources: list[DataSourceOverview]
    items: list[ImportHistoryItem]
    total_filtered: int
    limit: int
    offset: int


class DataSourceCenterService:
    def __init__(self) -> None:
        self.repo = WorkerRepository()

    async def _active_membership(self, actor_user_id: UUID) -> dict[str, object]:
        rows = await self.repo._request(
            "GET",
            "/rest/v1/organization_memberships"
            f"?user_id=eq.{actor_user_id}&status=eq.active"
            "&role=in.(admin,member)"
            "&select=organization_id,user_id,role,is_default,created_at"
            "&order=is_default.desc,created_at.asc&limit=1",
        )
        if not isinstance(rows, list) or not rows:
            raise DataSourceCenterError("Active admin/member organization access is required.")
        return rows[0]

    async def history(self, request: DataSourceCenterRequest) -> dict[str, object]:
        membership = await self._active_membership(request.actor_user_id)
        organization_id = membership.get("organization_id")
        if not organization_id:
            raise DataSourceCenterError("Active organization is missing from membership.")

        payload = await self.repo._request(
            "POST",
            "/rest/v1/rpc/p1_data_source_center",
            json={
                "p_organization_id": str(organization_id),
                "p_search": request.search or None,
                "p_state": request.state if request.state != "all" else None,
                "p_source_key": request.source_key or None,
                "p_limit": request.limit,
                "p_offset": request.offset,
            },
        )
        if not isinstance(payload, dict):
            raise DataSourceCenterError("Data source center returned an invalid payload.")
        return payload


@router.post("/history", response_model=DataSourceCenterResponse)
async def data_source_history(
    request: DataSourceCenterRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> DataSourceCenterResponse:
    _require_worker_token(x_worker_token)
    try:
        payload = await DataSourceCenterService().history(request)
        return DataSourceCenterResponse(**payload)
    except (RepositoryConfigurationError, RepositoryError, DataSourceCenterError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
