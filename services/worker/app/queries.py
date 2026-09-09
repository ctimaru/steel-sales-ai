from __future__ import annotations

import os
from decimal import Decimal
from typing import Any

import httpx


class QueryConfigurationError(RuntimeError):
    pass


def _eq(value: str | int | float | Decimal) -> str:
    return f"eq.{value}"


async def latest_price(
    *,
    grade: str | None = None,
    outer_diameter_mm: float | None = None,
    thickness_mm: float | None = None,
    width_mm: float | None = None,
    height_mm: float | None = None,
) -> dict[str, Any] | None:
    """Return the latest offered observation with provenance.

    This is deliberately a structured read-only query. It does not use an LLM
    to invent filters or values and returns None when no matching offer exists.
    """

    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_role_key:
        raise QueryConfigurationError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for database queries."
        )

    params: dict[str, str] = {
        "select": (
            "id,grade,standard,outer_diameter_mm,width_mm,height_mm,"
            "thickness_mm,length_mm,price_value,price_unit,currency,"
            "source_text,source_filename,confidence,created_at,thread_id"
        ),
        "item_role": "eq.offered",
        "price_value": "not.is.null",
        "order": "created_at.desc",
        "limit": "1",
    }
    if grade:
        params["grade"] = _eq(grade)
    if outer_diameter_mm is not None:
        params["outer_diameter_mm"] = _eq(outer_diameter_mm)
    if thickness_mm is not None:
        params["thickness_mm"] = _eq(thickness_mm)
    if width_mm is not None:
        params["width_mm"] = _eq(width_mm)
    if height_mm is not None:
        params["height_mm"] = _eq(height_mm)

    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
    }
    endpoint = f"{supabase_url}/rest/v1/commercial_observations"
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(endpoint, params=params, headers=headers)
    if response.is_error:
        raise RuntimeError(f"Latest price query failed with HTTP {response.status_code}.")
    rows = response.json()
    return rows[0] if rows else None
