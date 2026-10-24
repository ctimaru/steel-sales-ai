"""Fail-closed configuration gate for hosted Global Search JWT acceptance.

This gate never contacts Supabase or Railway and never prints credentials.
It must run before any synthetic user is provisioned.
"""
from __future__ import annotations
import os
from urllib.parse import urlparse

STAGING_REF = "lwrrrphakpbjhbzljqhn"


def verify_staging_worker_env(env: dict[str, str]) -> None:
    if env.get("REQUESTED_PROJECT_REF") != STAGING_REF:
        raise ValueError("Expected dedicated Supabase staging project")
    if env.get("RAILWAY_ENVIRONMENT_NAME") != "staging":
        raise ValueError("Dedicated Railway staging environment required")
    if not env.get("RAILWAY_STAGING_PROJECT_ID") or not env.get("RAILWAY_STAGING_SERVICE_ID"):
        raise ValueError("Explicit Railway staging project and service IDs required")
    if env.get("RAILWAY_STAGING_PROJECT_ID") == "46de9589-577c-4e28-9d84-b2ff2d827426" and env.get("RAILWAY_STAGING_ENVIRONMENT_ID") == "8dbd43c9-36a3-419f-b965-178d55567d02":
        raise ValueError("Production Railway environment is forbidden")
    url = urlparse(env.get("STAGING_WORKER_URL", ""))
    if url.scheme != "https" or not url.hostname:
        raise ValueError("HTTPS staging Worker URL required")
    if url.username or url.password or url.query or url.fragment:
        raise ValueError("Staging URL cannot contain credentials or query parameters")
    if url.hostname == "steel-sales-ai-production.up.railway.app" or "production" in url.hostname:
        raise ValueError("Production Worker URL is forbidden")
    if not env.get("STAGING_WORKER_INTERNAL_TOKEN"):
        raise ValueError("Separate staging-only internal token required")


if __name__ == "__main__":
    verify_staging_worker_env(dict(os.environ))
    print("SEC-P0 staging Worker configuration preflight PASS")
