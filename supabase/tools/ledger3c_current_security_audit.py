"""SUPA-LEDGER3C — offline acceptance of a dated, read-only production catalog snapshot.

This is a guardrail on saved evidence, NOT an ongoing live security test. It
cannot execute SQL, mutate migration history, or prove tenant isolation.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import datetime
import json
from pathlib import Path
import re

EXPECTED_TABLES={
"public.platform_user_roles","public.network_companies","public.network_company_claims",
"public.network_company_follows","public.network_activity_events",
"public.organization_invitations","public.organization_memberships",
"public.network_data_assertions","public.company_registration_applications",
"private.netdata1eu_trader_research","private.netdata1eu_trader_facility_evidence",
}
EXPECTED_FUNCTIONS={
("private","is_platform_superadmin"),("private","m4_request_company_claim_impl"),
("private","m4_review_company_claim_impl"),("private","m7_user_can_manage_network_company"),
("private","m8_update_managed_network_company_impl"),
("private","p2_recover_legacy_message_identity_impl"),
("private","p2_finalize_legacy_conversation_identity_impl"),
("private","p4_7_follow_company_impl"),("private","p4_7_list_followed_companies_impl"),
("public","m4_request_company_claim"),("public","m4_review_company_claim"),
("public","m6_search_network"),("public","m7_bridge_registration"),
("public","m8_update_managed_network_company"),
("public","p0a_approve_registration_application"),
}
LEGACY_PRIVATE_ANON_GRANTS={
"p2_recover_legacy_message_identity_impl",
"p2_finalize_legacy_conversation_identity_impl",
}

def validate(report: dict) -> dict:
    if report.get("contract")!="supa-ledger3c-live-current-security-snapshot-v1":
        raise ValueError("Unexpected catalog evidence contract")
    if report.get("safe_for_automatic_repair") is not False or report.get("database_writes") != 0:
        raise ValueError("Snapshot must be strictly read-only")
    f=report.get("functions")
    t=report.get("tables")
    if not isinstance(f,list) or not isinstance(t,list):
        raise ValueError("Missing bounded function or table inventory")
    if {(x.get("schema_name"),x.get("function_name")) for x in f} != EXPECTED_FUNCTIONS:
        raise ValueError("Incomplete function inventory")
    if {x.get("name") for x in t} != EXPECTED_TABLES:
        raise ValueError("Incomplete RLS inventory")
    if len(f)!=len(EXPECTED_FUNCTIONS) or len(t)!=len(EXPECTED_TABLES):
        raise ValueError("Duplicate entries in scope")
    sha = re.compile(r"^[a-f0-9]{64}$")
    for x in f:
        if x.get("exists_in_db") is not True or not sha.fullmatch(x.get("definition_sha256") or ""):
            raise ValueError("Function absent or definition hash invalid")
        if x.get("runtime_settings") is None:
            raise ValueError("Cannot validate function search_path")
        if x.get("security_definer") and 'search_path=""' not in x["runtime_settings"]:
            raise ValueError("SECURITY DEFINER function missing fixed search_path")
        if x.get("schema_name")=="public" and x.get("anon_execute"):
            raise ValueError("A selected public entry point is now executable by anon")
        if x.get("schema_name")=="private" and x.get("anon_schema_usage"):
            raise ValueError("Anonymous role has usage on private schema")
        if (x.get("schema_name")=="private" and x.get("anon_execute") and
            x.get("function_name") not in LEGACY_PRIVATE_ANON_GRANTS):
            raise ValueError("Unexpected new private SECURITY DEFINER anonymous grant")
    for x in t:
        if x.get("exists_in_db") is not True or x.get("rls") is not True:
            raise ValueError("Selected table is absent or RLS disabled")
        if x.get("anon_select") or x.get("anon_insert"):
            raise ValueError("Unexpected direct anonymous table access")
        if x.get("name") in {
            "public.platform_user_roles","public.network_company_claims",
            "public.network_activity_events","public.network_company_follows",
            "private.netdata1eu_trader_research","private.netdata1eu_trader_facility_evidence"
        } and x.get("authenticated_select"):
            raise ValueError("Protected table unexpectedly grants authenticated SELECT")
    warnings = [
        "Two legacy private functions retain anon EXECUTE while anon lacks private schema USAGE; scope future revoke cleanup separately.",
        "Catalog grants and fixed search_path alone do not demonstrate function-internal authorization or true tenant isolation.",
        "Company claim and membership conditions require authenticated negative/positive session acceptance.",
    ]
    return {
        "functions_verified":len(f), "rls_tables_verified":len(t),
        "private_legacy_grants_observed":sorted(
            x["function_name"] for x in f
            if x["schema_name"]=="private" and x["anon_execute"]),
        "catalog_evidence_only":True,
        "automatic_migration_repair_allowed":False,
        "warnings":warnings,
    }

def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--snapshot",required=True,type=Path)
    ap.add_argument("--report",type=Path)
    args=ap.parse_args()
    data=json.loads(args.snapshot.read_text(encoding="utf-8"))
    result=validate(data)
    result["contract"]="supa-ledger3c-snapshot-acceptance-v1"
    result["snapshot_date_utc"]=data.get("snapshot_date_utc")
    result["validated_at_utc"]=datetime.now().astimezone().isoformat()
    if args.report:
        args.report.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in result.items() if k!="warnings"},sort_keys=True))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
