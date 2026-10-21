"""SUPA-LEDGER5D — real *signed local JWT* acceptance via GoTrue/PostgREST.

Disposable CI stack only; no external staging, Railway or production endpoint.
Creates two verified synthetic local Auth users, signs in to obtain genuine
JWTs from GoTrue, seeds separate tenant membership under LOCAL postgres, and
calls HTTP Data API as each user and anon. Prints no JWT/keys/credentials.
"""
from __future__ import annotations

import json
import os
import re
import secrets
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid


def read_local_status() -> dict[str, str]:
    out = subprocess.run(
        ["supabase", "status", "-o", "env"],
        check=True, capture_output=True, text=True, timeout=30,
    ).stdout
    result = {}
    for line in out.splitlines():
        match = re.fullmatch(r'([A-Z_]+)="?([^"]*)"?', line.strip())
        if match:
            result[match.group(1)] = match.group(2)
    api_url = result.get("API_URL", "")
    if not api_url.startswith("http://127.0.0.1:54321"):
        raise AssertionError("Refusing non-local API_URL")
    if not result.get("ANON_KEY") or not result.get("SERVICE_ROLE_KEY"):
        raise AssertionError("Local auth keys not reported by Supabase CLI")
    return result


def http_json(url: str, *, apikey: str, bearer: str,
              method: str = "GET", payload: dict | None = None) -> tuple[int, object]:
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url, data=body, method=method,
        headers={
            "apikey": apikey,
            "Authorization": "Bearer " + bearer,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            status, raw = res.status, res.read()
    except urllib.error.HTTPError as err:
        status, raw = err.code, err.read()
    try:
        parsed = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        parsed = {}
    return status, parsed


def must(condition: bool, category: str) -> None:
    if not condition:
        raise AssertionError("LEDGER5D local JWT acceptance failed: " + category)


def seed_local_tenants(users: list[uuid.UUID]) -> list[uuid.UUID]:
    orgs = [uuid.uuid4(), uuid.uuid4()]
    suffix = secrets.token_hex(5)
    statements = []
    for idx, (uid, oid) in enumerate(zip(users, orgs), 1):
        statements.append(
            "INSERT INTO public.organizations(id,name,slug,created_by) VALUES "
            f"('{oid}'::uuid,'Ledger5D Test Tenant {idx}',"
            f"'ledger5d-{idx}-{suffix}','{uid}'::uuid);"
        )
        statements.append(
            "INSERT INTO public.organization_memberships "
            "(organization_id,user_id,role,status,is_default) VALUES "
            f"('{oid}'::uuid,'{uid}'::uuid,'admin','active',true);"
        )
    command = [
        "psql", "--host", "127.0.0.1", "--port", "54322",
        "--username", "postgres", "--dbname", "postgres",
        "--set", "ON_ERROR_STOP=1", "--command", "\n".join(statements),
    ]
    env = dict(os.environ, PGPASSWORD="postgres")
    out = subprocess.run(
        command, env=env, text=True, capture_output=True, timeout=45, check=False,
    )
    must(out.returncode == 0, "local fixture insertion")
    return orgs


def main() -> None:
    conf = read_local_status()
    api = conf["API_URL"].rstrip("/")
    anon = conf["ANON_KEY"]
    service = conf["SERVICE_ROLE_KEY"]
    users: list[uuid.UUID] = []
    tokens: list[str] = []

    for idx in (1, 2):
        password = secrets.token_urlsafe(28)
        email = f"ledger5d-{uuid.uuid4()}@test.invalid"
        status, created = http_json(
            api + "/auth/v1/admin/users", apikey=service, bearer=service,
            method="POST", payload={
                "email": email, "password": password, "email_confirm": True,
                # Deliberately user-controlled metadata: must not confer authority.
                "user_metadata": {"role": "platform_superadmin"},
            },
        )
        must(status in (200, 201) and isinstance(created, dict) and
             isinstance(created.get("id"), str), "create local auth principal")
        uid = uuid.UUID(created["id"])
        status, signed_in = http_json(
            api + "/auth/v1/token?grant_type=password",
            apikey=anon, bearer=anon,
            method="POST", payload={"email": email, "password": password},
        )
        must(status == 200 and isinstance(signed_in, dict) and
             isinstance(signed_in.get("access_token"), str), "real GoTrue password grant")
        access = signed_in["access_token"]
        status, auth_info = http_json(
            api + "/auth/v1/user", apikey=anon, bearer=access,
        )
        must(status == 200 and auth_info.get("id") == str(uid),
             "signed token claims match Auth user")
        users.append(uid)
        tokens.append(access)

    orgs = seed_local_tenants(users)
    checks = 2  # Both GoTrue /auth/v1/user signed-token verifications.

    def tenant_records(table: str, member_token: str, org: uuid.UUID) -> tuple[int, object]:
        params = urllib.parse.urlencode({
            "select": "organization_id,user_id" if table == "organization_memberships" else "id",
            "organization_id" if table == "organization_memberships" else "id": "eq." + str(org),
        })
        return http_json(api + "/rest/v1/" + table + "?" + params,
                         apikey=anon, bearer=member_token)

    for idx in (0, 1):
        own_status, own = tenant_records("organizations", tokens[idx], orgs[idx])
        other_status, other = tenant_records("organizations", tokens[idx], orgs[1-idx])
        must(own_status == 200 and len(own) == 1 and own[0]["id"] == str(orgs[idx]),
             "member sees own tenant")
        must(other_status == 200 and other == [], "member cannot read other tenant")
        mem_status, membership = tenant_records("organization_memberships",
                                                tokens[idx], orgs[idx])
        outsider_status, outsider = tenant_records("organization_memberships",
                                                  tokens[idx], orgs[1-idx])
        must(mem_status == 200 and len(membership) == 1
             and membership[0]["user_id"] == str(users[idx]),
             "member sees own membership")
        must(outsider_status == 200 and outsider == [],
             "member cannot read other membership")
        checks += 4

    anon_status, anon_data = tenant_records("organizations", anon, orgs[0])
    must(anon_status in (401, 403) or anon_data == [],
         "anon cannot read private organizations")
    checks += 1

    untrusted_status, _ = tenant_records("organizations", "not-a-valid-jwt", orgs[0])
    must(untrusted_status in (401, 403), "invalid JWT must be rejected")
    checks += 1

    # An anonymous user must NOT access procurement governance RPC.
    status, _ = http_json(
        api + "/rest/v1/rpc/rfqh13_governance_state", apikey=anon, bearer=anon,
        method="POST", payload={"p_rfq_id": str(uuid.uuid4())},
    )
    must(status in (401, 403), "RFQH13 denies anon RPC")
    checks += 1

    # Private supplier price lists must be invisible regardless of valid login.
    for identity in (anon, tokens[0], tokens[1]):
        status, rows = http_json(
            api + "/rest/v1/price_list_versions?select=id",
            apikey=anon, bearer=identity,
        )
        must(status == 200 and rows == [],
             "private supplier versions not returned to browser identity")
        checks += 1

    print(json.dumps({
        "contract": "supa-ledger5d-real-local-jwt-v1",
        "api": "loopback_only",
        "signed_jwt": "issued_by_local_gotrue",
        "synthetic_users": 2,
        "synthetic_organizations": 2,
        "assertions_passed": checks,
        "production_data_copied": False,
        "production_touched": False,
        "test_credentials_logged": False,
        "actual_remote_staging_tested": False,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
