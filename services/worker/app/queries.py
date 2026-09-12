from __future__ import annotations

import os
from datetime import datetime
from typing import Any
from uuid import UUID

import httpx


class QueryConfigurationError(RuntimeError):
    pass


def _configuration() -> tuple[str, str]:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_role_key:
        raise QueryConfigurationError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for database queries."
        )
    return supabase_url, service_role_key


async def _rpc_rows(function_name: str, payload: dict[str, object]) -> list[dict[str, Any]]:
    supabase_url, service_role_key = _configuration()
    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": "application/json",
    }
    endpoint = f"{supabase_url}/rest/v1/rpc/{function_name}"
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(endpoint, json=payload, headers=headers)
    if response.is_error:
        raise RuntimeError(
            f"{function_name} query failed with HTTP {response.status_code}."
        )
    rows = response.json()
    if not isinstance(rows, list):
        raise RuntimeError(f"{function_name} returned an invalid response.")
    return rows


async def latest_price(
    *,
    owner_id: UUID,
    grade: str | None = None,
    outer_diameter_mm: float | None = None,
    thickness_mm: float | None = None,
    width_mm: float | None = None,
    height_mm: float | None = None,
) -> dict[str, Any] | None:
    """Return the latest offered observation with provenance for one owner."""

    rows = await _rpc_rows(
        "latest_offered_price_for_owner",
        {
            "target_owner_id": str(owner_id),
            "target_grade": grade,
            "target_outer_diameter_mm": outer_diameter_mm,
            "target_thickness_mm": thickness_mm,
            "target_width_mm": width_mm,
            "target_height_mm": height_mm,
        },
    )
    return rows[0] if rows else None


async def price_history(
    *,
    owner_id: UUID,
    grade: str | None = None,
    outer_diameter_mm: float | None = None,
    thickness_mm: float | None = None,
    width_mm: float | None = None,
    height_mm: float | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Return offered-price history ordered by commercial thread activity."""

    return await _rpc_rows(
        "offered_price_history_for_owner",
        {
            "target_owner_id": str(owner_id),
            "target_grade": grade,
            "target_outer_diameter_mm": outer_diameter_mm,
            "target_thickness_mm": thickness_mm,
            "target_width_mm": width_mm,
            "target_height_mm": height_mm,
            "target_limit": limit,
        },
    )


async def offers_without_order(
    *,
    owner_id: UUID,
    grade: str | None = None,
    since: datetime | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Return offered observations from threads that never reached an order."""

    return await _rpc_rows(
        "offers_without_order_for_owner",
        {
            "target_owner_id": str(owner_id),
            "target_grade": grade,
            "target_since": since.isoformat() if since else None,
            "target_limit": limit,
        },
    )
