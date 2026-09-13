from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from .assistant import (
    _clean_number,
    _date_label,
    _price_label,
    _product_label,
    answer_assistant as answer_commercial_assistant,
    parse_assistant_query,
)
from .market_overlay import get_price_market_overlay

MARKET_INTENT = "market_comparison"
_MARKET_TERMS = (
    "mercato",
    "eurostat",
    "indice c242",
    "c242",
    "indice di mercato",
    "segnale di mercato",
)


def _is_market_request(query: str, context: dict[str, Any] | None) -> bool:
    lower = query.casefold()
    if any(term in lower for term in _MARKET_TERMS):
        return True
    if str((context or {}).get("intent") or "") != MARKET_INTENT:
        return False
    stripped = lower.strip()
    return stripped.startswith(("e ", "e per ", "solo ", "invece ", "stesso ", "stessa ")) or any(
        word in lower for word in ("spessore", "diametro", "storico", "ultim", "prezzo")
    )


def _commercial_context(context: dict[str, Any] | None) -> dict[str, Any] | None:
    if not context:
        return None
    if str(context.get("intent") or "") != MARKET_INTENT:
        return context
    return {
        "intent": "latest_price",
        "filters": dict(context.get("filters") or {}),
    }


def _product_filters(filters: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in filters.items()
        if key in {"grade", "outer_diameter_mm", "thickness_mm", "width_mm", "height_mm"}
        and value is not None
    }


def _pct(current: object, baseline: object) -> float | None:
    try:
        current_value = float(current) if current is not None else None
        baseline_value = float(baseline) if baseline is not None else None
    except (TypeError, ValueError):
        return None
    if current_value is None or baseline_value in (None, 0):
        return None
    return round((current_value / baseline_value - 1) * 100, 2)


def _filter_result_by_days(result: dict[str, Any], days: int | None) -> dict[str, Any]:
    if not days:
        return result
    cutoff = datetime.now(UTC) - timedelta(days=int(days))

    def in_window(raw: object) -> bool:
        if not raw:
            return False
        try:
            parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            return False
        return parsed >= cutoff

    observations = [
        row for row in list(result.get("observations") or [])
        if in_window(row.get("commercial_at"))
    ]
    overlay = dict(result.get("overlay") or {})
    points = [
        point for point in list(overlay.get("points") or [])
        if in_window(point.get("commercial_at"))
    ]
    summary = dict(overlay.get("summary") or {})

    price_change = None
    market_change = None
    if len(points) >= 2:
        first, last = points[0], points[-1]
        price_change = _pct(last.get("price_value"), first.get("price_value"))
        if first.get("market_period") != last.get("market_period"):
            market_change = _pct(last.get("market_value"), first.get("market_value"))

    summary.update(
        {
            "price_change_pct": price_change,
            "market_change_same_window_pct": market_change,
            "divergence_pct_points": (
                round(price_change - market_change, 2)
                if price_change is not None and market_change is not None
                else None
            ),
            "market_change_since_latest_offer_pct": (
                points[-1].get("market_change_to_latest_pct") if points else None
            ),
            "latest_offer_market_period": points[-1].get("market_period") if points else None,
        }
    )
    overlay["points"] = points
    overlay["summary"] = summary
    overlay["comparable_price_count"] = len(points)
    return {
        **result,
        "found": bool(observations),
        "count": len(observations),
        "observations": observations,
        "overlay": overlay,
    }


def _signed_pct(value: object) -> str:
    if value is None:
        return "n.d."
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    sign = "+" if number > 0 else ""
    return f"{sign}{number:.2f}%".replace(".", ",")


def _month_label(value: object) -> str:
    if not value:
        return "periodo non disponibile"
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return str(value)
    months = (
        "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
        "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
    )
    return f"{months[parsed.month - 1]} {parsed.year}"


def _market_answer(filters: dict[str, Any], result: dict[str, Any]) -> str:
    observations = list(result.get("observations") or [])
    overlay = dict(result.get("overlay") or {})
    source = dict(overlay.get("market_source") or {})
    summary = dict(overlay.get("summary") or {})
    points = list(overlay.get("points") or [])
    period_suffix = f" negli ultimi {filters['days']} giorni" if filters.get("days") else ""

    if not observations or not points:
        return (
            f"Non ho trovato offerte con prezzo comparabili per {_product_label(filters)}{period_suffix}; "
            "senza una base interna non posso confrontare il mercato in modo verificabile."
        )

    latest_offer = observations[0]
    latest_market_value = source.get("latest_value")
    latest_market_period = source.get("latest_period")
    lines = [
        f"Per {_product_label(filters)}{period_suffix}, l'ultima offerta interna è {_price_label(latest_offer)} "
        f"del {_date_label(latest_offer.get('commercial_at'))}.",
    ]

    if latest_market_value is not None:
        lines.append(
            f"L'ultimo indice Eurostat C242 disponibile è {_clean_number(latest_market_value)} "
            f"({source.get('display_unit') or source.get('unit') or 'indice'}, {_month_label(latest_market_period)})."
        )

    price_change = summary.get("price_change_pct")
    market_change = summary.get("market_change_same_window_pct")
    divergence = summary.get("divergence_pct_points")
    if price_change is not None and market_change is not None:
        lines.append(
            f"Nella finestra coperta da {len(points)} offerte comparabili, i nostri prezzi sono variati di "
            f"{_signed_pct(price_change)} mentre l'indice C242 è variato di {_signed_pct(market_change)}; "
            f"la divergenza è {_signed_pct(divergence).replace('%', ' p.p.')}"
        )
    elif len(points) == 1:
        lines.append(
            "C'è una sola offerta comparabile nella finestra selezionata, quindi non calcolo una tendenza dei nostri prezzi."
        )

    after_offer = summary.get("market_change_since_latest_offer_pct")
    if after_offer is not None:
        lines.append(
            f"Dopo il mese associato all'ultima offerta, l'indice disponibile si è mosso di {_signed_pct(after_offer)}."
        )
    else:
        latest_point = points[-1]
        if latest_market_period and latest_point.get("market_period"):
            lines.append(
                "Non attribuisco movimenti successivi all'ultima offerta quando la serie Eurostat non dispone ancora di un mese più recente."
            )

    lines.append(
        "Il confronto usa solo variazioni relative: l'indice Eurostat non viene trasformato né equiparato a €/m o €/t."
    )
    return " ".join(lines)


async def answer_assistant(
    *,
    owner_id: UUID,
    query: str,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not _is_market_request(query, context):
        return await answer_commercial_assistant(owner_id=owner_id, query=query, context=context)

    parsed = parse_assistant_query(query, context=_commercial_context(context))
    filters = dict(parsed.get("filters") or {})
    product_filters = _product_filters(filters)
    resolved_context = {"intent": MARKET_INTENT, "filters": filters.copy()}

    if not product_filters:
        return {
            "intent": MARKET_INTENT,
            "found": False,
            "answer": "Indicami almeno qualità o dimensioni del prodotto per confrontare mercato e prezzi interni.",
            "filters": filters,
            "context": resolved_context,
            "observations": [],
            "market": None,
        }

    result = await get_price_market_overlay(
        owner_id=owner_id,
        limit=200 if filters.get("days") else 50,
        **product_filters,
    )
    result = _filter_result_by_days(result, filters.get("days"))
    overlay = dict(result.get("overlay") or {})
    return {
        "intent": MARKET_INTENT,
        "found": bool(result.get("found")),
        "answer": _market_answer(filters, result),
        "filters": filters,
        "context": resolved_context,
        "observations": list(result.get("observations") or []),
        "market": {
            "source": overlay.get("market_source"),
            "summary": overlay.get("summary"),
            "points": overlay.get("points") or [],
            "reference_price_unit": overlay.get("reference_price_unit"),
            "reference_currency": overlay.get("reference_currency"),
            "comparable_price_count": overlay.get("comparable_price_count", 0),
        },
    }
