from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from .queries import latest_price, offers_without_order, price_history

_DIMENSION_RE = re.compile(
    r"(?P<a>\d{2,5}(?:[.,]\d+)?)\s*[x×]\s*(?P<b>\d{1,5}(?:[.,]\d+)?)"
    r"(?:\s*[x×]\s*(?P<c>\d{1,6}(?:[.,]\d+)?))?",
    re.IGNORECASE,
)
_GRADE_RE = re.compile(
    r"\b(?:P\d{3}[A-Z0-9]*|S\d{3}[A-Z0-9]*|L\d{3}[A-Z0-9]*|E\d{3}[A-Z0-9]*)\b",
    re.IGNORECASE,
)
_TIME_RE = re.compile(r"(?:ultim[ioe]|scors[ioe])\s+(\d+)\s*(giorni?|mesi?|anni?)", re.IGNORECASE)


def _number(value: str) -> float:
    return float(value.replace(",", "."))


def _clean_number(value: float | int | str | None) -> str:
    if value is None:
        return "—"
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    if number.is_integer():
        return f"{int(number):,}".replace(",", ".")
    return f"{number:.3f}".rstrip("0").rstrip(".").replace(".", ",")


def _price_label(row: dict[str, Any]) -> str:
    value = row.get("price_value")
    currency = str(row.get("currency") or "EUR").upper()
    unit = str(row.get("price_unit") or "").upper()
    amount = _clean_number(value)
    prefix = "€" if currency == "EUR" else currency
    suffix = "/m" if unit == "M" else "/t" if unit == "T" else f"/{unit}" if unit else ""
    return f"{amount} {prefix}{suffix}".strip()


def _date_label(value: object) -> str:
    if not value:
        return "data non disponibile"
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return str(value)
    return parsed.strftime("%d/%m/%Y")


def _product_label(filters: dict[str, Any]) -> str:
    parts: list[str] = []
    if filters.get("grade"):
        parts.append(str(filters["grade"]))
    if filters.get("outer_diameter_mm") is not None and filters.get("thickness_mm") is not None:
        parts.append(
            f"{_clean_number(filters['outer_diameter_mm'])}x{_clean_number(filters['thickness_mm'])}"
        )
    elif (
        filters.get("width_mm") is not None
        and filters.get("height_mm") is not None
        and filters.get("thickness_mm") is not None
    ):
        parts.append(
            f"{_clean_number(filters['width_mm'])}x{_clean_number(filters['height_mm'])}x{_clean_number(filters['thickness_mm'])}"
        )
    return " ".join(parts) or "i criteri indicati"


def _parse_days(text: str) -> int | None:
    lower = text.casefold()
    if "tutto lo storico" in lower or "tutto storico" in lower:
        return None
    if "ultimo anno" in lower or "ultim'anno" in lower or "ultimi dodici mesi" in lower:
        return 365
    match = _TIME_RE.search(text)
    if not match:
        return None
    count = int(match.group(1))
    unit = match.group(2).casefold()
    if unit.startswith("giorn"):
        return count
    if unit.startswith("mes"):
        return round(count * 30.44)
    return count * 365


def parse_assistant_query(query: str) -> dict[str, Any]:
    """Translate a narrow Italian commercial question into grounded structured filters.

    This router deliberately supports only workflows backed by validated database queries.
    Unknown requests are returned as ``unsupported`` instead of guessing.
    """

    text = " ".join(query.strip().split())
    lower = text.casefold()

    if any(
        phrase in lower
        for phrase in (
            "senza ordine",
            "senza ordini",
            "non convert",
            "non hanno ordine",
            "non ha ordine",
            "offerte aperte",
            "offerte da seguire",
        )
    ):
        intent = "offers_without_order"
    elif any(term in lower for term in ("storico", "andamento", "evoluzione")) and "prezz" in lower:
        intent = "price_history"
    elif "tutti i prezzi" in lower or "prezzi offerti" in lower:
        intent = "price_history"
    elif any(
        phrase in lower
        for phrase in (
            "ultimo prezzo",
            "prezzo ultimo",
            "prezzo più recente",
            "prezzo piu recente",
            "ultima offerta",
            "ultimo offerto",
            "quanto abbiamo offerto",
            "quanto ho offerto",
        )
    ):
        intent = "latest_price"
    elif "prezz" in lower:
        intent = "latest_price"
    else:
        intent = "unsupported"

    grade_match = _GRADE_RE.search(text.upper())
    grade = grade_match.group(0).upper() if grade_match else None

    filters: dict[str, Any] = {
        "grade": grade,
        "outer_diameter_mm": None,
        "thickness_mm": None,
        "width_mm": None,
        "height_mm": None,
    }

    dimension_match = _DIMENSION_RE.search(text)
    if dimension_match:
        first = _number(dimension_match.group("a"))
        second = _number(dimension_match.group("b"))
        third_raw = dimension_match.group("c")
        third = _number(third_raw) if third_raw else None

        if third is None:
            filters["outer_diameter_mm"] = first
            filters["thickness_mm"] = second
        elif third >= 1000:
            # Common round-tube notation: OD x thickness x commercial length.
            filters["outer_diameter_mm"] = first
            filters["thickness_mm"] = second
        else:
            # Common hollow-section notation: width x height x thickness.
            filters["width_mm"] = first
            filters["height_mm"] = second
            filters["thickness_mm"] = third

    days = _parse_days(text)
    if days is not None:
        filters["days"] = days

    return {"intent": intent, "filters": filters, "query": text}


def _query_filters(parsed: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in parsed["filters"].items()
        if key in {"grade", "outer_diameter_mm", "thickness_mm", "width_mm", "height_mm"}
        and value is not None
    }


async def answer_assistant(*, owner_id: UUID, query: str) -> dict[str, Any]:
    parsed = parse_assistant_query(query)
    intent = parsed["intent"]
    filters = parsed["filters"]
    product_filters = _query_filters(parsed)

    if intent == "unsupported":
        return {
            "intent": intent,
            "found": False,
            "answer": (
                "Posso interrogare in modo verificabile ultimo prezzo, storico prezzi e offerte senza ordine. "
                "Prova ad esempio: ‘qual è l'ultimo prezzo del P265GH 406,4x6,3?’"
            ),
            "filters": filters,
            "observations": [],
        }

    if intent in {"latest_price", "price_history"} and not product_filters:
        return {
            "intent": intent,
            "found": False,
            "answer": "Indicami almeno qualità o dimensioni del prodotto da cercare.",
            "filters": filters,
            "observations": [],
        }

    if intent == "latest_price":
        row = await latest_price(owner_id=owner_id, **product_filters)
        if row is None:
            return {
                "intent": intent,
                "found": False,
                "answer": f"Non ho trovato offerte con prezzo per {_product_label(filters)}.",
                "filters": filters,
                "observations": [],
            }
        return {
            "intent": intent,
            "found": True,
            "answer": (
                f"L'ultimo prezzo offerto per {_product_label(filters)} è {_price_label(row)}, "
                f"con data commerciale {_date_label(row.get('commercial_at'))}."
            ),
            "filters": filters,
            "observations": [row],
        }

    if intent == "price_history":
        rows = await price_history(owner_id=owner_id, limit=50, **product_filters)
        if not rows:
            return {
                "intent": intent,
                "found": False,
                "answer": f"Non ho trovato uno storico prezzi per {_product_label(filters)}.",
                "filters": filters,
                "observations": [],
            }

        comparable = [
            row
            for row in rows
            if row.get("price_value") is not None
            and row.get("price_unit") == rows[0].get("price_unit")
            and (row.get("currency") or "EUR") == (rows[0].get("currency") or "EUR")
        ]
        values = [float(row["price_value"]) for row in comparable]
        range_text = ""
        if len(values) > 1:
            min_row = dict(rows[0], price_value=min(values))
            max_row = dict(rows[0], price_value=max(values))
            range_text = f" Intervallo osservato: {_price_label(min_row)} – {_price_label(max_row)}."
        return {
            "intent": intent,
            "found": True,
            "answer": (
                f"Ho trovato {len(rows)} prezzi offerti per {_product_label(filters)}. "
                f"Il più recente è {_price_label(rows[0])} del {_date_label(rows[0].get('commercial_at'))}."
                f"{range_text}"
            ),
            "filters": filters,
            "observations": rows,
        }

    since = None
    if filters.get("days"):
        since = datetime.now(UTC) - timedelta(days=int(filters["days"]))
    rows = await offers_without_order(
        owner_id=owner_id,
        grade=filters.get("grade"),
        since=since,
        limit=100,
    )
    thread_ids = {row.get("thread_id") for row in rows if row.get("thread_id")}
    period = f" negli ultimi {filters['days']} giorni" if filters.get("days") else ""
    grade_text = f" per {filters['grade']}" if filters.get("grade") else ""
    if not rows:
        return {
            "intent": intent,
            "found": False,
            "answer": f"Non risultano offerte senza ordine{grade_text}{period}.",
            "filters": filters,
            "thread_count": 0,
            "observations": [],
        }
    return {
        "intent": intent,
        "found": True,
        "answer": (
            f"Ho trovato {len(thread_ids)} trattative con offerte ma nessun ordine nello stesso thread"
            f"{grade_text}{period}, per un totale di {len(rows)} righe di offerta."
        ),
        "filters": filters,
        "thread_count": len(thread_ids),
        "observations": rows,
    }
