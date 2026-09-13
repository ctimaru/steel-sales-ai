import os
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi.testclient import TestClient

os.environ["WORKER_STORAGE_MODE"] = "memory"

import app.main as main_module  # noqa: E402
from app.main import app  # noqa: E402
from app.market import (  # noqa: E402
    parse_ecb_csv,
    parse_eurostat_jsonstat,
    source_is_stale,
    summarize_source,
)

client = TestClient(app)


def test_parse_eurostat_filtered_jsonstat() -> None:
    payload = {
        "id": ["freq", "unit", "nace_r2", "geo", "time"],
        "size": [1, 1, 1, 1, 3],
        "updated": "2026-09-03T11:00:00+0200",
        "dimension": {
            "time": {
                "category": {
                    "index": {"2026-05": 0, "2026-06": 1, "2026-07": 2}
                }
            }
        },
        "value": {"0": 104.2, "1": 105.1, "2": 106.3},
        "status": {"2": "p"},
    }

    rows = parse_eurostat_jsonstat(payload)

    assert [row["period"] for row in rows] == [
        "2026-05-01",
        "2026-06-01",
        "2026-07-01",
    ]
    assert rows[-1]["value"] == "106.3"
    assert rows[-1]["unit"] == "I21"
    assert rows[-1]["metadata"]["status"] == "p"


def test_parse_ecb_monthly_csv() -> None:
    content = (
        "FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE,OBS_STATUS\n"
        "M,USD,EUR,SP00,A,2026-06,1.1500,A\n"
        "M,USD,EUR,SP00,A,2026-07,1.1700,A\n"
    )

    rows = parse_ecb_csv(content)

    assert rows == [
        {
            "period": "2026-06-01",
            "value": "1.1500",
            "unit": "USD_PER_EUR",
            "metadata": {"period_label": "2026-06", "obs_status": "A", "decimals": None},
        },
        {
            "period": "2026-07-01",
            "value": "1.1700",
            "unit": "USD_PER_EUR",
            "metadata": {"period_label": "2026-07", "obs_status": "A", "decimals": None},
        },
    ]


def test_source_staleness_uses_twelve_hour_cache() -> None:
    now = datetime(2026, 9, 13, 12, 0, tzinfo=UTC)
    assert source_is_stale({"last_success_at": None}, now=now)
    assert not source_is_stale(
        {"last_success_at": (now - timedelta(hours=3)).isoformat()},
        now=now,
    )
    assert source_is_stale(
        {"last_success_at": (now - timedelta(hours=13)).isoformat()},
        now=now,
    )


def test_summarize_source_keeps_market_units_separate() -> None:
    source = {
        "key": "eurostat_it_c242_ppi_domestic",
        "name": "Steel tubes PPI",
        "provider": "Eurostat",
        "source_url": "https://example.test",
        "series_type": "producer_price_index",
        "frequency": "monthly",
        "unit": "I21",
        "geography": "IT",
        "category": "NACE C242",
        "configuration": {"display_unit": "Indice 2021=100"},
        "last_attempt_at": None,
        "last_success_at": None,
        "last_error": None,
    }
    observations = [
        {"period": "2025-07-01", "value": "100", "unit": "I21", "metadata": {}},
        {"period": "2026-06-01", "value": "105", "unit": "I21", "metadata": {}},
        {"period": "2026-07-01", "value": "110", "unit": "I21", "metadata": {}},
    ]

    result = summarize_source(source, observations)

    assert result["display_unit"] == "Indice 2021=100"
    assert result["latest"]["value"] == 110.0
    assert result["change_mom_pct"] == 4.76
    assert result["change_yoy_pct"] == 10.0


def test_market_overview_endpoint_preserves_authenticated_context(monkeypatch) -> None:
    owner_id = UUID("f45fab6e-3da8-41aa-8711-fc1b337a7dde")

    async def fake_overview(*, refresh: bool, force: bool):
        assert refresh is True
        assert force is False
        return {"generated_at": "2026-09-13T12:00:00+00:00", "cache_hours": 12, "sources": []}

    monkeypatch.setattr(main_module, "get_market_overview", fake_overview)
    response = client.post(
        "/v1/market/overview",
        json={"owner_id": str(owner_id), "refresh": True, "force": False},
    )

    assert response.status_code == 200
    assert response.json()["cache_hours"] == 12
