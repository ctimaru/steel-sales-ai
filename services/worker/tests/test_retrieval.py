from __future__ import annotations

import asyncio
from typing import Any
from uuid import UUID

from app.retrieval import infer_item_role, search_knowledge


OWNER_ID = UUID("f45fab6e-3da8-41aa-8711-fc1b337a7dde")


class FakeProvider:
    def __init__(self) -> None:
        self.texts: list[str] = []
        self.model_name: str | None = None
        self.normalize: bool | None = None

    async def embed(
        self,
        texts: list[str],
        *,
        model_name: str,
        normalize: bool,
    ) -> list[list[float]]:
        self.texts = texts
        self.model_name = model_name
        self.normalize = normalize
        return [[0.1, 0.2, 0.3]]


class FakeRepository:
    def __init__(self) -> None:
        self.search_args: dict[str, Any] = {}

    async def get_active_embedding_model(self) -> dict[str, Any]:
        return {
            "model_key": "test-e5",
            "model_name": "test/e5",
            "dimensions": 3,
            "normalized": True,
            "status": "active",
            "config": {"query_prefix": "Instruct: steel tubes\nQuery: "},
        }

    async def hybrid_search_knowledge(self, **kwargs: Any) -> list[dict[str, Any]]:
        self.search_args = kwargs
        return [
            {
                "chunk_id": "chunk-1",
                "content": "EN 10219 tubolare S355J2H 200x100x8",
                "rrf_score": 0.05,
                "matched_entities": [
                    {"entity_type": "grade", "canonical_name": "S355J2H"}
                ],
            }
        ]


def test_infer_item_role_is_conservative() -> None:
    assert infer_item_role("Trova offerte S355J2H") == "offered"
    assert infer_item_role("Find delivered S355J2H tubes") == "delivered"
    assert infer_item_role("Confronta offerte e ordini S355J2H") is None
    assert infer_item_role("S355J2H EN 10219") is None


def test_search_knowledge_uses_active_model_prefix_and_inferred_role() -> None:
    repo = FakeRepository()
    provider = FakeProvider()

    result = asyncio.run(
        search_knowledge(
            owner_id=OWNER_ID,
            query="Trova offerte S355J2H EN 10219 tubi rettangolari",
            match_count=5,
            candidate_count=40,
            entity_filters={
                "grade": ["S355J2H"],
                "standard": ["EN 10219"],
            },
            repository=repo,
            provider=provider,
        )
    )

    assert provider.texts == [
        "Instruct: steel tubes\nQuery: Trova offerte S355J2H EN 10219 tubi rettangolari"
    ]
    assert provider.model_name == "test/e5"
    assert provider.normalize is True
    assert repo.search_args["owner_id"] == OWNER_ID
    assert repo.search_args["query_embedding"] == [0.1, 0.2, 0.3]
    assert repo.search_args["commercial_filters"] == {"item_role": "offered"}
    assert repo.search_args["document_filters"] == {}
    assert repo.search_args["entity_filters"] == {
        "grade": ["S355J2H"],
        "standard": ["EN 10219"],
    }
    assert result["count"] == 1
    assert result["model"]["model_key"] == "test-e5"
    assert result["retrieval"]["strategy"] == "hybrid_rrf"
    assert result["retrieval"]["document_filters"] == {}


def test_explicit_commercial_role_overrides_inference() -> None:
    repo = FakeRepository()
    provider = FakeProvider()

    asyncio.run(
        search_knowledge(
            owner_id=OWNER_ID,
            query="Trova offerte S355J2H",
            commercial_filters={"item_role": "ordered", "thickness_mm": 8.0},
            repository=repo,
            provider=provider,
        )
    )

    assert repo.search_args["commercial_filters"] == {
        "item_role": "ordered",
        "thickness_mm": 8.0,
    }


def test_document_filters_are_normalized_and_forwarded() -> None:
    repo = FakeRepository()
    provider = FakeProvider()

    result = asyncio.run(
        search_knowledge(
            owner_id=OWNER_ID,
            query="S355J2H Bologna",
            document_filters={
                "source_class": " internal ",
                "document_query": " Bologna ",
                "date_from": "2026-09-01",
                "date_to": "2026-09-30",
            },
            repository=repo,
            provider=provider,
        )
    )

    expected = {
        "source_class": "internal",
        "document_query": "Bologna",
        "date_from": "2026-09-01",
        "date_to": "2026-09-30",
    }
    assert repo.search_args["document_filters"] == expected
    assert result["retrieval"]["document_filters"] == expected


def test_document_date_range_must_be_ordered() -> None:
    try:
        asyncio.run(
            search_knowledge(
                owner_id=OWNER_ID,
                query="S355J2H",
                document_filters={
                    "date_from": "2026-09-30",
                    "date_to": "2026-09-01",
                },
                repository=FakeRepository(),
                provider=FakeProvider(),
            )
        )
    except ValueError as exc:
        assert "date_from" in str(exc)
    else:
        raise AssertionError("Expected document date validation to fail")


def test_candidate_count_must_cover_result_limit() -> None:
    try:
        asyncio.run(
            search_knowledge(
                owner_id=OWNER_ID,
                query="S355J2H",
                match_count=20,
                candidate_count=10,
                repository=FakeRepository(),
                provider=FakeProvider(),
            )
        )
    except ValueError as exc:
        assert "candidate_count" in str(exc)
    else:
        raise AssertionError("Expected candidate_count validation to fail")
