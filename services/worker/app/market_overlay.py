from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from .market import EUROSTAT_SOURCE_KEY, MarketDataError, MarketRepository
from .queries import price_history


def _numeric(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _month(value: object) -> date | None:
    if not value:
        return None
    raw = str(value)
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return date(parsed.year, parsed.month, 1)
    except ValueError:
        try:
            parsed_date = date.fromisoformat(raw[:10])
            return date(parsed_date.year, parsed_date.month, 1)
        except ValueError:
            return None


def _pct(current: float | None, baseline: float | None) -> float | None:
    if current is None or baseline in (None, 0):
        return None
    return round((current / baseline - 1) * 100, 2)


def _same_market_unit(price_row: dict[str, Any], reference: dict[str, Any]) -> bool:
    return (
        price_row.get("price_unit") == reference.get("price_unit")
        and (price_row.get("currency") or "EUR") == (reference.get("currency") or "EUR")
    )


def _market_row_for_month(
    market_rows: list[dict[str, Any]],
    commercial_month: date,
) -> dict[str, Any] | None:
    eligible: list[dict[str, Any]] = []
    for row in market_rows:
        row_month = _month(row.get("period"))
        if row_month is not None and row_month <= commercial_month:
            eligible.append(row)
    return eligible[-1] if eligible else None


def build_price_market_overlay(
    *,
    price_rows: list[dict[str, Any]],
    market_rows: list[dict[str, Any]],
    market_source: dict[str, Any],
) -> dict[str, Any]:
    """Align commercial offers with the latest available monthly market observation.

    Price and market units are deliberately kept separate. Only relative percentage
    changes are compared.
    """

    latest_market = market_rows[-1] if market_rows else None
    latest_market_month = _month(latest_market.get("period")) if latest_market else None
    reference_price = next(
        (row for row in price_rows if _numeric(row.get("price_value")) is not None),
        None,
    )
    comparable_rows = (
        [row for row in price_rows if _same_market_unit(row, reference_price)]
        if reference_price
        else []
    )
    comparable_rows = [
        row for row in comparable_rows
        if _numeric(row.get("price_value")) is not None and _month(row.get("commercial_at")) is not None
    ]
    comparable_rows.sort(key=lambda row: str(row.get("commercial_at") or ""))

    points: list[dict[str, Any]] = []
    for row in comparable_rows:
        commercial_month = _month(row.get("commercial_at"))
        if commercial_month is None:
            continue
        matched = _market_row_for_month(market_rows, commercial_month)
        matched_month = _month(matched.get("period")) if matched else None
        market_has_newer_data = bool(
            latest_market_month and matched_month and latest_market_month > matched_month
        )
        points.append(
            {
                "observation_id": row.get("id"),
                "thread_id": row.get("thread_id"),
                "commercial_at": row.get("commercial_at"),
                "price_value": _numeric(row.get("price_value")),
                "price_unit": row.get("price_unit"),
                "currency": row.get("currency") or "EUR",
                "market_period": matched.get("period") if matched else None,
                "market_value": _numeric(matched.get("value")) if matched else None,
                "market_change_to_latest_pct": (
                    _pct(
                        _numeric(latest_market.get("value")) if latest_market else None,
                        _numeric(matched.get("value")) if matched else None,
                    )
                    if market_has_newer_data
                    else None
                ),
                "market_has_newer_data": market_has_newer_data,
            }
        )

    if points:
        first = points[0]
        first_price = _numeric(first.get("price_value"))
        first_market = _numeric(first.get("market_value"))
        for point in points:
            point["price_change_from_first_pct"] = _pct(
                _numeric(point.get("price_value")), first_price
            )
            point["market_change_from_first_pct"] = _pct(
                _numeric(point.get("market_value")), first_market
            )

    price_change_pct = None
    market_same_window_pct = None
    if len(points) >= 2:
        first = points[0]
        last = points[-1]
        price_change_pct = _pct(
            _numeric(last.get("price_value")),
            _numeric(first.get("price_value")),
        )
        first_market = _numeric(first.get("market_value"))
        last_market = _numeric(last.get("market_value"))
        if first_market is not None and last_market is not None and last.get("market_period") != first.get("market_period"):
            market_same_window_pct = _pct(last_market, first_market)

    latest_point = points[-1] if points else None
    configuration = market_source.get("configuration") or {}
    return {
        "reference_price_unit": reference_price.get("price_unit") if reference_price else None,
        "reference_currency": (reference_price.get("currency") or "EUR") if reference_price else None,
        "comparable_price_count": len(points),
        "market_source": {
            "key": market_source.get("key"),
            "name": market_source.get("name"),
            "provider": market_source.get("provider"),
            "source_url": market_source.get("source_url"),
            "unit": market_source.get("unit"),
            "display_unit": configuration.get("display_unit") or market_source.get("unit"),
            "latest_period": latest_market.get("period") if latest_market else None,
            "latest_value": _numeric(latest_market.get("value")) if latest_market else None,
        },
        "summary": {
            "price_change_pct": price_change_pct,
            "market_change_same_window_pct": market_same_window_pct,
            "divergence_pct_points": (
                round(price_change_pct - market_same_window_pct, 2)
                if price_change_pct is not None and market_same_window_pct is not None
                else None
            ),
            "market_change_since_latest_offer_pct": (
                latest_point.get("market_change_to_latest_pct") if latest_point else None
            ),
            "latest_offer_market_period": latest_point.get("market_period") if latest_point else None,
        },
        "points": points,
    }


async def get_price_market_overlay(
    *,
    owner_id: UUID,
    grade: str | None = None,
    outer_diameter_mm: float | None = None,
    thickness_mm: float | None = None,
    width_mm: float | None = None,
    height_mm: float | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    prices = await price_history(
        owner_id=owner_id,
        grade=grade,
        outer_diameter_mm=outer_diameter_mm,
        thickness_mm=thickness_mm,
        width_mm=width_mm,
        height_mm=height_mm,
        limit=limit,
    )

    repo = MarketRepository()
    sources = await repo.sources()
    market_source = next(
        (source for source in sources if source.get("key") == EUROSTAT_SOURCE_KEY),
        None,
    )
    if market_source is None:
        raise MarketDataError("Eurostat C242 market source is not configured.")
    market_rows = await repo.observations(str(market_source["id"]), limit=120)

    return {
        "found": bool(prices),
        "count": len(prices),
        "observations": prices,
        "overlay": build_price_market_overlay(
            price_rows=prices,
            market_rows=market_rows,
            market_source=market_source,
        ),
    }
