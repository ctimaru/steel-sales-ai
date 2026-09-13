from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from .queries import commercial_search, latest_price, offers_without_order, price_history

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
_THICKNESS_RE = re.compile(r"\b(?:spessore|sp\.?)(?:\s+di)?\s*(?P<value>\d+(?:[.,]\d+)?)", re.IGNORECASE)
_DIAMETER_RE = re.compile(r"\b(?:diametro|od)(?:\s+di)?\s*(?P<value>\d+(?:[.,]\d+)?)", re.IGNORECASE)
_MIN_DIAMETER_RE = re.compile(
    r"(?:diametr\w*\s*)?(?:>|oltre|maggiore\s+di|superiore\s+a)\s*(?P<value>\d+(?:[.,]\d+)?)",
    re.IGNORECASE,
)
_MAX_DIAMETER_RE = re.compile(
    r"(?:diametr\w*\s*)?(?:<|sotto|inferiore\s+a|minore\s+di)\s*(?P<value>\d+(?:[.,]\d+)?)",
    re.IGNORECASE,
)
_SUPPORTED_INTENTS = {"latest_price", "price_history", "offers_without_order", "commercial_search"}
_FILTER_KEYS = {
    "grade",
    "outer_diameter_mm",
    "min_outer_diameter_mm",
    "max_outer_diameter_mm",
    "thickness_mm",
    "width_mm",
    "height_mm",
    "days",
    "role",
}


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
    elif filters.get("outer_diameter_mm") is not None:
        parts.append(f"Ø {_clean_number(filters['outer_diameter_mm'])}")
    if filters.get("min_outer_diameter_mm") is not None:
        parts.append(f"Ø ≥ {_clean_number(filters['min_outer_diameter_mm'])}")
    if filters.get("max_outer_diameter_mm") is not None:
        parts.append(f"Ø ≤ {_clean_number(filters['max_outer_diameter_mm'])}")
    return " ".join(parts) or "i criteri indicati"


def _parse_days(text: str) -> tuple[bool, int | None]:
    lower = text.casefold()
    if "tutto lo storico" in lower or "tutto storico" in lower or "senza limite temporale" in lower:
        return True, None
    if "ultimo anno" in lower or "ultim'anno" in lower or "ultimi dodici mesi" in lower:
        return True, 365
    match = _TIME_RE.search(text)
    if not match:
        return False, None
    count = int(match.group(1))
    unit = match.group(2).casefold()
    if unit.startswith("giorn"):
        return True, count
    if unit.startswith("mes"):
        return True, round(count * 30.44)
    return True, count * 365


def _parse_role(lower: str) -> str | None:
    if "richiest" in lower or "rfq" in lower:
        return "requested"
    if "consegn" in lower:
        return "delivered"
    if re.search(r"\bordin(?:e|i|ato|ati)\b", lower):
        return "ordered"
    if "offert" in lower or "quotazion" in lower:
        return "offered"
    return None


def _explicit_intent(lower: str, context: dict[str, Any] | None) -> str:
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
        return "offers_without_order"

    previous_intent = str((context or {}).get("intent") or "")
    if any(term in lower for term in ("storico", "andamento", "evoluzione")) and (
        "prezz" in lower or previous_intent in {"latest_price", "price_history"}
    ):
        return "price_history"
    if "tutti i prezzi" in lower or "prezzi offerti" in lower:
        return "price_history"
    if any(
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
        return "latest_price"
    if "prezz" in lower:
        return "latest_price"
    if previous_intent in {"latest_price", "price_history"} and lower.strip() in {
        "ultimo",
        "il più recente",
        "il piu recente",
    }:
        return "latest_price"
    if _parse_role(lower):
        return "commercial_search"
    return "unsupported"


def _context_filters(context: dict[str, Any] | None) -> dict[str, Any]:
    filters = {
        "grade": None,
        "outer_diameter_mm": None,
        "min_outer_diameter_mm": None,
        "max_outer_diameter_mm": None,
        "thickness_mm": None,
        "width_mm": None,
        "height_mm": None,
        "days": None,
        "role": None,
    }
    raw = (context or {}).get("filters")
    if isinstance(raw, dict):
        for key, value in raw.items():
            if key in _FILTER_KEYS:
                filters[key] = value
    return filters


def _has_followup_signal(text: str, explicit_filter_found: bool, time_found: bool) -> bool:
    lower = text.casefold().strip()
    if explicit_filter_found or time_found:
        return True
    return lower.startswith(("e ", "e per ", "solo ", "invece ", "stesso ", "stessa "))


def parse_assistant_query(query: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Translate an Italian commercial question into grounded structured filters.

    Previous resolved context is accepted for follow-up questions, but a request is inherited
    only when the new text contains a clear follow-up signal. Unrelated questions are rejected.
    """

    text = " ".join(query.strip().split())
    lower = text.casefold()
    filters = _context_filters(context)
    explicit_filter_found = False

    grade_match = _GRADE_RE.search(text.upper())
    if grade_match:
        filters["grade"] = grade_match.group(0).upper()
        explicit_filter_found = True

    dimension_match = _DIMENSION_RE.search(text)
    if dimension_match:
        explicit_filter_found = True
        first = _number(dimension_match.group("a"))
        second = _number(dimension_match.group("b"))
        third_raw = dimension_match.group("c")
        third = _number(third_raw) if third_raw else None
        filters["min_outer_diameter_mm"] = None
        filters["max_outer_diameter_mm"] = None
        if third is None or third >= 1000:
            filters["outer_diameter_mm"] = first
            filters["thickness_mm"] = second
            filters["width_mm"] = None
            filters["height_mm"] = None
        else:
            filters["outer_diameter_mm"] = None
            filters["width_mm"] = first
            filters["height_mm"] = second
            filters["thickness_mm"] = third
    else:
        thickness_match = _THICKNESS_RE.search(text)
        if thickness_match:
            filters["thickness_mm"] = _number(thickness_match.group("value"))
            explicit_filter_found = True
        diameter_match = _DIAMETER_RE.search(text)
        if diameter_match:
            filters["outer_diameter_mm"] = _number(diameter_match.group("value"))
            filters["min_outer_diameter_mm"] = None
            filters["max_outer_diameter_mm"] = None
            filters["width_mm"] = None
            filters["height_mm"] = None
            explicit_filter_found = True

    min_match = _MIN_DIAMETER_RE.search(text)
    if min_match:
        filters["outer_diameter_mm"] = None
        filters["min_outer_diameter_mm"] = _number(min_match.group("value"))
        filters["max_outer_diameter_mm"] = None
        explicit_filter_found = True
    max_match = _MAX_DIAMETER_RE.search(text)
    if max_match:
        filters["outer_diameter_mm"] = None
        filters["max_outer_diameter_mm"] = _number(max_match.group("value"))
        filters["min_outer_diameter_mm"] = None
        explicit_filter_found = True

    time_found, days = _parse_days(text)
    if time_found:
        filters["days"] = days

    explicit_role = _parse_role(lower)
    if explicit_role:
        filters["role"] = explicit_role
        explicit_filter_found = True

    intent = _explicit_intent(lower, context)
    previous_intent = str((context or {}).get("intent") or "")
    if intent == "unsupported" and previous_intent in _SUPPORTED_INTENTS and _has_followup_signal(
        text, explicit_filter_found, time_found
    ):
        intent = previous_intent

    if intent in {"latest_price", "price_history", "offers_without_order"}:
        filters["role"] = None
    elif intent == "commercial_search" and filters.get("role") is None and previous_intent == "commercial_search":
        previous_filters = (context or {}).get("filters")
        if isinstance(previous_filters, dict):
            filters["role"] = previous_filters.get("role")

    if intent == "unsupported" and any(word in lower for word in ("mostrami", "cerca", "trova", "quali", "fammi vedere")):
        if explicit_filter_found:
            intent = "commercial_search"

    resolved_context = {"intent": intent, "filters": filters.copy()} if intent in _SUPPORTED_INTENTS else context
    return {
        "intent": intent,
        "filters": filters,
        "query": text,
        "context": resolved_context,
    }


def _query_filters(parsed: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in parsed["filters"].items()
        if key in {"grade", "outer_diameter_mm", "thickness_mm", "width_mm", "height_mm"}
        and value is not None
    }


def _filter_rows_by_days(rows: list[dict[str, Any]], days: int | None) -> list[dict[str, Any]]:
    if not days:
        return rows
    cutoff = datetime.now(UTC) - timedelta(days=int(days))
    result: list[dict[str, Any]] = []
    for row in rows:
        raw = row.get("commercial_at") or row.get("offered_at")
        if not raw:
            continue
        try:
            parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            continue
        if parsed >= cutoff:
            result.append(row)
    return result


def _role_label(role: str | None, count: int) -> str:
    labels = {
        "requested": ("richiesta", "richieste"),
        "offered": ("offerta", "offerte"),
        "ordered": ("ordine", "ordini"),
        "delivered": ("consegna", "consegne"),
    }
    singular, plural = labels.get(role or "", ("osservazione", "osservazioni"))
    return singular if count == 1 else plural


def _period_label(filters: dict[str, Any]) -> str:
    return f" negli ultimi {filters['days']} giorni" if filters.get("days") else ""


def _response_context(intent: str, filters: dict[str, Any]) -> dict[str, Any]:
    return {"intent": intent, "filters": filters.copy()}


async def answer_assistant(
    *,
    owner_id: UUID,
    query: str,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    parsed = parse_assistant_query(query, context=context)
    intent = parsed["intent"]
    filters = parsed["filters"]
    product_filters = _query_filters(parsed)
    resolved_context = _response_context(intent, filters) if intent in _SUPPORTED_INTENTS else context

    if intent == "unsupported":
        return {
            "intent": intent,
            "found": False,
            "answer": (
                "Non posso rispondere in modo verificabile a questa domanda con i workflow attuali. "
                "Posso cercare prezzi, richieste, offerte, ordini, consegne e offerte senza ordine, sempre con fonti."
            ),
            "filters": filters,
            "context": resolved_context,
            "observations": [],
        }

    if intent in {"latest_price", "price_history"} and not product_filters:
        return {
            "intent": intent,
            "found": False,
            "answer": "Indicami almeno qualità o dimensioni del prodotto da cercare.",
            "filters": filters,
            "context": resolved_context,
            "observations": [],
        }

    if intent == "latest_price":
        if filters.get("days"):
            rows = await price_history(owner_id=owner_id, limit=200, **product_filters)
            rows = _filter_rows_by_days(rows, int(filters["days"]))
            row = rows[0] if rows else None
        else:
            row = await latest_price(owner_id=owner_id, **product_filters)
        if row is None:
            return {
                "intent": intent,
                "found": False,
                "answer": f"Non ho trovato offerte con prezzo per {_product_label(filters)}{_period_label(filters)}.",
                "filters": filters,
                "context": resolved_context,
                "observations": [],
            }
        return {
            "intent": intent,
            "found": True,
            "answer": (
                f"L'ultimo prezzo offerto per {_product_label(filters)}{_period_label(filters)} è {_price_label(row)}, "
                f"con data commerciale {_date_label(row.get('commercial_at'))}."
            ),
            "filters": filters,
            "context": resolved_context,
            "observations": [row],
        }

    if intent == "price_history":
        rows = await price_history(owner_id=owner_id, limit=200 if filters.get("days") else 50, **product_filters)
        rows = _filter_rows_by_days(rows, filters.get("days"))[:50]
        if not rows:
            return {
                "intent": intent,
                "found": False,
                "answer": f"Non ho trovato uno storico prezzi per {_product_label(filters)}{_period_label(filters)}.",
                "filters": filters,
                "context": resolved_context,
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
                f"Ho trovato {len(rows)} prezzi offerti per {_product_label(filters)}{_period_label(filters)}. "
                f"Il più recente è {_price_label(rows[0])} del {_date_label(rows[0].get('commercial_at'))}."
                f"{range_text}"
            ),
            "filters": filters,
            "context": resolved_context,
            "observations": rows,
        }

    since = datetime.now(UTC) - timedelta(days=int(filters["days"])) if filters.get("days") else None

    if intent == "offers_without_order":
        rows = await offers_without_order(
            owner_id=owner_id,
            grade=filters.get("grade"),
            since=since,
            limit=100,
        )
        thread_ids = {row.get("thread_id") for row in rows if row.get("thread_id")}
        period = _period_label(filters)
        grade_text = f" per {filters['grade']}" if filters.get("grade") else ""
        if not rows:
            return {
                "intent": intent,
                "found": False,
                "answer": f"Non risultano offerte senza ordine{grade_text}{period}.",
                "filters": filters,
                "context": resolved_context,
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
            "context": resolved_context,
            "thread_count": len(thread_ids),
            "observations": rows,
        }

    rows = await commercial_search(
        owner_id=owner_id,
        role=filters.get("role"),
        grade=filters.get("grade"),
        outer_diameter_mm=filters.get("outer_diameter_mm"),
        min_outer_diameter_mm=filters.get("min_outer_diameter_mm"),
        max_outer_diameter_mm=filters.get("max_outer_diameter_mm"),
        thickness_mm=filters.get("thickness_mm"),
        width_mm=filters.get("width_mm"),
        height_mm=filters.get("height_mm"),
        since=since,
        limit=100,
    )
    thread_ids = {row.get("thread_id") for row in rows if row.get("thread_id")}
    role_text = _role_label(filters.get("role"), len(rows))
    criteria = _product_label(filters)
    if not rows:
        return {
            "intent": intent,
            "found": False,
            "answer": f"Non ho trovato {role_text} per {criteria}{_period_label(filters)}.",
            "filters": filters,
            "context": resolved_context,
            "thread_count": 0,
            "observations": [],
        }
    return {
        "intent": intent,
        "found": True,
        "answer": (
            f"Ho trovato {len(rows)} {role_text} in {len(thread_ids)} trattative per {criteria}"
            f"{_period_label(filters)}."
        ),
        "filters": filters,
        "context": resolved_context,
        "thread_count": len(thread_ids),
        "observations": rows,
    }
