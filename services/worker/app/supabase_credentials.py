"""Supabase privileged API credentials for Railway Worker.

Prefer a short-lived, independently revocable sb_secret_ key over the
legacy JWT-based service_role key. Never log or serialize key values.
"""
from __future__ import annotations

import os


class SupabaseCredentialError(RuntimeError):
    """Credential missing or incompatible, with no secret value in message."""


def get_supabase_admin_key() -> str:
    """SUPABASE_SECRET_KEY takes precedence during deliberate cutover.

    The legacy variable remains a temporary fallback until every consumer
    has migrated. Remove the legacy variable after revocation.
    """
    key = (os.getenv("SUPABASE_SECRET_KEY") or "").strip()
    if not key:
        key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not key:
        raise SupabaseCredentialError("Supabase backend secret API key is required.")
    if key.startswith(("sb_publishable_", "sb_anon_")):
        raise SupabaseCredentialError("Publishable/anon key cannot be used by the privileged Worker.")
    return key


def supabase_admin_headers(key: str) -> dict[str, str]:
    """Send sb_secret_ on apikey only; legacy JWT also needs Bearer.

    Supabase's new secret API keys are not JWTs. Sending one as a bearer
    token causes Invalid JWT in several gateways and integrations.
    """
    if not key or key.startswith(("sb_publishable_", "sb_anon_")):
        raise SupabaseCredentialError("A backend-only Supabase secret API key is required.")
    headers = {"apikey": key}
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {key}"
    return headers
