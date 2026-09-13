from app.market_overlay import build_price_market_overlay


MARKET_SOURCE = {
    "key": "eurostat_it_c242_ppi_domestic",
    "name": "Italy steel tubes PPI",
    "provider": "Eurostat",
    "source_url": "https://example.test/eurostat",
    "unit": "I21",
    "configuration": {"display_unit": "Indice 2021=100"},
}


def test_overlay_keeps_price_and_index_units_separate() -> None:
    prices = [
        {
            "id": 2,
            "thread_id": "thread-2",
            "commercial_at": "2026-06-15T10:00:00+00:00",
            "price_value": 110,
            "price_unit": "M",
            "currency": "EUR",
        },
        {
            "id": 1,
            "thread_id": "thread-1",
            "commercial_at": "2025-06-15T10:00:00+00:00",
            "price_value": 100,
            "price_unit": "M",
            "currency": "EUR",
        },
    ]
    market = [
        {"period": "2025-06-01", "value": 90, "unit": "I21"},
        {"period": "2026-06-01", "value": 99, "unit": "I21"},
        {"period": "2026-07-01", "value": 101, "unit": "I21"},
    ]

    result = build_price_market_overlay(
        price_rows=prices,
        market_rows=market,
        market_source=MARKET_SOURCE,
    )

    assert result["reference_price_unit"] == "M"
    assert result["reference_currency"] == "EUR"
    assert result["market_source"]["unit"] == "I21"
    assert result["summary"]["price_change_pct"] == 10.0
    assert result["summary"]["market_change_same_window_pct"] == 10.0
    assert result["summary"]["divergence_pct_points"] == 0.0
    assert result["points"][-1]["market_change_to_latest_pct"] == 2.02


def test_overlay_does_not_invent_market_movement_when_latest_offer_is_newer_than_market_data() -> None:
    prices = [
        {
            "id": 3,
            "thread_id": "thread-3",
            "commercial_at": "2026-09-12T10:00:00+00:00",
            "price_value": 68.38,
            "price_unit": "M",
            "currency": "EUR",
        }
    ]
    market = [
        {"period": "2026-06-01", "value": 100.3, "unit": "I21"},
        {"period": "2026-07-01", "value": 101.2, "unit": "I21"},
    ]

    result = build_price_market_overlay(
        price_rows=prices,
        market_rows=market,
        market_source=MARKET_SOURCE,
    )

    point = result["points"][0]
    assert point["market_period"] == "2026-07-01"
    assert point["market_has_newer_data"] is False
    assert point["market_change_to_latest_pct"] is None
    assert result["summary"]["market_change_since_latest_offer_pct"] is None


def test_overlay_filters_out_non_comparable_price_units() -> None:
    prices = [
        {
            "id": 2,
            "thread_id": "thread-2",
            "commercial_at": "2026-06-15T10:00:00+00:00",
            "price_value": 1200,
            "price_unit": "T",
            "currency": "EUR",
        },
        {
            "id": 1,
            "thread_id": "thread-1",
            "commercial_at": "2025-06-15T10:00:00+00:00",
            "price_value": 55,
            "price_unit": "M",
            "currency": "EUR",
        },
    ]
    market = [{"period": "2026-06-01", "value": 99, "unit": "I21"}]

    result = build_price_market_overlay(
        price_rows=prices,
        market_rows=market,
        market_source=MARKET_SOURCE,
    )

    assert result["reference_price_unit"] == "T"
    assert result["comparable_price_count"] == 1
    assert result["summary"]["price_change_pct"] is None
