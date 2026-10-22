#!/usr/bin/env python3
"""C4B-ACCEPT: targeted, atomic, version-matched promotion of ONE reviewed migration.

Never pushes the repository's divergent migration history. No application fixtures.
Requires a GitHub Actions-approved PR head and a reviewed SQL SHA256 for writes.
"""
from __future__ import annotations

import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

STAGING_REF = "lwrrrphakpbjhbzljqhn"
PRODUCTION_REF = "ecrafjdummcdfycznitx"
MIGRATION_VERSION = "20261022085100"
MIGRATION_NAME = "dash_next1c4b_crm_relationship_ledger"
MIGRATION_PATH = Path("candidate/supabase/migrations/" + MIGRATION_VERSION + "_" + MIGRATION_NAME + ".sql")
_DIRECT = re.compile(
    r"^postgres(?:ql)?://postgres:(?P<password>.+)"
    r"@db\.(?P<ref>[a-z0-9]+)\.supabase\.co:(?P<port>5432|6543)/postgres"
    r"(?P<query>\?sslmode=(?:require|verify-ca|verify-full))?$"
)
_POOLER = re.compile(
    r"^postgres(?:ql)?://postgres\.(?P<ref>[a-z0-9]+):(?P<password>.+)"
    r"@(?P<host>[a-z0-9-]+)\.pooler\.supabase\.com:(?P<port>5432|6543)/postgres"
    r"(?P<query>\?sslmode=(?:require|verify-ca|verify-full))?$"
)


def validate_connection(raw: str, target: str) -> str:
    ref = STAGING_REF if target == "staging" else PRODUCTION_REF
    if target not in {"staging", "production"}:
        raise ValueError("invalid target")
    if not raw or raw != raw.strip() or any(ch in raw for ch in "\r\n"):
        raise ValueError("missing or malformed protected database URL secret")
    match = _DIRECT.fullmatch(raw) or _POOLER.fullmatch(raw)
    if not match or match.group("ref") != ref:
        raise ValueError("refuse DB URL: target project ref/endpoint mismatch")
    if (PRODUCTION_REF if target == "staging" else STAGING_REF) in raw:
        raise ValueError("refuse cross-environment database URL")
    password = match.group("password")
    if not password or any(token in password.lower() for token in ("[password]", "your-password", "<password>")):
        raise ValueError("invalid password placeholder")
    encoded = quote(unquote(password), safe="")
    direct = "db." + ref + ".supabase.co"
    hostname = direct if _DIRECT.fullmatch(raw) else match.group("host") + ".pooler.supabase.com"
    user = "postgres" if _DIRECT.fullmatch(raw) else "postgres." + ref
    scheme = raw.split(":", 1)[0]
    normalized = (f"{scheme}://{user}:{encoded}@{hostname}:"
                  f"{match.group('port')}/postgres{match.group('query') or ''}")
    p = urlsplit(normalized)
    if p.hostname != hostname or p.username != user or p.path != "/postgres":
        raise ValueError("unrecognized normalized database endpoint")
    return normalized


def run_sql(url: str, sql: str) -> str:
    proc = subprocess.run(
        ["psql", "--dbname", url, "--no-psqlrc", "-X", "-v", "ON_ERROR_STOP=1", "-At"],
        input=sql, text=True, capture_output=True, timeout=110,
        env={**os.environ, "PGCONNECT_TIMEOUT": "12", "PGAPPNAME": "c4b_accept_targeted_promotion"},
        check=False,
    )
    if proc.returncode:
        # Do not print psql stderr: never risk logging embedded credential fragments.
        raise RuntimeError("targeted database operation failed; inspect protected GitHub Actions logs (no credentials emitted)")
    return proc.stdout.strip()


def history(url: str) -> tuple[str, str, str, str]:
    sql = (
        "select coalesce((select name from supabase_migrations.schema_migrations "
        f"where version='{MIGRATION_VERSION}'),'ABSENT'),"
        "coalesce((select md5(statements[1]) from supabase_migrations.schema_migrations "
        f"where version='{MIGRATION_VERSION}'),'ABSENT'),"
        "coalesce(to_regclass('public.crm_network_relationships')::text,'ABSENT'),"
        "coalesce(to_regclass('public.crm_network_relationship_events')::text,'ABSENT');"
    )
    rows = run_sql(url, sql).splitlines()
    if len(rows) != 1 or len(rows[0].split("|")) != 4:
        raise RuntimeError("unexpected migration history response")
    return tuple(rows[0].split("|"))


def verify_installed(url: str, sql_md5: str) -> None:
    name, stored_md5, relation, events = history(url)
    if name != MIGRATION_NAME or stored_md5 != sql_md5 or "ABSENT" in {relation, events}:
        raise RuntimeError("migration history or tables mismatch; stop release")
    result = run_sql(url, """
    select (
      (select count(*) from pg_policies where schemaname='public'
        and tablename in ('crm_network_relationships','crm_network_relationship_events'))=4
      and (select count(*) from pg_trigger where tgname='crm_c4b_created_audit'
        and not tgisinternal)=1
      and (select count(*) from information_schema.role_table_grants
        where grantee='authenticated'
          and table_name in ('crm_network_relationships','crm_network_relationship_events')
          and privilege_type in ('UPDATE','DELETE'))=0
      and (select relrowsecurity from pg_class where oid='public.crm_network_relationships'::regclass)
      and (select relrowsecurity from pg_class where oid='public.crm_network_relationship_events'::regclass)
    );
    """)
    if result != "t":
        raise RuntimeError("post-migration RLS, trigger or privilege invariant failed")


def promotion_transaction(sql: str) -> str:
    # Encode the exact reviewed SQL as one migration-history statement;
    # source SQL and history row commit atomically or both roll back.
    encoded = sql.encode("utf-8").hex()
    return (
        "begin;\n"
        "set local lock_timeout='5s';\n"
        "set local statement_timeout='90s';\n"
        "select pg_advisory_xact_lock(846422101);\n"
        "do $guard$ begin\n"
        f"if exists(select 1 from supabase_migrations.schema_migrations where version='{MIGRATION_VERSION}' or name='{MIGRATION_NAME}') then raise exception 'C4B migration already registered'; end if;\n"
        "if to_regclass('public.crm_network_relationships') is not null or "
        "to_regclass('public.crm_network_relationship_events') is not null then raise exception 'C4B schema without matching history'; end if;\n"
        "end $guard$;\n"
        + sql + "\n"
        "insert into supabase_migrations.schema_migrations(version,name,statements) values("
        f"'{MIGRATION_VERSION}','{MIGRATION_NAME}',"
        f"array[convert_from(decode('{encoded}','hex'),'utf8')]::text[]);\n"
        "do $verify$ begin\n"
        "if (select count(*) from pg_policies where schemaname='public' "
        "and tablename in ('crm_network_relationships','crm_network_relationship_events'))<>4 "
        "then raise exception 'expected four RLS policies'; end if;\n"
        "if (select count(*) from pg_trigger where tgname='crm_c4b_created_audit' "
        "and not tgisinternal)<>1 then raise exception 'missing audit trigger'; end if;\n"
        "end $verify$;\n"
        "commit;\n"
    )


def main() -> None:
    target = os.environ.get("C4B_TARGET", "")
    mode = os.environ.get("C4B_MODE", "")
    if target not in {"staging", "production"} or mode not in {"plan", "apply", "verify"}:
        raise ValueError("target or mode is invalid")
    url = validate_connection(os.environ.get("C4B_DATABASE_URL", ""), target)
    sql = MIGRATION_PATH.read_text(encoding="utf-8")
    if re.search(r"(?im)^\s*\\(?:!|copy|i|ir)\b", sql):
        raise ValueError("migration contains prohibited psql meta-command")
    if re.search(r"(?i)\b(?:commit|rollback)\s*;", sql):
        raise ValueError("migration contains its own transaction terminator")
    sha = hashlib.sha256(sql.encode()).hexdigest()
    md5 = hashlib.md5(sql.encode()).hexdigest()
    approved = os.environ.get("C4B_APPROVED_SQL_SHA256", "").lower()
    if mode == "apply" and approved != sha:
        raise ValueError("apply refused: SQL SHA256 not explicitly approved from plan")
    name, stored_md5, rel, evt = history(url)
    print(f"Target: {target}, mode: {mode}; C4B version={MIGRATION_VERSION}")
    print(f"Review SQL SHA256: {sha}")
    if name != "ABSENT":
        if name != MIGRATION_NAME or stored_md5 != md5:
            raise RuntimeError("migration version/name or registered SQL differs; STOP")
        verify_installed(url, md5)
        print("Migration already installed and verified. No changes made.")
        return
    if rel != "ABSENT" or evt != "ABSENT":
        raise RuntimeError("target has C4B tables but no matching history; STOP")
    # Do not blindly synchronize the unrelated staging/production migration histories.
    preflight = run_sql(url,
        "select (to_regclass('public.organizations') is not null "
        "and to_regclass('public.network_companies') is not null "
        "and to_regclass('public.organization_memberships') is not null "
        "and to_regprocedure('private.pa1_3_network_access_allowed_for(uuid)') is not null);")
    if preflight != "t":
        raise RuntimeError("missing C4B parent tables or entitlement helper")
    print("Exactly one candidate migration, absent from history; baseline dependencies OK.")
    if mode == "verify":
        raise RuntimeError("migration not installed yet")
    if mode == "plan":
        print("READ ONLY plan complete. No migration or test data written.")
        return
    run_sql(url, promotion_transaction(sql))
    verify_installed(url, md5)
    print("C4B migration and same-version Supabase history committed atomically; RLS/trigger verified.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, OSError, subprocess.TimeoutExpired) as e:
        print("C4B-ACCEPT failed safely: " + str(e), file=sys.stderr)
        sys.exit(1)
