from __future__ import annotations

import asyncio
from uuid import UUID

import pytest

from app.embedding_benchmark import (
    EmbeddingBenchmarkResult,
    recommend_embedding_model,
    run_embedding_benchmark,
)


TARGET_A = UUID("00000000-0000-0000-0000-000000000001")
TARGET_B = UUID("00000000-0000-0000-0000-000000000002")
OTHER = UUID("00000000-0000-0000-0000-000000000003")


class FakeProvider:
    async def embed(self, texts, *, model_name, normalize):
        assert normalize is True
        assert model_name == "test/model"
        return [[float(index + 1), 0.0, 0.0] for index, _ in enumerate(texts)]


class FakeRepository:
    async def get_embedding_model(self, model_key):
        assert model_key == "test-model"
        return {
            "model_key": model_key,
            "model_name": "test/model",
            "dimensions": 3,
            "normalized": True,
            "config": {"query_prefix": "query: "},
            "status": "candidate",
        }

    async def get_chunks_needing_embedding(self, *, model_key, limit):
        assert model_key == "test-model"
        assert limit == 1
        return []

    async def get_embedding_benchmark_cases(self, *, limit):
        assert limit == 2
        return [
            {
                "case_key": "case-it",
                "language_code": "it",
                "query_text": "Trova tubo",
                "target_chunk_ids": [str(TARGET_A)],
                "target_count": 1,
            },
            {
                "case_key": "case-en",
                "language_code": "en",
                "query_text": "Find tube",
                "target_chunk_ids": [str(TARGET_B)],
                "target_count": 1,
            },
        ]

    async def search_embedding_benchmark(
        self, *, model_key, query_embedding, match_count
    ):
        assert model_key == "test-model"
        assert match_count == 10
        if query_embedding[0] == 1.0:
            return [
                {"chunk_id": str(TARGET_A), "distance": 0.01},
                {"chunk_id": str(OTHER), "distance": 0.2},
            ]
        return [
            {"chunk_id": str(OTHER), "distance": 0.01},
            {"chunk_id": str(TARGET_B), "distance": 0.1},
        ]


class IncompleteRepository(FakeRepository):
    async def get_chunks_needing_embedding(self, *, model_key, limit):
        return [{"chunk_id": str(TARGET_A)}]


def test_embedding_benchmark_calculates_recall_and_mrr() -> None:
    result = asyncio.run(
        run_embedding_benchmark(
            model_key="test-model",
            case_limit=2,
            match_count=10,
            repository=FakeRepository(),
            provider=FakeProvider(),
        )
    )

    assert result.case_count == 2
    assert result.recall_at_5 == 1.0
    assert result.mrr_at_10 == 0.75
    assert result.hit_rate_at_5 == 1.0
    assert result.dimensions == 3
    assert result.embedding_throughput_qps > 0
    assert result.estimated_total_latency_ms_per_query >= 0


def test_embedding_benchmark_rejects_incomplete_model_index() -> None:
    with pytest.raises(RuntimeError, match="requires complete embeddings"):
        asyncio.run(
            run_embedding_benchmark(
                model_key="test-model",
                case_limit=2,
                match_count=10,
                repository=IncompleteRepository(),
                provider=FakeProvider(),
            )
        )


def _result(
    model_key: str,
    *,
    dimensions: int,
    recall: float,
    mrr: float,
    latency: float,
) -> EmbeddingBenchmarkResult:
    return EmbeddingBenchmarkResult(
        model_key=model_key,
        model_name=model_key,
        dimensions=dimensions,
        case_count=10,
        recall_at_5=recall,
        mrr_at_10=mrr,
        hit_rate_at_5=1.0,
        embedding_latency_ms_per_query=latency / 2,
        search_latency_ms_mean=latency / 2,
        search_latency_ms_p95=latency,
        estimated_total_latency_ms_per_query=latency,
        embedding_throughput_qps=10.0,
        cases=(),
    )


def test_recommendation_prefers_smallest_model_within_quality_margin() -> None:
    results = [
        _result("large", dimensions=1024, recall=0.90, mrr=0.91, latency=40),
        _result("medium", dimensions=768, recall=0.89, mrr=0.90, latency=25),
        _result("small", dimensions=384, recall=0.88, mrr=0.89, latency=10),
    ]

    assert recommend_embedding_model(results, quality_margin=0.03) == "small"
    assert recommend_embedding_model(results, quality_margin=0.01) == "medium"


def test_recommendation_rejects_invalid_margin() -> None:
    with pytest.raises(ValueError):
        recommend_embedding_model([], quality_margin=-0.1)
