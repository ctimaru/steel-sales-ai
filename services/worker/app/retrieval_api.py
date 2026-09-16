from __future__ import annotations

import os
from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

from .embeddings import EmbeddingConfigurationError, EmbeddingProviderError
from .repository import RepositoryConfigurationError, RepositoryError
from .retrieval import search_knowledge


class EntityFilters(BaseModel):
    company: list[str] = Field(default_factory=list, max_length=20)
    plant: list[str] = Field(default_factory=list, max_length=20)
    country: list[str] = Field(default_factory=list, max_length=20)
    standard: list[str] = Field(default_factory=list, max_length=20)
    product_family: list[str] = Field(default_factory=list, max_length=20)
    grade: list[str] = Field(default_factory=list, max_length=20)
    process: list[str] = Field(default_factory=list, max_length=20)
    application: list[str] = Field(default_factory=list, max_length=20)


class CommercialFilters(BaseModel):
    item_role: Literal["requested", "offered", "ordered", "delivered"] | None = None
    outer_diameter_mm: float | None = Field(default=None, gt=0)
    width_mm: float | None = Field(default=None, gt=0)
    height_mm: float | None = Field(default=None, gt=0)
    thickness_mm: float | None = Field(default=None, gt=0)
    length_mm: float | None = Field(default=None, gt=0)
    price_min: float | None = Field(default=None, ge=0)
    price_max: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)

    @model_validator(mode="after")
    def validate_price_range(self) -> "CommercialFilters":
        if self.price_min is not None and self.price_max is not None:
            if self.price_min > self.price_max:
                raise ValueError("price_min must be lower than or equal to price_max")
        return self


class DocumentFilters(BaseModel):
    source_class: str | None = Field(default=None, max_length=80)
    source_type: str | None = Field(default=None, max_length=80)
    document_type: str | None = Field(default=None, max_length=120)
    document_id: UUID | None = None
    document_query: str | None = Field(default=None, max_length=255)
    source_query: str | None = Field(default=None, max_length=255)
    date_from: date | None = None
    date_to: date | None = None


class HybridSearchRequest(BaseModel):
    owner_id: UUID
    query: str = Field(min_length=2, max_length=1000)
    limit: int = Field(default=10, ge=1, le=50)
    candidate_count: int = Field(default=60, ge=10, le=250)
    rrf_k: int = Field(default=60, ge=1, le=500)
    infer_item_role: bool = True
    entity_filters: EntityFilters = Field(default_factory=EntityFilters)
    commercial_filters: CommercialFilters = Field(default_factory=CommercialFilters)
    document_filters: DocumentFilters = Field(default_factory=DocumentFilters)


router = APIRouter(prefix="/v1/knowledge", tags=["knowledge"])


def require_worker_token(x_worker_token: str | None) -> None:
    expected = os.getenv("WORKER_INTERNAL_TOKEN")
    if expected and x_worker_token != expected:
        raise HTTPException(status_code=401, detail="Invalid worker token.")


@router.post("/search")
async def hybrid_search_query(
    request: HybridSearchRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    if os.getenv("WORKER_STORAGE_MODE", "supabase") == "memory":
        raise HTTPException(status_code=409, detail="Hybrid retrieval requires durable mode.")
    if request.candidate_count < request.limit:
        raise HTTPException(
            status_code=422,
            detail="candidate_count must be greater than or equal to limit.",
        )
    if request.document_filters.date_from and request.document_filters.date_to:
        if request.document_filters.date_from > request.document_filters.date_to:
            raise HTTPException(
                status_code=422,
                detail="date_from must be before or equal to date_to.",
            )

    try:
        return await search_knowledge(
            owner_id=request.owner_id,
            query=request.query,
            match_count=request.limit,
            candidate_count=request.candidate_count,
            entity_filters=request.entity_filters.model_dump(exclude_defaults=True),
            commercial_filters=request.commercial_filters.model_dump(exclude_none=True),
            document_filters=request.document_filters.model_dump(
                mode="json", exclude_none=True
            ),
            infer_role=request.infer_item_role,
            rrf_k=request.rrf_k,
        )
    except (
        EmbeddingConfigurationError,
        EmbeddingProviderError,
        RepositoryConfigurationError,
        RepositoryError,
        RuntimeError,
        ValueError,
    ) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
