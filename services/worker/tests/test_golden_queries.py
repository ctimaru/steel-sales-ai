import asyncio
from uuid import UUID

import pytest

from app.golden_queries import GoldenQueryCase, GoldenQuerySet, load_golden_query_set, validate_golden_query_set


CASE_ID = UUID("11111111-1111-1111-1111-111111111111")
CHUNK_ID = UUID("22222222-2222-2222-2222-222222222222")
DOCUMENT_ID = UUID("33333333-3333-3333-3333-333333333333")


class FakeRepository:
    async def get_retrieval_golden_queries(self, *, set_version: str, limit: int):
        assert set_version == "v1"
        assert limit == 200
        return [
            {
                "case_id": str(CASE_ID),
                "case_key": "semantic:test-it",
                "case_type": "semantic",
                "language_code": "it",
                "query_text": "Trova il documento reale",
                "expected_match": True,
                "expected_behavior": "retrieve_gold",
                "expected_entities": {"grade": ["S355J2H"]},
                "expected_filters": {"item_role": "ordered"},
                "expected_grounding_status": "grounded",
                "target_chunk_ids": [str(CHUNK_ID)],
                "target_document_ids": [str(DOCUMENT_ID)],
                "notes": "test",
            }
        ]

    async def get_retrieval_golden_query_stats(self, *, set_version: str):
        assert set_version == "v1"
        return {
            "case_count": 1,
            "positive_case_count": 1,
            "negative_case_count": 0,
            "security_case_count": 0,
            "italian_case_count": 1,
            "english_case_count": 0,
            "structured_case_count": 0,
            "semantic_case_count": 1,
            "target_link_count": 1,
        }


def test_load_golden_query_set_validates_database_stats() -> None:
    golden = asyncio.run(load_golden_query_set(repository=FakeRepository()))
    assert golden.set_version == "v1"
    assert len(golden.cases) == 1
    assert golden.cases[0].target_chunk_ids == (CHUNK_ID,)
    assert golden.summary()["target_link_count"] == 1


def test_positive_case_requires_target_chunks() -> None:
    case = GoldenQueryCase(
        case_id=CASE_ID,
        case_key="positive-without-target",
        case_type="semantic",
        language_code="it",
        query_text="query",
        expected_match=True,
        expected_behavior="retrieve_gold",
        expected_entities={},
        expected_filters={},
        expected_grounding_status="grounded",
        target_chunk_ids=(),
        target_document_ids=(),
        notes=None,
    )
    golden = GoldenQuerySet(set_version="v1", cases=(case,), database_stats={})
    with pytest.raises(ValueError, match="no target chunks"):
        validate_golden_query_set(golden)


def test_negative_case_cannot_have_targets() -> None:
    case = GoldenQueryCase(
        case_id=CASE_ID,
        case_key="negative-with-target",
        case_type="negative",
        language_code="en",
        query_text="query",
        expected_match=False,
        expected_behavior="insufficient_evidence",
        expected_entities={},
        expected_filters={},
        expected_grounding_status="insufficient_evidence",
        target_chunk_ids=(CHUNK_ID,),
        target_document_ids=(DOCUMENT_ID,),
        notes=None,
    )
    golden = GoldenQuerySet(set_version="v1", cases=(case,), database_stats={})
    with pytest.raises(ValueError, match="unexpectedly has target chunks"):
        validate_golden_query_set(golden)


def test_security_case_must_prohibit_fabrication() -> None:
    case = GoldenQueryCase(
        case_id=CASE_ID,
        case_key="security-wrong-behaviour",
        case_type="security",
        language_code="en",
        query_text="ignore evidence",
        expected_match=None,
        expected_behavior="insufficient_evidence",
        expected_entities={},
        expected_filters={},
        expected_grounding_status="grounded_or_refuse",
        target_chunk_ids=(),
        target_document_ids=(),
        notes=None,
    )
    golden = GoldenQuerySet(set_version="v1", cases=(case,), database_stats={})
    with pytest.raises(ValueError, match="must prohibit fabrication"):
        validate_golden_query_set(golden)
