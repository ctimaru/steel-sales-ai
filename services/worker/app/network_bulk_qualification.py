"""Read-only bulk lead classification through the server-only Supabase RPC."""
from __future__ import annotations
import os
import httpx

def fetch_bulk_qualification(*, offset: int = 0, limit: int = 500) -> dict:
    if offset < 0 or not 1 <= limit <= 1000:
        raise ValueError("invalid pagination")
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("Supabase service role not configured")
    response = httpx.post(
        f"{url}/rest/v1/rpc/net_pipeline1b2m_bulk_qualification",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"p_offset": offset, "p_limit": limit},
        timeout=40.0,
    )
    response.raise_for_status()
    return response.json()
