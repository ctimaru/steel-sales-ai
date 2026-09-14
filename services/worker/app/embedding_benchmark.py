from __future__ import annotations

import statistics
import time
from dataclasses import dataclass
from typing import Any, Protocol

from .embeddings import (
    EmbeddingProvider,
    EmbeddingProviderError,
    HuggingFaceEmbeddingProvider,
)
from .repository import WorkerRepository


class EmbeddingBenchmarkRepository(Protocol):
    async def get_embedding_model(self, model_key: str) -> dict[str, Any] | None: ...

    async def get_chunks_needing_embedding(
        self, *, model_key: str, limit: int
    ) -> list[dict[str, Any]]: ...

    async def get_embedding_benchmark_cases(self, *, limit: int) -> list[dict[str, Any]]: ...

    async def search_embedding_benchmark(
        self,
        *,
        model_key: str,
        query_embedding: list[float],
        match_count: int,
    ) -> list[dict[str, Any]]: ...


@dataclass(frozen=True)
class BenchmarkCaseResult:
    case_key: str
    language_code: str
    recall_at_5: float
    reciprocal_rank_at_10: float
    hit_at_5: bool
    retrieved_count: int
    search_latency_ms: float

    def as_dict(self) -> dict[str, object]:
        return {
            "case_key": self.case_key,
            "language_code": self.language_code,
            "recall_at_5": round(self.recall_at_5, 6),
            "reciprocal_rank_at_10": round(self.reciprocal_rank_at_10, 6),
            "hit_at_5": self.hit_at_5,
            "retrieved_count": self.retrieved_count,
            "search_latency_ms": round(self.search_latency_ms, 3),
        }


@dataclass(frozen=True)
class EmbeddingBenchmarkResult:
    model_key: str
    model_name: str
    dimensions: int
    case_count: int
    recall_at_5: float
    mrr_at_10: float
    hit_rate_at_5: float
    embedding_latency_ms_per_query: float
    search_latency_ms_mean: float
    search_latency_ms_p95: float
    estimated_total_latency_ms_per_query: float
    embedding_throughput_qps: float
    cases: tuple[BenchmarkCaseResult, ...]

    def as_dict(self, *, include_cases: bool = False) -> dict[str, object]:
        payload: dict[str, object] = {
            "model_key": self.model_key,
            "model_name": self.model_name,
            "dimensions": self.dimensions,
            "case_count": self.case_count,
            "recall_at_5": round(self.recall_at_5, 6),
            "mrr_at_10": round(self.mrr_at_10, 6),
            "hit_rate_at_5": round(self.hit_rate_at_5, 6),
            "embedding_latency_ms_per_query": round(self.embedding_latency_ms_per_query, 3),
            "search_latency_ms_mean": round(self.search_latency_ms_mean, 3),
            "search_latency_ms_p95": round(self.search_latency_ms_p95, 3),
            "estimated_total_latency_ms_per_query": round(
                self.estimated_total_latency_ms_per_query, 3
            ),
            "embedding_throughput_qps": round(self.embedding_throughput_qps, 3),
        }
        if include_cases:
            payload["cases"] = [case.as_dict() for case in self.cases]
        return payload


@dataclass(frozen=True)
class EmbeddingBenchmarkSuiteResult:
    results: tuple[EmbeddingBenchmarkResult, ...]
    recommended_model_key: str | None
    quality_margin: float

    def as_dict(self, *, include_cases: bool = False) -> dict[str, object]:
        return {
            "quality_margin": self.quality_margin,
            "recommended_model_key": self.recommended_model_key,
            "results": [
                result.as_dict(include_cases=include_cases) for result in self.results
            ],
        }


def _prepare_query(text: str, config: dict[str, Any]) -> str:
    prefix = str(config.get("query_prefix") or "")
    return f"{prefix}{text}" if prefix else text


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * percentile
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def recommend_embedding_model(
    results: list[EmbeddingBenchmarkResult] | tuple[EmbeddingBenchmarkResult, ...],
    *,
    quality_margin: float = 0.03,
) -> str | None:
    """Prefer the smallest model that remains within the quality margin of the best."""
    if quality_margin < 0 or quality_margin > 1:
        raise ValueError("quality_margin must be between 0 and 1.")
    if not results:
        return None

    best_recall = max(result.recall_at_5 for result in results)
    best_mrr = max(result.mrr_at_10 for result in results)
    eligible = [
        result
        for result in results
        if result.recall_at_5 >= best_recall - quality_margin
        and result.mrr_at_10 >= best_mrr - quality_margin
    ]
    if not eligible:
        return None
    eligible.sort(
        key=lambda result: (
            result.dimensions,
            result.estimated_total_latency_ms_per_query,
            -result.recall_at_5,
            -result.mrr_at_10,
        )
    )
    return eligible[0].model_key


async def run_embedding_benchmark(
    *,
    model_key: str,
    case_limit: int = 40,
    match_count: int = 10,
    repository: EmbeddingBenchmarkRepository | None = None,
    provider: EmbeddingProvider | None = None,
) -> EmbeddingBenchmarkResult:
    if not model_key.strip():
        raise ValueError("model_key is required.")
    if case_limit < 2 or case_limit > 200:
        raise ValueError("case_limit must be between 2 and 200.")
    if match_count < 5 or match_count > 100:
        raise ValueError("match_count must be between 5 and 100.")

    repo = repository or WorkerRepository()
    model = await repo.get_embedding_model(model_key)
    if not model:
        raise ValueError(f"Unknown embedding model: {model_key}.")

    incomplete = await repo.get_chunks_needing_embedding(model_key=model_key, limit=1)
    if incomplete:
        raise RuntimeError(
            f"Embedding benchmark requires complete embeddings for {model_key}; "
            "at least one chunk is missing or stale."
        )

    cases = await repo.get_embedding_benchmark_cases(limit=case_limit)
    if not cases:
        raise RuntimeError("No embedding benchmark cases are available.")

    model_name = str(model["model_name"])
    dimensions = int(model["dimensions"])
    normalize = bool(model.get("normalized", True))
    config = model.get("config") or {}
    if not isinstance(config, dict):
        config = {}

    texts = [_prepare_query(str(case["query_text"]), config) for case in cases]
    embedder = provider or HuggingFaceEmbeddingProvider()
    embed_started = time.perf_counter()
    vectors = await embedder.embed(texts, model_name=model_name, normalize=normalize)
    embed_elapsed_ms = (time.perf_counter() - embed_started) * 1000

    if len(vectors) != len(cases):
        raise EmbeddingProviderError(
            f"Embedding provider returned {len(vectors)} vectors for {len(cases)} benchmark queries."
        )
    for vector in vectors:
        if len(vector) != dimensions:
            raise EmbeddingProviderError(
                f"Model {model_key} returned {len(vector)} dimensions; expected {dimensions}."
            )

    case_results: list[BenchmarkCaseResult] = []
    search_latencies: list[float] = []
    for case, vector in zip(cases, vectors, strict=True):
        search_started = time.perf_counter()
        rows = await repo.search_embedding_benchmark(
            model_key=model_key,
            query_embedding=vector,
            match_count=match_count,
        )
        search_latency_ms = (time.perf_counter() - search_started) * 1000
        search_latencies.append(search_latency_ms)

        targets = {str(chunk_id) for chunk_id in (case.get("target_chunk_ids") or [])}
        retrieved = [str(row["chunk_id"]) for row in rows]
        top_five = retrieved[:5]
        hits_at_five = sum(1 for chunk_id in top_five if chunk_id in targets)
        recall_at_five = hits_at_five / len(targets) if targets else 0.0

        reciprocal_rank = 0.0
        for rank, chunk_id in enumerate(retrieved[:10], start=1):
            if chunk_id in targets:
                reciprocal_rank = 1.0 / rank
                break

        case_results.append(
            BenchmarkCaseResult(
                case_key=str(case["case_key"]),
                language_code=str(case["language_code"]),
                recall_at_5=recall_at_five,
                reciprocal_rank_at_10=reciprocal_rank,
                hit_at_5=hits_at_five > 0,
                retrieved_count=len(retrieved),
                search_latency_ms=search_latency_ms,
            )
        )

    case_count = len(case_results)
    embedding_latency_ms_per_query = embed_elapsed_ms / case_count
    throughput = case_count / (embed_elapsed_ms / 1000) if embed_elapsed_ms > 0 else 0.0
    mean_search_ms = statistics.fmean(search_latencies) if search_latencies else 0.0
    return EmbeddingBenchmarkResult(
        model_key=model_key,
        model_name=model_name,
        dimensions=dimensions,
        case_count=case_count,
        recall_at_5=statistics.fmean(case.recall_at_5 for case in case_results),
        mrr_at_10=statistics.fmean(
            case.reciprocal_rank_at_10 for case in case_results
        ),
        hit_rate_at_5=statistics.fmean(1.0 if case.hit_at_5 else 0.0 for case in case_results),
        embedding_latency_ms_per_query=embedding_latency_ms_per_query,
        search_latency_ms_mean=mean_search_ms,
        search_latency_ms_p95=_percentile(search_latencies, 0.95),
        estimated_total_latency_ms_per_query=embedding_latency_ms_per_query + mean_search_ms,
        embedding_throughput_qps=throughput,
        cases=tuple(case_results),
    )


async def run_embedding_benchmark_suite(
    *,
    model_keys: list[str] | tuple[str, ...],
    case_limit: int = 40,
    match_count: int = 10,
    quality_margin: float = 0.03,
    repository: EmbeddingBenchmarkRepository | None = None,
    provider: EmbeddingProvider | None = None,
) -> EmbeddingBenchmarkSuiteResult:
    if not model_keys:
        raise ValueError("At least one model key is required.")

    repo = repository or WorkerRepository()
    embedder = provider or HuggingFaceEmbeddingProvider()
    results: list[EmbeddingBenchmarkResult] = []
    for model_key in model_keys:
        results.append(
            await run_embedding_benchmark(
                model_key=model_key,
                case_limit=case_limit,
                match_count=match_count,
                repository=repo,
                provider=embedder,
            )
        )

    return EmbeddingBenchmarkSuiteResult(
        results=tuple(results),
        recommended_model_key=recommend_embedding_model(
            results, quality_margin=quality_margin
        ),
        quality_margin=quality_margin,
    )
