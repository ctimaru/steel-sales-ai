import os
from uuid import UUID

from fastapi.testclient import TestClient

os.environ["WORKER_STORAGE_MODE"] = "memory"

import app.main as main_module  # noqa: E402
from app.assistant import parse_assistant_query  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def test_routes_latest_price_and_round_dimensions_with_length() -> None:
    parsed = parse_assistant_query("Qual è l'ultimo prezzo del P265GH 406,4x6,3x12000?")
    assert parsed["intent"] == "latest_price"
    assert parsed["filters"]["grade"] == "P265GH"
    assert parsed["filters"]["outer_diameter_mm"] == 406.4
    assert parsed["filters"]["thickness_mm"] == 6.3
    assert parsed["filters"]["width_mm"] is None


def test_routes_price_history_and_rectangular_dimensions() -> None:
    parsed = parse_assistant_query("Mostrami lo storico prezzi S355J2H 220x220x8")
    assert parsed["intent"] == "price_history"
    assert parsed["filters"]["grade"] == "S355J2H"
    assert parsed["filters"]["width_mm"] == 220
    assert parsed["filters"]["height_mm"] == 220
    assert parsed["filters"]["thickness_mm"] == 8


def test_routes_unconverted_offers_with_time_window() -> None:
    parsed = parse_assistant_query("Quali offerte S355J2H sono senza ordine negli ultimi 12 mesi?")
    assert parsed["intent"] == "offers_without_order"
    assert parsed["filters"]["grade"] == "S355J2H"
    assert parsed["filters"]["days"] == 365


def test_unknown_question_is_not_guessed() -> None:
    parsed = parse_assistant_query("Qual è il cliente più redditizio?")
    assert parsed["intent"] == "unsupported"


def test_assistant_endpoint_preserves_authenticated_owner_scope(monkeypatch) -> None:
    owner_id = UUID("f45fab6e-3da8-41aa-8711-fc1b337a7dde")

    async def fake_answer_assistant(*, owner_id: UUID, query: str):
        assert owner_id == UUID("f45fab6e-3da8-41aa-8711-fc1b337a7dde")
        assert query == "ultimo prezzo P265GH 406,4x6,3"
        return {
            "intent": "latest_price",
            "found": True,
            "answer": "68,38 €/m",
            "filters": {"grade": "P265GH"},
            "observations": [],
        }

    monkeypatch.setattr(main_module, "answer_assistant", fake_answer_assistant)
    response = client.post(
        "/v1/ai/assistant",
        json={
            "owner_id": str(owner_id),
            "query": "ultimo prezzo P265GH 406,4x6,3",
        },
    )
    assert response.status_code == 200
    assert response.json()["intent"] == "latest_price"
    assert response.json()["answer"] == "68,38 €/m"
