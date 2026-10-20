#!/usr/bin/env python3
"""STAGING-READY1 fail-closed database target guard.

Never print credentials or URLs. Validated, normalized URLs are passed to
subsequent trusted GitHub Actions steps through GITHUB_ENV, not stdout.
"""
from __future__ import annotations

import os
import re
from urllib.parse import quote, unquote, urlsplit

STAGING_REF = "lwrrrphakpbjhbzljqhn"
PRODUCTION_REF = "ecrafjdummcdfycznitx"

# Match the endpoint *before* interpreting reserved characters in the password.
# Otherwise a raw '#' or '/' from Supabase's DB password can corrupt urlsplit.
_DIRECT = re.compile(
    r"^(?P<scheme>postgres(?:ql)?)://postgres:(?P<password>.+)"
    r"@db\.(?P<ref>[a-z0-9]+)\.supabase\.co:"
    r"(?P<port>5432|6543)/postgres(?P<query>\?sslmode=(?:require|verify-ca|verify-full))?$"
)
_POOLER = re.compile(
    r"^(?P<scheme>postgres(?:ql)?)://postgres\.(?P<ref>[a-z0-9]+):"
    r"(?P<password>.+)@(?P<host>[a-z0-9-]+)\.pooler\.supabase\.com:"
    r"(?P<port>5432|6543)/postgres(?P<query>\?sslmode=(?:require|verify-ca|verify-full))?$"
)


def verify_target(project_ref: str, mode: str, database_url: str) -> str:
    if project_ref != STAGING_REF:
        raise ValueError("Requested project reference is not the approved staging project")
    if mode not in {"plan", "apply"}:
        raise ValueError("Unrecognized mode; only plan or apply is supported")
    if not database_url:
        raise ValueError("Missing repository Actions secret STAGING_READY1_DB_URL")
    if database_url != database_url.strip() or any(c in database_url for c in "\r\n"):
        raise ValueError("Repository secret must be one unquoted PostgreSQL URI")
    if any(database_url.startswith(c) for c in ('"', "'")):
        raise ValueError("Repository secret must not contain surrounding quote marks")
    if any(marker in database_url.lower() for marker in
           ("[your-password]", "[password]", "<password>", "your_database_password")):
        raise ValueError("Connection still contains a password placeholder")

    match = _DIRECT.fullmatch(database_url) or _POOLER.fullmatch(database_url)
    if match is None:
        raise ValueError(
            "Staging connection has the wrong URL structure: use the full "
            "Supabase Connect URI for the staging project, not the password alone"
        )
    if match.group("ref") != STAGING_REF:
        raise ValueError("Database username/hostname does not match approved staging")
    if PRODUCTION_REF in database_url:
        raise ValueError("Production project reference is forbidden")

    # Idempotent for percent-encoded passwords; also handles raw @, :, # and /.
    password = match.group("password")
    if not password:
        raise ValueError("Staging DB password is missing")
    encoded_password = quote(unquote(password), safe="")
    if _DIRECT.fullmatch(database_url):
        host = f"db.{STAGING_REF}.supabase.co"
        user = "postgres"
    else:
        host = f"{match.group('host')}.pooler.supabase.com"
        user = f"postgres.{STAGING_REF}"
    normalized = (
        f"{match.group('scheme')}://{user}:{encoded_password}@{host}:"
        f"{match.group('port')}/postgres{match.group('query') or ''}"
    )

    # Check our normalized connection has a single intended host and port.
    parsed = urlsplit(normalized)
    if parsed.hostname != host or parsed.username != user or parsed.port not in {5432, 6543}:
        raise ValueError("Normalized connection did not pass the staging target check")
    if parsed.path != "/postgres" or not parsed.password:
        raise ValueError("Invalid staging database/password")
    return normalized


if __name__ == "__main__":
    try:
        clean_uri = verify_target(
            os.getenv("REQUESTED_PROJECT_REF", ""),
            os.getenv("REQUESTED_RUN_MODE", ""),
            os.getenv("STAGING_READY1_DB_URL", ""),
        )
        github_env = os.getenv("GITHUB_ENV")
        if github_env:
            with open(github_env, "a", encoding="utf8") as handle:
                handle.write(f"STAGING_READY1_DB_URL={clean_uri}\n")
    except ValueError as err:
        print(f"::error title=Unsafe staging target::{err}")
        raise SystemExit(1) from None
    print("Verified isolated Supabase staging endpoint; credential kept private.")
