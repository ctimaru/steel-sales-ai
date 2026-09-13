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


def test_followup_inherits_product_and_overrides_thickness() -> None:
    first = parse_assistant_query("Qual è l'ultimo prezzo del P265GH 406,4x6,3?")
    second = parse_assistant_query("e per spessore 7,1?", context=first["context"])
    assert second["intent"] == "latest_price"
    assert second["filters"]["grade"] == "P265GH"
    assert second["filters"]["outer_diameter_mm"] == 406.4
    assert second["filters"]["thickness_mm"] == 7.1


def test_followup_can_switch_from_latest_to_history() -> None:
    first = parse_assistant_query("ultimo prezzo P265GH 406,4x6,3")
    second = parse_assistant_query("e lo storico?", context=first["context"])
    assert second["intent"] == "price_history"
    assert second["filters"]["grade"] == "P265GH"
    assert second["filters"]["outer_diameter_mm"] == 406.4
    assert second["filters"]["thickness_mm"] == 6.3


def test_followup_can_add_time_window() -> None:
    first = parse_assistant_query("Quali offerte S355J2H sono senza ordine?")
    second = parse_assistant_query("solo negli ultimi 12 mesi", context=first["context"])
    assert second["intent"] == "offers_without_order"
    assert second["filters"]["grade"] == "S355J2H"
    assert second["filters"]["days"] == 365


def test_routes_generic_requested_search_with_minimum_diameter() -> None:
    parsed = parse_assistant_query("Mostrami le richieste S355J2H con diametro superiore a 300 negli ultimi 12 mesi")
    assert parsed["intent"] == "commercial_search"
    assert parsed["filters"]["role"] == "requested"
    assert parsed["filters"]["grade"] == "S355J2H"
    assert parsed["filters"]["min_outer_diameter_mm"] == 300
    assert parsed["filters"]["days"] == 365


def test_routes_orders_for_round_product() -> None:
    parsed = parse_assistant_query("Trovami gli ordini 323,9x7,1")
    assert parsed["intent"] == "commercial_search"
    assert parsed["filters"]["role"] == "ordered"
    assert parsed["filters"]["outer_diameter_mm"] == 323.9
    assert parsed["filters"]["thickness_mm"] == 7.1


def test_unknown_question_is_not_guessed_even_with_context() -> None:
    first = parse_assistant_query("ultimo prezzo P265GH 406,4x6,3")
    parsed = parse_assistant_query("Qual è il cliente più redditizio?", context=first["context"])
    assert parsed["intent"] == "unsupported"


def test_assistant_endpoint_preserves_authenticated_owner_scope_and_context(monkeypatch) -> None:
    owner_id = UUID("f45fab6e-3da8-41aa-8711-fc1b337a7dde")
    context = {
        "intent": "latest_price",
        "filters": {"grade": "P265GH", "outer_diameter_mm": 406.4, "thickness_mm": 6.3},
    }

    async def fake_answer_assistant(*, owner_id: UUID, query: str, context: dict | None = None):
        assert owner_id == UUID("f45fab6e-3da8-41aa-8711-fc1b337a7dde")
        assert query == "e per spessore 7,1?"
        assert context is not None
        assert context["filters"]["grade"] == "P265GH"
        return {
            "intent": "latest_price",
            "found": True,
            "answer": "Nessun prezzo trovato",
            "filters": {"grade": "P265GH", "outer_diameter_mm": 406.4, "thickness_mm": 7.1},
            "context": context,
            "observations": [],
        }

    monkeypatch.setattr(main_module, "answer_assistant", fake_answer_assistant)
    response = client.post(
        "/v1/ai/assistant",
        json={
            "owner_id": str(owner_id),
            "query": "e per spessore 7,1?",
            "context": context,
        },
    )
    assert response.status_code == 200
    assert response.json()["intent"] == "latest_price"
