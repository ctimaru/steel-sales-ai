from __future__ import annotations

import asyncio
from typing import Any
from uuid import UUID

import app.assistant_market as assistant_router
from app.rag import (
    RAG_INTENT,
    RagGenerationError,
    answer_knowledge_rag,
    is_knowledge_request,
)

OWNER_ID = UUID("f45fab6e-3da8-41aa-8711-fc1b337a7dde")


def retrieval_payload(*, lexical_score: float | None = 0.3) -> dict[str, object]:
    return {
        "query": "cosa dicono le email S355J2H EN 10219",
        "model": {
            "model_key": "multilingual-e5-large-instruct-v1",
            "model_name": "intfloat/multilingual-e5-large-instruct",
            "dimensions": 1024,
        },
        "retrieval": {
            "strategy": "hybrid_rrf",
            "match_count": 8,
            "candidate_count": 60,
            "rrf_k": 60,
            "entity_filters": {"grade": ["S355J2H"]},
            "commercial_filters": {},
        },
        "count": 2,
        "results": [
            {
                "chunk_id": "chunk-1",
                "source_id": "source-1",
                "document_id": "document-1",
                "content": "Il materiale S355J2H è richiesto secondo EN 10219 con consegna a Bologna.",
                "language_code": "it",
                "title": "Ordine materiale Bologna",
                "filename": "ordine-bologna.eml",
                "document_type": "commercial_archive_extract",
                "source_name": "Internal commercial archive",
                "source_class": "internal",
                "source_uri": None,
                "page_start": None,
                "page_end": None,
                "section_path": ["Commercial archive", "Inbox"],
                "source_locator": {"thread_id": "thread-1", "observation_id": 10},
                "vector_similarity": 0.72,
                "lexical_score": lexical_score,
                "entity_match_count": 2,
                "rrf_score": 0.056,
                "matched_entities": [
                    {"entity_type": "grade", "canonical_name": "S355J2H"},
                    {"entity_type": "standard", "canonical_name": "EN 10219"},
                ],
            },
            {
                "chunk_id": "chunk-2",
                "source_id": "source-1",
                "document_id": "document-2",
                "content": "La seconda email conferma destinazione Bologna e tubolare rettangolare.",
                "language_code": "it",
                "title": "Conferma materiale",
                "filename": "conferma.eml",
                "document_type": "commercial_archive_extract",
                "source_name": "Internal commercial archive",
                "source_class": "internal",
                "source_uri": None,
                "page_start": None,
                "page_end": None,
                "section_path": ["Commercial archive", "Inbox"],
                "source_locator": {"thread_id": "thread-2", "observation_id": 11},
                "vector_similarity": 0.68,
                "lexical_score": 0.2,
                "entity_match_count": 1,
                "rrf_score": 0.051,
                "matched_entities": [],
            },
        ],
    }


class FakeGenerator:
    model_name = "test/grounded-model"

    def __init__(self, answer: str) -> None:
        self.answer = answer
        self.calls: list[dict[str, Any]] = []

    async def generate(self, *, question: str, evidence: list[dict[str, Any]]) -> str:
        self.calls.append({"question": question, "evidence": evidence})
        return self.answer


class FailingGenerator:
    model_name = "test/failing-model"

    async def generate(self, *, question: str, evidence: list[dict[str, Any]]) -> str:
        raise RagGenerationError("provider unavailable")


def test_document_questions_and_rag_followups_are_routed_to_knowledge() -> None:
    assert is_knowledge_request("Cosa dicono le email su S355J2H?") is True
    context = {"intent": RAG_INTENT, "knowledge_query": "email S355J2H", "filters": {}}
    assert is_knowledge_request("e per Bologna?", context=context) is True
    assert is_knowledge_request("ultimo prezzo P265GH 406,4x6,3") is False


def test_rag_answer_is_generated_only_from_owner_scoped_retrieval() -> None:
    captured: dict[str, Any] = {}

    async def fake_retriever(**kwargs: Any) -> dict[str, object]:
        captured.update(kwargs)
        return retrieval_payload()

    generator = FakeGenerator(
        "Le email indicano S355J2H secondo EN 10219 con destinazione Bologna. [S1] "
        "Una seconda fonte conferma la destinazione. [S2]"
    )
    result = asyncio.run(
        answer_knowledge_rag(
            owner_id=OWNER_ID,
            query="Cosa dicono le email S355J2H EN 10219 sulla destinazione?",
            retriever=fake_retriever,
            generator=generator,
        )
    )

    assert captured["owner_id"] == OWNER_ID
    assert captured["entity_filters"] == {"grade": ["S355J2H"]}
    assert result["intent"] == RAG_INTENT
    assert result["found"] is True
    assert result["grounding"]["status"] == "grounded"
    assert result["grounding"]["citations"] == ["S1", "S2"]
    assert len(result["evidence"]) == 2
    assert generator.calls[0]["evidence"][0]["citation_id"] == "S1"


def test_rag_followup_expands_previous_knowledge_query() -> None:
    captured: dict[str, Any] = {}

    async def fake_retriever(**kwargs: Any) -> dict[str, object]:
        captured.update(kwargs)
        return retrieval_payload()

    context = {
        "intent": RAG_INTENT,
        "filters": {"grade": "S355J2H"},
        "knowledge_query": "Cosa dicono le email su S355J2H?",
    }
    generator = FakeGenerator("La fonte cita Bologna. [S1]")
    result = asyncio.run(
        answer_knowledge_rag(
            owner_id=OWNER_ID,
            query="e per Bologna?",
            context=context,
            retriever=fake_retriever,
            generator=generator,
        )
    )

    assert captured["query"] == "Cosa dicono le email su S355J2H? e per Bologna?"
    assert result["context"]["knowledge_query"] == captured["query"]
    assert generator.calls[0]["question"] == captured["query"]


def test_structured_product_context_is_inherited_when_switching_to_documents() -> None:
    captured: dict[str, Any] = {}

    async def fake_retriever(**kwargs: Any) -> dict[str, object]:
        captured.update(kwargs)
        return retrieval_payload()

    context = {
        "intent": "latest_price",
        "filters": {
            "grade": "P265GH",
            "outer_diameter_mm": 406.4,
            "thickness_mm": 6.3,
        },
    }
    generator = FakeGenerator("La fonte contiene la specifica richiesta. [S1]")
    result = asyncio.run(
        answer_knowledge_rag(
            owner_id=OWNER_ID,
            query="e cosa dicono le email?",
            context=context,
            retriever=fake_retriever,
            generator=generator,
        )
    )

    assert captured["entity_filters"] == {"grade": ["P265GH"]}
    assert captured["commercial_filters"] == {
        "outer_diameter_mm": 406.4,
        "thickness_mm": 6.3,
    }
    assert result["filters"]["grade"] == "P265GH"
    assert result["filters"]["outer_diameter_mm"] == 406.4
    assert result["filters"]["thickness_mm"] == 6.3


def test_weak_retrieval_fails_closed_without_calling_generator() -> None:
    async def fake_retriever(**kwargs: Any) -> dict[str, object]:
        payload = retrieval_payload(lexical_score=None)
        payload["results"] = [
            {
                **payload["results"][0],
                "vector_similarity": 0.2,
                "lexical_score": None,
                "entity_match_count": 0,
            }
        ]
        return payload

    generator = FakeGenerator("Questa risposta non deve essere usata. [S1]")
    result = asyncio.run(
        answer_knowledge_rag(
            owner_id=OWNER_ID,
            query="domanda completamente scollegata",
            retriever=fake_retriever,
            generator=generator,
        )
    )

    assert result["found"] is False
    assert result["grounding"]["status"] == "insufficient_evidence"
    assert generator.calls == []


def test_invalid_model_citations_fall_back_to_extractive_evidence() -> None:
    async def fake_retriever(**kwargs: Any) -> dict[str, object]:
        return retrieval_payload()

    generator = FakeGenerator("Il documento dice qualcosa senza una citazione valida.")
    result = asyncio.run(
        answer_knowledge_rag(
            owner_id=OWNER_ID,
            query="Cosa dicono i documenti?",
            retriever=fake_retriever,
            generator=generator,
        )
    )

    assert result["found"] is True
    assert result["grounding"]["status"] == "extractive_fallback"
    assert result["grounding"]["fallback_reason"] == "citation_validation_failed"
    assert "[S1]" in result["answer"]


def test_generator_failure_never_turns_into_ungrounded_answer() -> None:
    async def fake_retriever(**kwargs: Any) -> dict[str, object]:
        return retrieval_payload()

    result = asyncio.run(
        answer_knowledge_rag(
            owner_id=OWNER_ID,
            query="Cosa dicono le email?",
            retriever=fake_retriever,
            generator=FailingGenerator(),
        )
    )

    assert result["found"] is True
    assert result["grounding"]["status"] == "extractive_fallback"
    assert result["grounding"]["fallback_reason"] == "generation_unavailable"
    assert "[S1]" in result["answer"]


def test_router_keeps_structured_tools_and_falls_back_to_rag(monkeypatch) -> None:
    async def fake_commercial(**kwargs: Any) -> dict[str, Any]:
        return {
            "intent": "unsupported",
            "found": False,
            "answer": "unsupported",
            "filters": {},
            "context": None,
            "observations": [],
        }

    async def fake_rag(**kwargs: Any) -> dict[str, Any]:
        assert kwargs["owner_id"] == OWNER_ID
        return {
            "intent": RAG_INTENT,
            "found": True,
            "answer": "grounded [S1]",
            "filters": {},
            "context": {"intent": RAG_INTENT, "filters": {}, "knowledge_query": kwargs["query"]},
            "observations": [],
            "evidence": [{"citation_id": "S1"}],
            "grounding": {"mode": "knowledge_rag", "status": "grounded"},
        }

    monkeypatch.setattr(assistant_router, "answer_commercial_assistant", fake_commercial)
    monkeypatch.setattr(assistant_router, "answer_knowledge_rag", fake_rag)
    result = asyncio.run(
        assistant_router.answer_assistant(
            owner_id=OWNER_ID,
            query="Quali condizioni particolari sono citate nelle fonti?",
        )
    )
    assert result["intent"] == RAG_INTENT
    assert result["answer"] == "grounded [S1]"
