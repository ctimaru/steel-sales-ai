#!/usr/bin/env python3
"""STAGING-READY1: fail closed before any network or database write.

Never print connection strings, credentials, or passwords in CI logs.
Only project lwrrrphakpbjhbzljqhn may receive schema updates.
"""
from __future__ import annotations

import os
from urllib.parse import unquote, urlsplit

STAGING_REF = "lwrrrphakpbjhbzljqhn"
PRODUCTION_REF = "ecrafjdummcdfycznitx"


def verify_target(project_ref: str, mode: str, database_url: str) -> None:
    if project_ref != STAGING_REF:
        raise ValueError("Requested project reference is not the approved staging project")
    if mode not in {"plan", "apply"}:
        raise ValueError("Unrecognized mode: only plan and apply are supported")
    if not database_url:
        raise ValueError("Missing GitHub Actions repository secret STAGING_READY1_DB_URL")

    try:
        parsed = urlsplit(database_url)
        port = parsed.port
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid staging database connection URL") from exc

    hostname = (parsed.hostname or "").lower()
    username = unquote(parsed.username or "")
    if parsed.scheme not in {"postgres", "postgresql"} or port not in {5432, 6543}:
        raise ValueError("Connection must use PostgreSQL and a Supabase database port")
    if parsed.path != "/postgres":
        raise ValueError("Unexpected database name; expected postgres")
    if parsed.password is None or not parsed.password:
        raise ValueError("Staging connection password is missing")

    # Accept direct DB and Supabase's IPv4-compatible session/transaction pooler.
    direct = hostname == f"db.{STAGING_REF}.supabase.co" and username == "postgres"
    pooled = (
        hostname.endswith(".pooler.supabase.com")
        and hostname.count(".") >= 4
        and username == f"postgres.{STAGING_REF}"
    )
    if not (direct or pooled):
        raise ValueError("Connection is not to the explicitly approved staging Supabase database")
    if PRODUCTION_REF in database_url:
        raise ValueError("Production project reference is forbidden")


if __name__ == "__main__":
    try:
        verify_target(
            os.getenv("REQUESTED_PROJECT_REF", ""),
            os.getenv("REQUESTED_RUN_MODE", ""),
            os.getenv("STAGING_READY1_DB_URL", ""),
        )
    except ValueError as err:
        print(f"::error title=Unsafe staging target::{err}")
        raise SystemExit(1) from None
    print("Validated isolated staging target and explicit run mode; credentials withheld.")
