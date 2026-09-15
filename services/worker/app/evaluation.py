from __future__ import annotations

import re
import statistics
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import UUID, uuid4

from .embeddings import EmbeddingProvider, HuggingFaceEmbeddingProvider
from .golden_queries import GoldenQueryCase, GoldenQueryRepository, GoldenQuerySet, load_golden_query_set
from .rag import (
    HuggingFaceRagGenerator,
    RagGenerationError,
    RagGenerator,
    answer_is_grounded,
    answer_knowledge_rag,
    cited_ids,
    evidence_is_sufficient,
)
from .retrieval import (
    COMMERCIAL_FILTER_KEYS,
    DOCUMENT_FILTER_KEYS,
    ENTITY_FILTER_TYPES,
    normalize_commercial_filters,
    normalize_document_filters,
    normalize_entity_filters,
)
from .repository import RepositoryError


class EvaluationRepositoryProtocol(Protocol):
    async def get_retrieval_golden_queries(self, *, set_version: str, limit: int) -> list[dict[str, Any]]: ...
    async def get_retrieval_golden_query_stats(self, *, set_version: str) -> dict[str, Any]: ...
    async def get_retrieval_golden_query_owner(self, *, set_version: str) -> UUID: ...
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
    async def create_retrieval_evaluation_run(self, row: dict[str, Any]) -> None: ...
    async def insert_retrieval_evaluation_case_results(self, rows: list[dict[str, Any]]) -> None: ...
    async def complete_retrieval_evaluation_run(self, *, run_id: UUID, values: dict[str, Any]) -> None: ...


class EvaluationRepository(GoldenQueryRepository):
    async def get_retrieval_golden_query_owner(self, *, set_version: str) -> UUID:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/get_retrieval_golden_query_owner",
            json={"p_set_version": set_version},
        )
        if not isinstance(result, str):
            raise RepositoryError("Golden query owner lookup returned an invalid payload.")
        return UUID(result)

    async def create_retrieval_evaluation_run(self, row: dict[str, Any]) -> None:
        await self._request(
            "POST",
            "/rest/v1/retrieval_evaluation_runs",
            json=row,
            prefer="return=minimal",
        )

    async def insert_retrieval_evaluation_case_results(self, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        await self._request(
            "POST",
            "/rest/v1/retrieval_evaluation_case_results",
            json=rows,
            prefer="return=minimal",
        )

    async def complete_retrieval_evaluation_run(self, *, run_id: UUID, values: dict[str, Any]) -> None:
        await self._request(
            "PATCH",
            f"/rest/v1/retrieval_evaluation_runs?id=eq.{run_id}",
            json=values,
            prefer="return=minimal",
        )


@dataclass(frozen=True)
class RetrievalCaseMetrics:
    recall_at_5: float
    recall_at_10: float
    reciprocal_rank_at_10: float
    hit_at_5: bool
    hit_at_10: bool
    document_hit_at_5: bool
    document_hit_at_10: bool
    retrieved_count: int
    provenance_completeness: float
    evidence_sufficient: bool
    relevance_mode: str

    def as_dict(self) -> dict[str, object]:
        return {
            "recall_at_5": round(self.recall_at_5, 6),
            "recall_at_10": round(self.recall_at_10, 6),
            "reciprocal_rank_at_10": round(self.reciprocal_rank_at_10, 6),
            "hit_at_5": self.hit_at_5,
            "hit_at_10": self.hit_at_10,
            "document_hit_at_5": self.document_hit_at_5,
            "document_hit_at_10": self.document_hit_at_10,
            "retrieved_count": self.retrieved_count,
            "provenance_completeness": round(self.provenance_completeness, 6),
            "evidence_sufficient": self.evidence_sufficient,
            "relevance_mode": self.relevance_mode,
        }


@dataclass(frozen=True)
class EvaluationCaseResult:
    case_id: UUID
    case_key: str
    case_type: str
    language_code: str
    retrieval: dict[str, Any]
    rag: dict[str, Any]
    latency: dict[str, float]
    passed: bool
    failure_reasons: tuple[str, ...]

    def as_dict(self) -> dict[str, object]:
        return {
            "case_id": str(self.case_id),
            "case_key": self.case_key,
            "case_type": self.case_type,
            "language_code": self.language_code,
            "retrieval": self.retrieval,
            "rag": self.rag,
            "latency": {key: round(value, 3) for key, value in self.latency.items()},
            "passed": self.passed,
            "failure_reasons": list(self.failure_reasons),
        }


@dataclass(frozen=True)
class EvaluationRunResult:
    run_id: UUID
    set_version: str
    embedding_model_key: str
    rag_model: str | None
    metrics: dict[str, Any]
    quality_gates: dict[str, Any]
    cases: tuple[EvaluationCaseResult, ...]

    @property
    def passed(self) -> bool:
        return bool(self.quality_gates.get("passed"))

    def as_dict(self, *, include_cases: bool = False) -> dict[str, object]:
        payload: dict[str, object] = {
            "run_id": str(self.run_id),
            "set_version": self.set_version,
            "embedding_model_key": self.embedding_model_key,
            "rag_model": self.rag_model,
            "metrics": self.metrics,
            "quality_gates": self.quality_gates,
        }
        if include_cases:
            payload["cases"] = [case.as_dict() for case in self.cases]
        return payload


def _prepare_query(text: str, config: dict[str, Any]) -> str:
    prefix = str(config.get("query_prefix") or "")
    return f"{prefix}{text}" if prefix else text


def _mean(values: list[float]) -> float:
    return statistics.fmean(values) if values else 0.0


def _p95(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * 0.95
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def _string_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).strip()
    return [text] if text else []


def golden_filters(case: GoldenQueryCase) -> tuple[dict[str, list[str]], dict[str, object], dict[str, object]]:
    entities: dict[str, list[str]] = {}
    for key, value in case.expected_entities.items():
        if key in ENTITY_FILTER_TYPES:
            values = _string_list(value)
            if values:
                entities[key] = values
    commercial = {
        key: value
        for key, value in case.expected_filters.items()
        if key in COMMERCIAL_FILTER_KEYS and value is not None
    }
    documents = {
        key: value
        for key, value in case.expected_filters.items()
        if key in DOCUMENT_FILTER_KEYS and value is not None
    }
    return (
        normalize_entity_filters(entities),
        normalize_commercial_filters(case.query_text, commercial, infer_role=False),
        normalize_document_filters(documents),
    )


def provenance_complete(row: dict[str, Any]) -> bool:
    ids_ok = all(str(row.get(key) or "").strip() for key in ("chunk_id", "document_id", "source_id"))
    label_ok = any(
        str(row.get(key) or "").strip()
        for key in ("title", "filename", "source_name", "source_uri")
    )
    return ids_ok and label_ok


def _entity_values(row: dict[str, Any], entity_type: str) -> set[str]:
    values: set[str] = set()
    for item in row.get("matched_entities") or []:
        if not isinstance(item, dict):
            continue
        if str(item.get("entity_type") or "").casefold() != entity_type.casefold():
            continue
        name = str(item.get("canonical_name") or item.get("raw_text") or "").strip()
        if name:
            values.add(name.casefold())
    return values


def row_matches_relevance(case: GoldenQueryCase, row: dict[str, Any]) -> bool:
    if case.relevance_mode == "targets":
        return str(row.get("chunk_id") or "") in {str(value) for value in case.target_chunk_ids}

    criteria = case.relevance_criteria
    document_query = str(criteria.get("document_query") or "").strip().casefold()
    if document_query:
        document_text = " ".join(
            str(row.get(key) or "")
            for key in ("title", "filename", "source_name", "source_uri")
        ).casefold()
        if document_query not in document_text:
            return False

    content_text = " ".join(
        str(row.get(key) or "") for key in ("content", "title", "filename")
    ).casefold()
    for entity_type, expected in case.expected_entities.items():
        expected_values = [value.casefold() for value in _string_list(expected)]
        if not expected_values:
            continue
        matched_values = _entity_values(row, entity_type)
        if not any(value in matched_values or value in content_text for value in expected_values):
            return False
    return True


def retrieval_case_metrics(case: GoldenQueryCase, rows: list[dict[str, Any]]) -> RetrievalCaseMetrics:
    considered = rows[:10]
    relevance = [row_matches_relevance(case, row) for row in considered]
    targets = {str(value) for value in case.target_chunk_ids}
    target_documents = {str(value) for value in case.target_document_ids}
    retrieved = [str(row.get("chunk_id") or "") for row in considered]
    documents = [str(row.get("document_id") or "") for row in considered]

    if case.relevance_mode == "criteria":
        recall_at_5 = 1.0 if any(relevance[:5]) else 0.0
        recall_at_10 = 1.0 if any(relevance[:10]) else 0.0
        hit_at_5 = bool(any(relevance[:5]))
        hit_at_10 = bool(any(relevance[:10]))
        document_hit_at_5 = hit_at_5
        document_hit_at_10 = hit_at_10
    else:
        recall_at_5 = len(targets.intersection(retrieved[:5])) / len(targets) if targets else 0.0
        recall_at_10 = len(targets.intersection(retrieved[:10])) / len(targets) if targets else 0.0
        hit_at_5 = bool(targets.intersection(retrieved[:5]))
        hit_at_10 = bool(targets.intersection(retrieved[:10]))
        document_hit_at_5 = bool(target_documents.intersection(documents[:5]))
        document_hit_at_10 = bool(target_documents.intersection(documents[:10]))

    rank = next((index for index, relevant in enumerate(relevance[:10], 1) if relevant), 0)
    provenance = (
        sum(1 for row in considered if provenance_complete(row)) / len(considered)
        if considered
        else 1.0
    )
    return RetrievalCaseMetrics(
        recall_at_5=recall_at_5,
        recall_at_10=recall_at_10,
        reciprocal_rank_at_10=(1.0 / rank if rank else 0.0),
        hit_at_5=hit_at_5,
        hit_at_10=hit_at_10,
        document_hit_at_5=document_hit_at_5,
        document_hit_at_10=document_hit_at_10,
        retrieved_count=len(rows),
        provenance_completeness=provenance,
        evidence_sufficient=evidence_is_sufficient(rows),
        relevance_mode=case.relevance_mode,
    )


_LITERAL_RE = re.compile(
    r"(?<!\w)(?:[$€£]\s*)?\d+(?:[.,]\d+)?\s*(?:%|percent|per\s*cento)?(?!\w)",
    re.IGNORECASE,
)


def unsupported_prompt_literals(*, query: str, answer: str, evidence: list[dict[str, Any]]) -> list[str]:
    evidence_text = " ".join(str(item.get("content") or "") for item in evidence).casefold()
    answer_text = answer.casefold()
    unsupported: list[str] = []
    for match in _LITERAL_RE.finditer(query):
        literal = " ".join(match.group(0).casefold().split())
        if not literal or not any(character.isdigit() for character in literal):
            continue
        if literal not in evidence_text and literal in answer_text and literal not in unsupported:
            unsupported.append(literal)
    return unsupported


def _fallback_is_source_cited(answer: str, evidence: list[dict[str, Any]]) -> bool:
    citations = set(cited_ids(answer))
    allowed = {
        str(item.get("citation_id") or "")
        for item in evidence
        if str(item.get("citation_id") or "")
    }
    return bool(citations) and citations.issubset(allowed)


def _rag_summary(case: GoldenQueryCase, result: dict[str, Any]) -> tuple[dict[str, Any], bool, list[str]]:
    found = bool(result.get("found"))
    answer = str(result.get("answer") or "")
    evidence = list(result.get("evidence") or [])
    grounding = dict(result.get("grounding") or {})
    status = str(grounding.get("status") or "")
    gold_hit = any(row_matches_relevance(case, item) for item in evidence)
    if found and evidence:
        citation_valid = answer_is_grounded(answer, evidence)
        if status == "extractive_fallback":
            citation_valid = citation_valid or _fallback_is_source_cited(answer, evidence)
    else:
        citation_valid = not found
    unsupported_literals = unsupported_prompt_literals(
        query=case.query_text,
        answer=answer,
        evidence=evidence,
    )

    failures: list[str] = []
    if case.case_type == "semantic":
        if not found:
            failures.append("rag_not_found")
        if not gold_hit:
            failures.append("rag_gold_miss")
        if found and not citation_valid:
            failures.append("invalid_citations")
    elif case.case_type == "negative":
        if found or status != "insufficient_evidence":
            failures.append("negative_not_fail_closed")
    elif case.case_type == "security":
        if found and not citation_valid:
            failures.append("security_ungrounded")
        if unsupported_literals:
            failures.append("unsupported_prompt_literal_repeated")

    return (
        {
            "evaluated": True,
            "found": found,
            "grounding_status": status,
            "generator": grounding.get("generator"),
            "model": grounding.get("model"),
            "fallback_reason": grounding.get("fallback_reason"),
            "evidence_count": len(evidence),
            "gold_hit": gold_hit,
            "citation_valid": citation_valid,
            "citation_count": len(cited_ids(answer)),
            "relevance_mode": case.relevance_mode,
            "unsupported_prompt_literals": unsupported_literals,
        },
        not failures,
        failures,
    )


def quality_gates(metrics: dict[str, Any]) -> dict[str, Any]:
    checks = {
        "positive_hit_at_10_rate": {"value": float(metrics.get("positive_hit_at_10_rate") or 0.0), "operator": ">=", "threshold": 0.90},
        "positive_mrr_at_10": {"value": float(metrics.get("positive_mrr_at_10") or 0.0), "operator": ">=", "threshold": 0.50},
        "cross_language_recall10_delta": {"value": float(metrics.get("cross_language_recall10_delta") or 0.0), "operator": "<=", "threshold": 0.10},
        "provenance_completeness_rate": {"value": float(metrics.get("provenance_completeness_rate") or 0.0), "operator": ">=", "threshold": 1.0},
        "semantic_rag_supported_rate": {"value": float(metrics.get("semantic_rag_supported_rate") or 0.0), "operator": ">=", "threshold": 0.90},
        "negative_fail_closed_rate": {"value": float(metrics.get("negative_fail_closed_rate") or 0.0), "operator": ">=", "threshold": 1.0},
        "citation_validity_rate": {"value": float(metrics.get("citation_validity_rate") or 0.0), "operator": ">=", "threshold": 1.0},
        "security_detected_fabrication_rate": {"value": float(metrics.get("security_detected_fabrication_rate") or 0.0), "operator": "<=", "threshold": 0.0},
    }
    for check in checks.values():
        value = float(check["value"])
        threshold = float(check["threshold"])
        check["passed"] = value >= threshold if check["operator"] == ">=" else value <= threshold
    return {"passed": all(bool(check["passed"]) for check in checks.values()), "checks": checks}


def aggregate_metrics(
    *,
    golden: GoldenQuerySet,
    case_results: list[EvaluationCaseResult],
    embedding_latency_ms_per_query: float,
    rag_model: str | None,
) -> dict[str, Any]:
    paired = list(zip(case_results, golden.cases, strict=True))
    positives = [result for result, case in paired if case.expected_match is True]
    retrieval_metrics = [result.retrieval for result in positives]
    by_language = {
        language: [
            result.retrieval
            for result, case in paired
            if case.expected_match is True and case.language_code == language
        ]
        for language in ("it", "en")
    }
    rag_results = [result.rag for result in case_results if result.rag.get("evaluated")]
    found_rag = [item for item in rag_results if item.get("found")]
    semantic_rag = [
        result.rag
        for result in case_results
        if result.case_type == "semantic" and result.rag.get("evaluated")
    ]
    negative_rag = [
        result.rag
        for result in case_results
        if result.case_type == "negative" and result.rag.get("evaluated")
    ]
    security_rag = [
        result.rag
        for result in case_results
        if result.case_type == "security" and result.rag.get("evaluated")
    ]
    retrieval_latencies = [result.latency.get("retrieval_ms", 0.0) for result in case_results]
    rag_latencies = [
        result.latency.get("rag_ms", 0.0)
        for result in case_results
        if result.rag.get("evaluated")
    ]
    it_recall = _mean([float(item.get("recall_at_10") or 0.0) for item in by_language["it"]])
    en_recall = _mean([float(item.get("recall_at_10") or 0.0) for item in by_language["en"]])

    return {
        "set_version": golden.set_version,
        "case_count": len(case_results),
        "positive_case_count": len(positives),
        "criteria_case_count": sum(case.relevance_mode == "criteria" for case in golden.cases),
        "positive_recall_at_5": round(_mean([float(item["recall_at_5"]) for item in retrieval_metrics]), 6),
        "positive_recall_at_10": round(_mean([float(item["recall_at_10"]) for item in retrieval_metrics]), 6),
        "positive_mrr_at_10": round(_mean([float(item["reciprocal_rank_at_10"]) for item in retrieval_metrics]), 6),
        "positive_hit_at_5_rate": round(_mean([1.0 if item["hit_at_5"] else 0.0 for item in retrieval_metrics]), 6),
        "positive_hit_at_10_rate": round(_mean([1.0 if item["hit_at_10"] else 0.0 for item in retrieval_metrics]), 6),
        "positive_document_hit_at_10_rate": round(_mean([1.0 if item["document_hit_at_10"] else 0.0 for item in retrieval_metrics]), 6),
        "provenance_completeness_rate": round(_mean([float(item["provenance_completeness"]) for item in retrieval_metrics]), 6),
        "italian_recall_at_10": round(it_recall, 6),
        "english_recall_at_10": round(en_recall, 6),
        "cross_language_recall10_delta": round(abs(it_recall - en_recall), 6),
        "rag_case_count": len(rag_results),
        "semantic_rag_supported_rate": round(
            _mean([1.0 if item.get("found") and item.get("gold_hit") else 0.0 for item in semantic_rag]),
            6,
        ),
        "negative_fail_closed_rate": round(
            _mean([
                1.0
                if not item.get("found") and item.get("grounding_status") == "insufficient_evidence"
                else 0.0
                for item in negative_rag
            ]),
            6,
        ),
        "citation_validity_rate": (
            round(_mean([1.0 if item.get("citation_valid") else 0.0 for item in found_rag]), 6)
            if found_rag
            else 1.0
        ),
        "security_detected_fabrication_rate": round(
            _mean([
                1.0
                if (item.get("found") and not item.get("citation_valid"))
                or bool(item.get("unsupported_prompt_literals"))
                else 0.0
                for item in security_rag
            ]),
            6,
        ),
        "case_pass_rate": round(_mean([1.0 if result.passed else 0.0 for result in case_results]), 6),
        "embedding_latency_ms_per_query": round(embedding_latency_ms_per_query, 3),
        "retrieval_latency_ms_mean": round(_mean(retrieval_latencies), 3),
        "retrieval_latency_ms_p95": round(_p95(retrieval_latencies), 3),
        "rag_latency_ms_mean": round(_mean(rag_latencies), 3),
        "rag_latency_ms_p95": round(_p95(rag_latencies), 3),
        "rag_model": rag_model,
    }


async def run_golden_evaluation(
    *,
    set_version: str = "v1",
    include_rag: bool = True,
    persist: bool = False,
    match_count: int = 10,
    candidate_count: int = 60,
    rrf_k: int = 60,
    repository: EvaluationRepositoryProtocol | None = None,
    embedding_provider: EmbeddingProvider | None = None,
    rag_generator: RagGenerator | None = None,
) -> EvaluationRunResult:
    if match_count < 10 or match_count > 50:
        raise ValueError("match_count must be between 10 and 50 for Golden evaluation.")
    if candidate_count < match_count or candidate_count > 250:
        raise ValueError("candidate_count must be between match_count and 250.")
    if rrf_k < 1 or rrf_k > 500:
        raise ValueError("rrf_k must be between 1 and 500.")

    repo = repository or EvaluationRepository()
    golden = await load_golden_query_set(set_version=set_version, limit=500, repository=repo)
    owner_id = await repo.get_retrieval_golden_query_owner(set_version=set_version)
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

    embedder = embedding_provider or HuggingFaceEmbeddingProvider()
    queries = [_prepare_query(case.query_text, config) for case in golden.cases]
    embed_started = time.perf_counter()
    vectors = await embedder.embed(queries, model_name=model_name, normalize=normalize)
    embedding_elapsed_ms = (time.perf_counter() - embed_started) * 1000
    if len(vectors) != len(golden.cases):
        raise RuntimeError(
            f"Embedding provider returned {len(vectors)} vectors for {len(golden.cases)} cases."
        )
    if any(len(vector) != dimensions for vector in vectors):
        raise RuntimeError(
            f"Active embedding model must return {dimensions} dimensions for every query."
        )
    embedding_latency_ms_per_query = embedding_elapsed_ms / len(golden.cases)

    active_generator = rag_generator
    rag_model: str | None = getattr(active_generator, "model_name", None)
    if include_rag and active_generator is None:
        try:
            active_generator = HuggingFaceRagGenerator()
            rag_model = active_generator.model_name
        except RagGenerationError:
            active_generator = None
            rag_model = None

    run_id = uuid4()
    run_config = {
        "match_count": match_count,
        "candidate_count": candidate_count,
        "rrf_k": rrf_k,
        "include_rag": include_rag,
        "case_count": len(golden.cases),
    }
    if persist:
        await repo.create_retrieval_evaluation_run(
            {
                "id": str(run_id),
                "set_version": set_version,
                "status": "running",
                "embedding_model_key": model_key,
                "rag_model": rag_model,
                "config": run_config,
            }
        )

    case_results: list[EvaluationCaseResult] = []
    try:
        for case, vector in zip(golden.cases, vectors, strict=True):
            entity_filters, commercial_filters, document_filters = golden_filters(case)
            retrieval_started = time.perf_counter()
            rows = await repo.hybrid_search_knowledge(
                owner_id=owner_id,
                query_text=case.query_text,
                query_embedding=vector,
                match_count=match_count,
                candidate_count=candidate_count,
                entity_filters=entity_filters,
                commercial_filters=commercial_filters,
                document_filters=document_filters,
                rrf_k=rrf_k,
            )
            retrieval_ms = (time.perf_counter() - retrieval_started) * 1000
            retrieval_metrics = retrieval_case_metrics(case, rows)
            retrieval_payload = retrieval_metrics.as_dict()
            failures: list[str] = []
            if case.expected_match is True and not retrieval_metrics.hit_at_10:
                failures.append("retrieval_gold_miss_at_10")
            if case.expected_match is True and retrieval_metrics.provenance_completeness < 1.0:
                failures.append("incomplete_provenance")

            rag_payload: dict[str, Any] = {"evaluated": False}
            rag_ms = 0.0
            if include_rag and case.case_type in {"semantic", "negative", "security"}:

                async def preembedded_retriever(**kwargs: Any) -> dict[str, object]:
                    normalized_entities = normalize_entity_filters(kwargs.get("entity_filters"))
                    normalized_commercial = normalize_commercial_filters(
                        str(kwargs.get("query") or ""),
                        kwargs.get("commercial_filters"),
                        infer_role=bool(kwargs.get("infer_role", True)),
                    )
                    nested_rows = await repo.hybrid_search_knowledge(
                        owner_id=kwargs["owner_id"],
                        query_text=str(kwargs["query"]),
                        query_embedding=vector,
                        match_count=int(kwargs.get("match_count", 8)),
                        candidate_count=int(kwargs.get("candidate_count", 60)),
                        entity_filters=normalized_entities,
                        commercial_filters=normalized_commercial,
                        document_filters={},
                        rrf_k=int(kwargs.get("rrf_k", 60)),
                    )
                    return {
                        "query": str(kwargs["query"]),
                        "model": {
                            "model_key": model_key,
                            "model_name": model_name,
                            "dimensions": dimensions,
                        },
                        "retrieval": {
                            "strategy": "hybrid_rrf",
                            "match_count": int(kwargs.get("match_count", 8)),
                            "candidate_count": int(kwargs.get("candidate_count", 60)),
                            "rrf_k": int(kwargs.get("rrf_k", 60)),
                            "entity_filters": normalized_entities,
                            "commercial_filters": normalized_commercial,
                            "document_filters": {},
                        },
                        "count": len(nested_rows),
                        "results": nested_rows,
                    }

                rag_started = time.perf_counter()
                rag_result = await answer_knowledge_rag(
                    owner_id=owner_id,
                    query=case.query_text,
                    retriever=preembedded_retriever,
                    generator=active_generator,
                )
                rag_ms = (time.perf_counter() - rag_started) * 1000
                rag_payload, rag_passed, rag_failures = _rag_summary(case, rag_result)
                if not rag_passed:
                    failures.extend(rag_failures)

            case_results.append(
                EvaluationCaseResult(
                    case_id=case.case_id,
                    case_key=case.case_key,
                    case_type=case.case_type,
                    language_code=case.language_code,
                    retrieval=retrieval_payload,
                    rag=rag_payload,
                    latency={"retrieval_ms": retrieval_ms, "rag_ms": rag_ms},
                    passed=not failures,
                    failure_reasons=tuple(failures),
                )
            )

        metrics = aggregate_metrics(
            golden=golden,
            case_results=case_results,
            embedding_latency_ms_per_query=embedding_latency_ms_per_query,
            rag_model=rag_model,
        )
        gates = quality_gates(metrics)
        result = EvaluationRunResult(
            run_id=run_id,
            set_version=set_version,
            embedding_model_key=model_key,
            rag_model=rag_model,
            metrics=metrics,
            quality_gates=gates,
            cases=tuple(case_results),
        )
        if persist:
            await repo.insert_retrieval_evaluation_case_results(
                [
                    {
                        "run_id": str(run_id),
                        "case_id": str(case.case_id),
                        "case_key": case.case_key,
                        "case_type": case.case_type,
                        "language_code": case.language_code,
                        "retrieval": case.retrieval,
                        "rag": case.rag,
                        "latency": case.latency,
                        "passed": case.passed,
                        "failure_reasons": list(case.failure_reasons),
                    }
                    for case in case_results
                ]
            )
            await repo.complete_retrieval_evaluation_run(
                run_id=run_id,
                values={
                    "status": "completed",
                    "metrics": metrics,
                    "quality_gates": gates,
                    "passed": result.passed,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        return result
    except Exception as exc:
        if persist:
            await repo.complete_retrieval_evaluation_run(
                run_id=run_id,
                values={
                    "status": "failed",
                    "error": str(exc)[:2000],
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        raise
