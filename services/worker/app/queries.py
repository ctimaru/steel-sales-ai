from __future__ import annotations

import os
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx


class QueryConfigurationError(RuntimeError):
    pass


async def latest_price(
    *,
    owner_id: UUID,
    grade: str | None = None,
    outer_diameter_mm: float | None = None,
    thickness_mm: float | None = None,
    width_mm: float | None = None,
    height_mm: float | None = None,
) -> dict[str, Any] | None:
    """Return the latest offered observation with provenance for one owner.

    The database RPC orders offers by the commercial thread activity timestamp,
    not by the observation import timestamp. This is deliberately a structured
    read-only query and returns None when no matching offer exists.
    """

    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_role_key:
        raise QueryConfigurationError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for database queries."
        )

    payload: dict[str, str | float | None] = {
        "target_owner_id": str(owner_id),
        "target_grade": grade,
        "target_outer_diameter_mm": outer_diameter_mm,
        "target_thickness_mm": thickness_mm,
        "target_width_mm": width_mm,
        "target_height_mm": height_mm,
    }

    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": "application/json",
    }
    endpoint = f"{supabase_url}/rest/v1/rpc/latest_offered_price_for_owner"
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(endpoint, json=payload, headers=headers)
    if response.is_error:
        raise RuntimeError(f"Latest price query failed with HTTP {response.status_code}.")
    rows = response.json()
    return rows[0] if rows else None
