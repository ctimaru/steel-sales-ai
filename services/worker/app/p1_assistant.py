from __future__ import annotations

import re
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .assistant_market import answer_assistant
from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository
from .retrieval_api import require_worker_token

_CITATION_RE = re.compile(r"\[S\d+\]")


class P1AssistantRequest(BaseModel):
    actor_user_id: UUID
    query: str = Field(min_length=2, max_length=1000)
    context: dict[str, object] | None = None


class P1AssistantError(RuntimeError):
    pass


def _compact(value: object, limit: int = 1400) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _structured_snippet(row: dict[str, Any]) -> str:
    if row.get("source_text"):
        return _compact(row.get("source_text"))
    technical = [
        row.get("grade"),
        row.get("standard"),
        f"OD {row.get('outer_diameter_mm')} mm" if row.get("outer_diameter_mm") is not None else None,
        f"W {row.get('width_mm')} mm" if row.get("width_mm") is not None else None,
        f"H {row.get('height_mm')} mm" if row.get("height_mm") is not None else None,
        f"t {row.get('thickness_mm')} mm" if row.get("thickness_mm") is not None else None,
        f"L {row.get('length_mm')} mm" if row.get("length_mm") is not None else None,
        f"price {row.get('price_value')} {row.get('currency') or ''}/{row.get('price_unit') or ''}"
        if row.get("price_value") is not None
        else None,
        row.get("commercial_at") or row.get("offered_at"),
    ]
    return " · ".join(str(value) for value in technical if value)


def _structured_evidence(payload: dict[str, Any]) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    observations = payload.get("observations")
    if isinstance(observations, list):
        for row in observations[:6]:
            if not isinstance(row, dict):
                continue
            thread_id = row.get("thread_id")
            citation_id = f"S{len(evidence) + 1}"
            evidence.append(
                {
                    "citation_id": citation_id,
                    "chunk_id": "",
                    "source_id": "",
                    "document_id": "",
                    "content": _structured_snippet(row),
                    "language_code": None,
                    "title": row.get("thread_subject") or row.get("source_filename") or "Commercial observation",
                    "filename": row.get("source_filename"),
                    "document_type": "commercial_observation",
                    "source_name": row.get("source_filename") or "Commercial Memory",
                    "source_class": "structured",
                    "source_uri": None,
                    "page_start": None,
                    "page_end": None,
                    "section_path": None,
                    "source_locator": {"thread_id": thread_id} if thread_id else {},
                    "vector_similarity": None,
                    "lexical_score": None,
                    "entity_match_count": 0,
                    "rrf_score": None,
                    "matched_entities": [],
                }
            )

    market = payload.get("market")
    if isinstance(market, dict):
        source = market.get("source")
        if isinstance(source, dict) and (source.get("name") or source.get("source_url")):
            citation_id = f"S{len(evidence) + 1}"
            latest_value = source.get("latest_value")
            latest_period = source.get("latest_period")
            content = " · ".join(
                str(value)
                for value in [
                    source.get("name") or source.get("provider"),
                    f"latest {latest_value}" if latest_value is not None else None,
                    latest_period,
                    source.get("display_unit") or source.get("unit"),
                ]
                if value
            )
            evidence.append(
                {
                    "citation_id": citation_id,
                    "chunk_id": "",
                    "source_id": "market",
                    "document_id": "",
                    "content": content,
                    "language_code": None,
                    "title": source.get("name") or "Market source",
                    "filename": None,
                    "document_type": "market_series",
                    "source_name": source.get("provider") or source.get("name"),
                    "source_class": "market",
                    "source_uri": source.get("source_url"),
                    "page_start": None,
                    "page_end": None,
                    "section_path": None,
                    "source_locator": {},
                    "vector_similarity": None,
                    "lexical_score": None,
                    "entity_match_count": 0,
                    "rrf_score": None,
                    "matched_entities": [],
                }
            )
    return evidence[:8]


def _cite_answer(answer: str, citation_ids: list[str]) -> str:
    if not answer or not citation_ids or _CITATION_RE.search(answer):
        return answer
    suffix = " ".join(f"[{citation}]" for citation in citation_ids[:3])
    parts = re.split(r"(?<=[.!?])\s+", answer.strip())
    cited: list[str] = []
    for part in parts:
        cleaned = part.strip()
        if not cleaned:
            continue
        cited.append(f"{cleaned} {suffix}")
    return " ".join(cited)


def _normalize_grounding(payload: dict[str, Any]) -> dict[str, Any]:
    result = dict(payload)
    existing = result.get("evidence")
    evidence = [row for row in existing if isinstance(row, dict)] if isinstance(existing, list) else []
    grounding = dict(result.get("grounding") or {})

    if not evidence and result.get("found"):
        evidence = _structured_evidence(result)
        if evidence:
            citation_ids = [str(item["citation_id"]) for item in evidence]
            result["answer"] = _cite_answer(str(result.get("answer") or ""), citation_ids)
            grounding.update(
                {
                    "status": "grounded",
                    "generator": grounding.get("generator") or "deterministic",
                    "evidence_count": len(evidence),
                    "citations": citation_ids,
                }
            )
    elif evidence:
        grounding["evidence_count"] = len(evidence)
        grounding["citations"] = [str(item.get("citation_id")) for item in evidence if item.get("citation_id")]

    result["evidence"] = evidence
    result["grounding"] = grounding
    return result


class P1AssistantService:
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
            raise P1AssistantError("Active organization access is required.")
        return rows[0]

    async def answer(self, request: P1AssistantRequest) -> dict[str, Any]:
        membership = await self._active_membership(request.actor_user_id)
        if not membership.get("organization_id"):
            raise P1AssistantError("Active organization is missing from membership.")

        payload = await answer_assistant(
            owner_id=request.actor_user_id,
            query=request.query.strip(),
            context=request.context,
        )
        if not isinstance(payload, dict):
            raise P1AssistantError("Assistant returned an invalid payload.")
        result = _normalize_grounding(payload)
        result["access"] = {
            "membership_verified": True,
            "role": membership.get("role"),
        }
        return result


router = APIRouter(prefix="/v1/assistant", tags=["assistant"])


@router.post("")
async def p1_assistant(
    request: P1AssistantRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    require_worker_token(x_worker_token)
    try:
        return await P1AssistantService().answer(request)
    except P1AssistantError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (RepositoryConfigurationError, RepositoryError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
