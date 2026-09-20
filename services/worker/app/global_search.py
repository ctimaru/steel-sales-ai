from __future__ import annotations

from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

from .embeddings import EmbeddingConfigurationError, EmbeddingProviderError
from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository
from .retrieval import search_knowledge
from .retrieval_api import require_worker_token
from .shared_reference import enrich_records_with_shared_reference

GlobalResultType = Literal[
    "document",
    "company",
    "product",
    "rfq",
    "offer",
    "order",
    "delivery",
]


class GlobalSearchFilters(BaseModel):
    company: str | None = Field(default=None, max_length=160)
    grade: str | None = Field(default=None, max_length=80)
    standard: str | None = Field(default=None, max_length=120)
    product_family: str | None = Field(default=None, max_length=120)
    item_role: Literal["requested", "offered", "ordered", "delivered"] | None = None
    outer_diameter_mm: float | None = Field(default=None, gt=0)
    width_mm: float | None = Field(default=None, gt=0)
    height_mm: float | None = Field(default=None, gt=0)
    thickness_mm: float | None = Field(default=None, gt=0)
    length_mm: float | None = Field(default=None, gt=0)
    price_min: float | None = Field(default=None, ge=0)
    price_max: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    source: str | None = Field(default=None, max_length=255)
    source_class: str | None = Field(default=None, max_length=80)
    source_type: str | None = Field(default=None, max_length=80)
    document_type: str | None = Field(default=None, max_length=120)
    date_from: date | None = None
    date_to: date | None = None

    @model_validator(mode="after")
    def validate_ranges(self) -> "GlobalSearchFilters":
        if self.price_min is not None and self.price_max is not None:
            if self.price_min > self.price_max:
                raise ValueError("price_min must be lower than or equal to price_max")
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must be before or equal to date_to")
        return self


class GlobalSearchRequest(BaseModel):
    actor_user_id: UUID
    query: str = Field(min_length=2, max_length=1000)
    types: list[GlobalResultType] = Field(default_factory=list, max_length=7)
    filters: GlobalSearchFilters = Field(default_factory=GlobalSearchFilters)
    limit: int = Field(default=30, ge=1, le=100)


class GlobalSearchError(RuntimeError):
    pass


class GlobalSearchService:
    def __init__(self) -> None:
        self.repo = WorkerRepository()

    async def _active_membership(self, actor_user_id: UUID) -> dict[str, object]:
        rows = await self.repo._request(
            "GET",
            "/rest/v1/organization_memberships"
            f"?user_id=eq.{actor_user_id}&status=eq.active"
            "&role=in.(admin,member,viewer)"
            "&select=organization_id,user_id,role,is_default,created_at"
            "&order=is_default.desc,created_at.asc&limit=1",
        )
        if not isinstance(rows, list) or not rows:
            raise GlobalSearchError("Active organization access is required.")
        return rows[0]

    @staticmethod
    def _clean(value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    async def search(self, request: GlobalSearchRequest) -> dict[str, object]:
        membership = await self._active_membership(request.actor_user_id)
        organization_id = membership.get("organization_id")
        if not organization_id:
            raise GlobalSearchError("Active organization is missing from membership.")

        requested_types = list(dict.fromkeys(request.types))
        include_documents = not requested_types or "document" in requested_types
        structured_types = [item for item in requested_types if item != "document"]

        filters = request.filters
        entity_filters = {
            key: [value]
            for key, value in {
                "company": self._clean(filters.company),
                "grade": self._clean(filters.grade),
                "standard": self._clean(filters.standard),
                "product_family": self._clean(filters.product_family),
            }.items()
            if value
        }
        commercial_filters: dict[str, object] = {
            key: value
            for key, value in {
                "item_role": filters.item_role,
                "outer_diameter_mm": filters.outer_diameter_mm,
                "width_mm": filters.width_mm,
                "height_mm": filters.height_mm,
                "thickness_mm": filters.thickness_mm,
                "length_mm": filters.length_mm,
                "price_min": filters.price_min,
                "price_max": filters.price_max,
                "currency": self._clean(filters.currency),
            }.items()
            if value is not None
        }
        document_filters: dict[str, object] = {
            key: value
            for key, value in {
                "source_query": self._clean(filters.source),
                "source_class": self._clean(filters.source_class),
                "source_type": self._clean(filters.source_type),
                "document_type": self._clean(filters.document_type),
                "date_from": filters.date_from.isoformat() if filters.date_from else None,
                "date_to": filters.date_to.isoformat() if filters.date_to else None,
            }.items()
            if value is not None
        }
        structured_filters = {
            key: value
            for key, value in {
                "company": self._clean(filters.company),
                "grade": self._clean(filters.grade),
                "standard": self._clean(filters.standard),
                "item_role": filters.item_role,
                "outer_diameter_mm": filters.outer_diameter_mm,
                "width_mm": filters.width_mm,
                "height_mm": filters.height_mm,
                "thickness_mm": filters.thickness_mm,
                "length_mm": filters.length_mm,
                "price_min": filters.price_min,
                "price_max": filters.price_max,
                "currency": self._clean(filters.currency),
                "source": self._clean(filters.source),
                "date_from": filters.date_from.isoformat() if filters.date_from else None,
                "date_to": filters.date_to.isoformat() if filters.date_to else None,
            }.items()
            if value is not None
        }

        structured_payload: dict[str, object] = {
            "counts": {},
            "results": [],
            "total": 0,
        }
        # Empty structured_types means all structured families only when no type filter exists.
        if not requested_types or structured_types:
            raw = await self.repo._request(
                "POST",
                "/rest/v1/rpc/p1_global_structured_search",
                json={
                    "p_organization_id": str(organization_id),
                    "p_query": request.query.strip(),
                    "p_types": structured_types if requested_types else [],
                    "p_filters": structured_filters,
                    "p_limit": request.limit,
                },
            )
            if not isinstance(raw, dict):
                raise GlobalSearchError("Structured global search returned an invalid payload.")
            structured_payload = raw

        document_results: list[dict[str, object]] = []
        model: dict[str, object] | None = None
        retrieval: dict[str, object] | None = None
        if include_documents:
            semantic = await search_knowledge(
                owner_id=request.actor_user_id,
                query=request.query,
                match_count=min(request.limit, 50),
                candidate_count=max(120, min(250, request.limit * 6)),
                entity_filters=entity_filters,
                commercial_filters=commercial_filters,
                document_filters=document_filters,
                infer_role=filters.item_role is None,
                repository=self.repo,
            )
            model = semantic.get("model") if isinstance(semantic.get("model"), dict) else None
            retrieval = semantic.get("retrieval") if isinstance(semantic.get("retrieval"), dict) else None
            for row in semantic.get("results", []):
                if not isinstance(row, dict):
                    continue
                locator = row.get("source_locator")
                thread_id = locator.get("thread_id") if isinstance(locator, dict) else None
                document_results.append(
                    {
                        "result_type": "document",
                        "result_id": f"chunk:{row.get('chunk_id')}",
                        "title": row.get("title") or row.get("filename") or "Documento",
                        "subtitle": " · ".join(
                            str(value)
                            for value in [row.get("document_type"), row.get("source_name")]
                            if value
                        ),
                        "snippet": row.get("content") or "",
                        "event_at": None,
                        "role": None,
                        "grade": None,
                        "standard": None,
                        "product_type": None,
                        "outer_diameter_mm": None,
                        "width_mm": None,
                        "height_mm": None,
                        "thickness_mm": None,
                        "length_mm": None,
                        "quantity": None,
                        "quantity_unit": None,
                        "price_value": None,
                        "price_unit": None,
                        "currency": None,
                        "source_filename": row.get("filename"),
                        "thread_id": thread_id,
                        "score": row.get("rrf_score") or 0,
                        "metadata": {
                            "chunk_id": row.get("chunk_id"),
                            "document_id": row.get("document_id"),
                            "source_id": row.get("source_id"),
                            "source_uri": row.get("source_uri"),
                            "source_locator": locator,
                            "page_start": row.get("page_start"),
                            "page_end": row.get("page_end"),
                            "section_path": row.get("section_path"),
                            "matched_entities": row.get("matched_entities") or [],
                            "vector_similarity": row.get("vector_similarity"),
                            "lexical_score": row.get("lexical_score"),
                            "rrf_score": row.get("rrf_score"),
                        },
                    }
                )

        structured_results = structured_payload.get("results", [])
        if not isinstance(structured_results, list):
            structured_results = []
        structured_dicts = [row for row in structured_results if isinstance(row, dict)]
        structured_results = await enrich_records_with_shared_reference(self.repo, structured_dicts)
        results = [*document_results, *structured_results]
        results.sort(
            key=lambda item: (
                float(item.get("score") or 0),
                str(item.get("event_at") or ""),
            ),
            reverse=True,
        )
        results = results[: request.limit]

        counts = dict(structured_payload.get("counts") or {})
        if include_documents:
            counts["document"] = len(document_results)

        return {
            "query": request.query.strip(),
            "types": requested_types,
            "filters": request.filters.model_dump(mode="json", exclude_none=True),
            "count": len(results),
            "counts": counts,
            "structured_total": int(structured_payload.get("total") or 0),
            "results": results,
            "model": model,
            "retrieval": retrieval,
        }


router = APIRouter(prefix="/v1/global-search", tags=["global-search"])


@router.post("")
async def global_search(
    request: GlobalSearchRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        return await GlobalSearchService().search(request)
    except (
        EmbeddingConfigurationError,
        EmbeddingProviderError,
        RepositoryConfigurationError,
        RepositoryError,
        GlobalSearchError,
        RuntimeError,
        ValueError,
    ) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
