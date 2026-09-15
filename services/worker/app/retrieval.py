from __future__ import annotations

import re
from typing import Any, Protocol
from uuid import UUID

from .embeddings import (
    EmbeddingProvider,
    EmbeddingProviderError,
    HuggingFaceEmbeddingProvider,
)
from .repository import WorkerRepository


ENTITY_FILTER_TYPES = {
    "company",
    "plant",
    "country",
    "standard",
    "product_family",
    "grade",
    "process",
    "application",
}

COMMERCIAL_FILTER_KEYS = {
    "item_role",
    "outer_diameter_mm",
    "width_mm",
    "height_mm",
    "thickness_mm",
    "length_mm",
}

DOCUMENT_FILTER_KEYS = {
    "source_class",
    "source_type",
    "document_type",
    "document_id",
    "document_query",
    "date_from",
    "date_to",
}

_ROLE_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "offered": (
        re.compile(r"\boffert(?:a|e|o|i)?\b", re.IGNORECASE),
        re.compile(r"\bquote(?:s|d)?\b", re.IGNORECASE),
        re.compile(r"\bquotation(?:s)?\b", re.IGNORECASE),
        re.compile(r"\bpreventiv(?:o|i)\b", re.IGNORECASE),
    ),
    "ordered": (
        re.compile(r"\bordin(?:e|i|ato|ata|ati|ate)\b", re.IGNORECASE),
        re.compile(r"\border(?:s|ed)?\b", re.IGNORECASE),
    ),
    "delivered": (
        re.compile(r"\bconsegn(?:a|e|ato|ata|ati|ate)\b", re.IGNORECASE),
        re.compile(r"\bdeliver(?:y|ies|ed)\b", re.IGNORECASE),
    ),
    "requested": (
        re.compile(r"\brichiest(?:a|e)\b", re.IGNORECASE),
        re.compile(r"\brfq\b", re.IGNORECASE),
        re.compile(r"\brequest(?:s|ed)?\b", re.IGNORECASE),
    ),
}


class HybridRetrievalRepository(Protocol):
    async def get_active_embedding_model(self) -> dict[str, Any] | None: ...

    async def hybrid_search_knowledge(
        self,
        *,
        owner_id: UUID,
        query_text: str,
        query_embedding: list[float],
        match_count: int,
        candidate_count: int,
        entity_filters: dict[str, list[str]],
        commercial_filters: dict[str, object],
        document_filters: dict[str, object],
        rrf_k: int = 60,
    ) -> list[dict[str, Any]]: ...


def _prepare_query(text: str, config: dict[str, Any]) -> str:
    prefix = str(config.get("query_prefix") or "")
    return f"{prefix}{text}" if prefix else text


def infer_item_role(query: str) -> str | None:
    """Infer a commercial role only when exactly one role family is unambiguous."""
    matched = {
        role
        for role, patterns in _ROLE_PATTERNS.items()
        if any(pattern.search(query) for pattern in patterns)
    }
    if len(matched) != 1:
        return None
    return next(iter(matched))


def normalize_entity_filters(
    filters: dict[str, list[str]] | None,
) -> dict[str, list[str]]:
    output: dict[str, list[str]] = {}
    for key, values in (filters or {}).items():
        if key not in ENTITY_FILTER_TYPES:
            raise ValueError(f"Unsupported entity filter: {key}.")
        cleaned = [str(value).strip() for value in values if str(value).strip()]
        if cleaned:
            output[key] = cleaned
    return output


def normalize_commercial_filters(
    query: str,
    filters: dict[str, object] | None,
    *,
    infer_role: bool,
) -> dict[str, object]:
    output = {
        key: value
        for key, value in (filters or {}).items()
        if key in COMMERCIAL_FILTER_KEYS and value is not None
    }
    unsupported = set(filters or {}) - COMMERCIAL_FILTER_KEYS
    if unsupported:
        raise ValueError(
            f"Unsupported commercial filter(s): {', '.join(sorted(unsupported))}."
        )
    if infer_role and "item_role" not in output:
        inferred = infer_item_role(query)
        if inferred:
            output["item_role"] = inferred
    return output


def normalize_document_filters(
    filters: dict[str, object] | None,
) -> dict[str, object]:
    unsupported = set(filters or {}) - DOCUMENT_FILTER_KEYS
    if unsupported:
        raise ValueError(
            f"Unsupported document filter(s): {', '.join(sorted(unsupported))}."
        )

    output: dict[str, object] = {}
    for key, value in (filters or {}).items():
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
            if not value:
                continue
        output[key] = value

    date_from = output.get("date_from")
    date_to = output.get("date_to")
    if date_from and date_to and str(date_from) > str(date_to):
        raise ValueError("date_from must be before or equal to date_to.")
    return output


async def search_knowledge(
    *,
    owner_id: UUID,
    query: str,
    match_count: int = 10,
    candidate_count: int = 60,
    entity_filters: dict[str, list[str]] | None = None,
    commercial_filters: dict[str, object] | None = None,
    document_filters: dict[str, object] | None = None,
    infer_role: bool = True,
    rrf_k: int = 60,
    repository: HybridRetrievalRepository | None = None,
    provider: EmbeddingProvider | None = None,
) -> dict[str, object]:
    query = query.strip()
    if len(query) < 2:
        raise ValueError("query must contain at least 2 characters.")
    if len(query) > 1000:
        raise ValueError("query must contain at most 1000 characters.")
    if match_count < 1 or match_count > 50:
        raise ValueError("match_count must be between 1 and 50.")
    if candidate_count < 10 or candidate_count > 250:
        raise ValueError("candidate_count must be between 10 and 250.")
    if candidate_count < match_count:
        raise ValueError("candidate_count must be greater than or equal to match_count.")
    if rrf_k < 1 or rrf_k > 500:
        raise ValueError("rrf_k must be between 1 and 500.")

    normalized_entities = normalize_entity_filters(entity_filters)
    normalized_commercial = normalize_commercial_filters(
        query,
        commercial_filters,
        infer_role=infer_role,
    )
    normalized_documents = normalize_document_filters(document_filters)

    repo = repository or WorkerRepository()
    model = await repo.get_active_embedding_model()
    if not model:
        raise RuntimeError("No active embedding model is configured.")

    model_key = str(model["model_key"])
    model_name = str(model["model_name"])
    dimensions = int(model["dimensions"])
    normalize = bool(model.get("normalized", True))
    config = model.get("config") or {}
    if not isinstance(config, dict):
        config = {}

    embedder = provider or HuggingFaceEmbeddingProvider()
    vectors = await embedder.embed(
        [_prepare_query(query, config)],
        model_name=model_name,
        normalize=normalize,
    )
    if len(vectors) != 1:
        raise EmbeddingProviderError(
            f"Embedding provider returned {len(vectors)} vectors for one query."
        )
    vector = vectors[0]
    if len(vector) != dimensions:
        raise EmbeddingProviderError(
            f"Active model {model_key} returned {len(vector)} dimensions; expected {dimensions}."
        )

    rows = await repo.hybrid_search_knowledge(
        owner_id=owner_id,
        query_text=query,
        query_embedding=vector,
        match_count=match_count,
        candidate_count=candidate_count,
        entity_filters=normalized_entities,
        commercial_filters=normalized_commercial,
        document_filters=normalized_documents,
        rrf_k=rrf_k,
    )

    return {
        "query": query,
        "model": {
            "model_key": model_key,
            "model_name": model_name,
            "dimensions": dimensions,
        },
        "retrieval": {
            "strategy": "hybrid_rrf",
            "match_count": match_count,
            "candidate_count": candidate_count,
            "rrf_k": rrf_k,
            "entity_filters": normalized_entities,
            "commercial_filters": normalized_commercial,
            "document_filters": normalized_documents,
        },
        "count": len(rows),
        "results": rows,
    }
