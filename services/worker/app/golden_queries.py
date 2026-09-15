from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol
from uuid import UUID

from .repository import RepositoryError, WorkerRepository


class GoldenQueryRepositoryProtocol(Protocol):
    async def get_retrieval_golden_queries(
        self, *, set_version: str, limit: int
    ) -> list[dict[str, Any]]: ...

    async def get_retrieval_golden_query_stats(
        self, *, set_version: str
    ) -> dict[str, Any]: ...


class GoldenQueryRepository(WorkerRepository):
    async def get_retrieval_golden_queries(
        self, *, set_version: str, limit: int = 200
    ) -> list[dict[str, Any]]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/get_retrieval_golden_queries",
            json={"p_set_version": set_version, "p_limit": limit},
        )
        if not isinstance(result, list):
            raise RepositoryError("Golden query lookup returned an invalid payload.")
        return result

    async def get_retrieval_golden_query_stats(
        self, *, set_version: str
    ) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/get_retrieval_golden_query_stats",
            json={"p_set_version": set_version},
        )
        if not isinstance(result, dict):
            raise RepositoryError("Golden query stats returned an invalid payload.")
        return result


@dataclass(frozen=True)
class GoldenQueryCase:
    case_id: UUID
    case_key: str
    case_type: str
    language_code: str
    query_text: str
    expected_match: bool | None
    expected_behavior: str
    expected_entities: dict[str, Any]
    expected_filters: dict[str, Any]
    expected_grounding_status: str | None
    relevance_mode: str
    relevance_criteria: dict[str, Any]
    target_chunk_ids: tuple[UUID, ...]
    target_document_ids: tuple[UUID, ...]
    notes: str | None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "GoldenQueryCase":
        return cls(
            case_id=UUID(str(row["case_id"])),
            case_key=str(row["case_key"]),
            case_type=str(row["case_type"]),
            language_code=str(row["language_code"]),
            query_text=str(row["query_text"]),
            expected_match=row.get("expected_match"),
            expected_behavior=str(row["expected_behavior"]),
            expected_entities=dict(row.get("expected_entities") or {}),
            expected_filters=dict(row.get("expected_filters") or {}),
            expected_grounding_status=(
                str(row["expected_grounding_status"])
                if row.get("expected_grounding_status") is not None
                else None
            ),
            relevance_mode=str(row.get("relevance_mode") or "targets"),
            relevance_criteria=dict(row.get("relevance_criteria") or {}),
            target_chunk_ids=tuple(
                UUID(str(value)) for value in (row.get("target_chunk_ids") or [])
            ),
            target_document_ids=tuple(
                UUID(str(value)) for value in (row.get("target_document_ids") or [])
            ),
            notes=str(row["notes"]) if row.get("notes") is not None else None,
        )


@dataclass(frozen=True)
class GoldenQuerySet:
    set_version: str
    cases: tuple[GoldenQueryCase, ...]
    database_stats: dict[str, Any]

    def summary(self) -> dict[str, object]:
        return {
            "set_version": self.set_version,
            "case_count": len(self.cases),
            "positive_case_count": sum(case.expected_match is True for case in self.cases),
            "negative_case_count": sum(case.case_type == "negative" for case in self.cases),
            "security_case_count": sum(case.case_type == "security" for case in self.cases),
            "italian_case_count": sum(case.language_code == "it" for case in self.cases),
            "english_case_count": sum(case.language_code == "en" for case in self.cases),
            "structured_case_count": sum(case.case_type == "structured" for case in self.cases),
            "semantic_case_count": sum(case.case_type == "semantic" for case in self.cases),
            "criteria_case_count": sum(case.relevance_mode == "criteria" for case in self.cases),
            "target_link_count": sum(len(case.target_chunk_ids) for case in self.cases),
        }


def validate_golden_query_set(golden: GoldenQuerySet) -> None:
    if not golden.set_version.strip():
        raise ValueError("Golden query set version is required.")
    if not golden.cases:
        raise ValueError("Golden query set cannot be empty.")

    seen: set[str] = set()
    for case in golden.cases:
        if case.case_key in seen:
            raise ValueError(f"Duplicate golden query case key: {case.case_key}.")
        seen.add(case.case_key)

        if case.case_type not in {"structured", "semantic", "negative", "security"}:
            raise ValueError(f"Unsupported golden case type: {case.case_type}.")
        if case.language_code not in {"it", "en"}:
            raise ValueError(f"Unsupported golden case language: {case.language_code}.")
        if case.relevance_mode not in {"targets", "criteria"}:
            raise ValueError(f"Unsupported relevance mode for {case.case_key}: {case.relevance_mode}.")
        if case.relevance_mode == "criteria" and not case.relevance_criteria:
            raise ValueError(f"Criteria-based golden case {case.case_key} has no relevance criteria.")
        if not case.query_text.strip():
            raise ValueError(f"Golden case {case.case_key} has an empty query.")

        if case.expected_match is True and not case.target_chunk_ids and case.relevance_mode != "criteria":
            raise ValueError(f"Positive golden case {case.case_key} has no target chunks.")
        if case.expected_match is False and case.target_chunk_ids:
            raise ValueError(f"Negative golden case {case.case_key} unexpectedly has target chunks.")
        if case.expected_behavior == "retrieve_gold" and case.expected_match is not True:
            raise ValueError(f"Retrieval golden case {case.case_key} must expect a match.")
        if case.case_type == "negative" and case.expected_behavior != "insufficient_evidence":
            raise ValueError(f"Negative case {case.case_key} must fail closed.")
        if case.case_type == "security" and case.expected_behavior != "must_not_fabricate":
            raise ValueError(f"Security case {case.case_key} must prohibit fabrication.")

    local = golden.summary()
    for key in (
        "case_count",
        "positive_case_count",
        "negative_case_count",
        "security_case_count",
        "italian_case_count",
        "english_case_count",
        "structured_case_count",
        "semantic_case_count",
        "target_link_count",
    ):
        database_value = golden.database_stats.get(key)
        if database_value is not None and int(database_value) != int(local[key]):
            raise ValueError(
                f"Golden query stats mismatch for {key}: database={database_value}, local={local[key]}."
            )


async def load_golden_query_set(
    *,
    set_version: str = "v1",
    limit: int = 200,
    repository: GoldenQueryRepositoryProtocol | None = None,
) -> GoldenQuerySet:
    if not set_version.strip():
        raise ValueError("set_version is required.")
    if limit < 1 or limit > 500:
        raise ValueError("limit must be between 1 and 500.")

    repo = repository or GoldenQueryRepository()
    rows = await repo.get_retrieval_golden_queries(set_version=set_version, limit=limit)
    stats = await repo.get_retrieval_golden_query_stats(set_version=set_version)
    golden = GoldenQuerySet(
        set_version=set_version,
        cases=tuple(GoldenQueryCase.from_row(row) for row in rows),
        database_stats=stats,
    )
    validate_golden_query_set(golden)
    return golden
