import asyncio
import os
from uuid import UUID

os.environ["WORKER_STORAGE_MODE"] = "memory"

import app.assistant_market as market_module  # noqa: E402


OWNER_ID = UUID("f45fab6e-3da8-41aa-8711-fc1b337a7dde")


def overlay_result() -> dict:
    return {
        "found": True,
        "count": 2,
        "observations": [
            {
                "id": 2,
                "thread_id": "thread-2",
                "grade": "P265GH",
                "outer_diameter_mm": 406.4,
                "thickness_mm": 6.3,
                "price_value": 110,
                "price_unit": "M",
                "currency": "EUR",
                "commercial_at": "2026-06-15T10:00:00+00:00",
                "thread_subject": "Offerta recente",
            },
            {
                "id": 1,
                "thread_id": "thread-1",
                "grade": "P265GH",
                "outer_diameter_mm": 406.4,
                "thickness_mm": 6.3,
                "price_value": 100,
                "price_unit": "M",
                "currency": "EUR",
                "commercial_at": "2025-06-15T10:00:00+00:00",
                "thread_subject": "Offerta storica",
            },
        ],
        "overlay": {
            "reference_price_unit": "M",
            "reference_currency": "EUR",
            "comparable_price_count": 2,
            "market_source": {
                "key": "eurostat_it_c242_ppi_domestic",
                "name": "Italy steel tubes PPI",
                "provider": "Eurostat",
                "source_url": "https://ec.europa.eu/eurostat/",
                "unit": "I21",
                "display_unit": "Indice 2021=100",
                "latest_period": "2026-07-01",
                "latest_value": 101.2,
            },
            "summary": {
                "price_change_pct": 10.0,
                "market_change_same_window_pct": 10.0,
                "divergence_pct_points": 0.0,
                "market_change_since_latest_offer_pct": 2.02,
                "latest_offer_market_period": "2026-06-01",
            },
            "points": [
                {
                    "observation_id": 1,
                    "thread_id": "thread-1",
                    "commercial_at": "2025-06-15T10:00:00+00:00",
                    "price_value": 100,
                    "price_unit": "M",
                    "currency": "EUR",
                    "market_period": "2025-06-01",
                    "market_value": 90,
                    "market_change_to_latest_pct": 12.44,
                },
                {
                    "observation_id": 2,
                    "thread_id": "thread-2",
                    "commercial_at": "2026-06-15T10:00:00+00:00",
                    "price_value": 110,
                    "price_unit": "M",
                    "currency": "EUR",
                    "market_period": "2026-06-01",
                    "market_value": 99,
                    "market_change_to_latest_pct": 2.02,
                },
            ],
        },
    }


def test_market_comparison_uses_grounded_overlay(monkeypatch) -> None:
    async def fake_overlay(**kwargs):
        assert kwargs["owner_id"] == OWNER_ID
        assert kwargs["grade"] == "P265GH"
        assert kwargs["outer_diameter_mm"] == 406.4
        assert kwargs["thickness_mm"] == 6.3
        return overlay_result()

    monkeypatch.setattr(market_module, "get_price_market_overlay", fake_overlay)
    result = asyncio.run(
        market_module.answer_assistant(
            owner_id=OWNER_ID,
            query="Come si è mosso il mercato rispetto al nostro ultimo prezzo P265GH 406,4x6,3?",
        )
    )

    assert result["intent"] == "market_comparison"
    assert result["found"] is True
    assert result["context"]["intent"] == "market_comparison"
    assert result["market"]["source"]["provider"] == "Eurostat"
    assert result["market"]["summary"]["divergence_pct_points"] == 0.0
    assert "non viene trasformato" in result["answer"]


def test_market_followup_inherits_latest_price_context(monkeypatch) -> None:
    async def fake_overlay(**kwargs):
        assert kwargs["grade"] == "P265GH"
        assert kwargs["outer_diameter_mm"] == 406.4
        assert kwargs["thickness_mm"] == 6.3
        return overlay_result()

    monkeypatch.setattr(market_module, "get_price_market_overlay", fake_overlay)
    context = {
        "intent": "latest_price",
        "filters": {"grade": "P265GH", "outer_diameter_mm": 406.4, "thickness_mm": 6.3},
    }
    result = asyncio.run(
        market_module.answer_assistant(owner_id=OWNER_ID, query="e il mercato?", context=context)
    )

    assert result["intent"] == "market_comparison"
    assert result["filters"]["grade"] == "P265GH"
    assert result["filters"]["outer_diameter_mm"] == 406.4


def test_market_followup_can_override_product_filter(monkeypatch) -> None:
    async def fake_overlay(**kwargs):
        assert kwargs["thickness_mm"] == 7.1
        return overlay_result()

    monkeypatch.setattr(market_module, "get_price_market_overlay", fake_overlay)
    context = {
        "intent": "market_comparison",
        "filters": {"grade": "P265GH", "outer_diameter_mm": 406.4, "thickness_mm": 6.3},
    }
    result = asyncio.run(
        market_module.answer_assistant(owner_id=OWNER_ID, query="e per spessore 7,1?", context=context)
    )

    assert result["intent"] == "market_comparison"
    assert result["filters"]["thickness_mm"] == 7.1


def test_non_market_question_delegates_to_existing_assistant(monkeypatch) -> None:
    async def fake_commercial(**kwargs):
        return {"intent": "latest_price", "found": True, "answer": "delegated", "observations": []}

    monkeypatch.setattr(market_module, "answer_commercial_assistant", fake_commercial)
    result = asyncio.run(
        market_module.answer_assistant(owner_id=OWNER_ID, query="ultimo prezzo P265GH 406,4x6,3")
    )
    assert result["answer"] == "delegated"
