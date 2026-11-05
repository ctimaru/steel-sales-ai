"""NET-GROWTH3.F.2C.1 — source corrections and corporate reconciliation.

Read-only documentary overlay, never modifies the original research snapshots,
never produces service-role RPC import items, and never creates an approval.
"""
import json
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1] / "data"
REMEDIATION = ROOT / "netgrowth3f2c1_corporate_source_remediation_20261105.json"
AUDIT = ROOT / "netgrowth3f2c_independent_acceptance_20261105.json"
FILES = ("netgrowth3f_first_party_research_20261105.json",
         "netgrowth3f2_industrial_research_20261105.json",
         "netgrowth3f2b_industrial_research_20261105.json")


def source_domain(url: str) -> str:
    x = urlsplit(url)
    if x.scheme != "https" or x.username or x.password or x.fragment or x.port is not None:
        raise ValueError("Expected literal secure first-party source")
    return (x.hostname or "").lower().removeprefix("www.")


def readback() -> dict:
    overlay = json.loads(REMEDIATION.read_text(encoding="utf-8"))
    original = [r for f in FILES for r in json.loads((ROOT/f).read_text(encoding="utf-8"))["records"]]
    audit = json.loads(AUDIT.read_text(encoding="utf-8"))
    domain_index = {r["domain"] for r in original}
    if len(original) != 50 or len(domain_index) != 50:
        raise ValueError("50 distinct legacy research domains required")
    if {x["domain"] for x in audit["entries"]} != domain_index:
        raise ValueError("Existing legal review ledger does not match research")

    excluded = {d for d,x in overlay["domain_vat_reconciliation"].items()
                if x["decision"].startswith("excluded_from_net_new")}
    if not excluded <= domain_index:
        raise ValueError("Exclusion target not in original pool")
    reserves = overlay["replacement_reserve"]
    reserve_domains = {x["domain"] for x in reserves}
    if len(reserve_domains) != len(reserves) or domain_index & reserve_domains:
        raise ValueError("Reserves duplicate existing candidates")
    for entry in reserves:
        if any(source_domain(entry[url]) != entry["domain"] for url in ("first_party_claim_url", "first_party_identity_url")):
            raise ValueError("Source must be an exact first-party domain")
        if entry["role"] not in {"producer", "processor_service_provider"}:
            raise ValueError("Invalid industrial role")
        if entry["legal_review"] != "pending_independent_registry" or entry["rights_review"] != "pending":
            raise ValueError("New prospect is incorrectly declared approved")
    for correction in overlay["technical_claim_source_corrections"]:
        if correction["domain"] not in domain_index or source_domain(correction["new_url"]) != correction["domain"]:
            raise ValueError("A corrected claim lacks same-company first-party URL")
    for r in overlay["role_review_holds"]:
        if r["domain"] not in domain_index:
            raise ValueError("Unknown role review hold")
    if overlay["allow_import"] is not False or overlay["production_rpc_called"] is not False:
        raise ValueError("Unexpected write authorization")
    return {
        "status": "research_only_remediation",
        "original_candidates": len(original),
        "excluded_from_original_new_entity_count": len(excluded),
        "remaining_original_prospects": len(original) - len(excluded),
        "new_reserve_prospects": len(reserves),
        "total_non_excluded_research_prospects": len(original) - len(excluded) + len(reserves),
        "confirmed_approved": 0,
        "technical_source_corrections": len(overlay["technical_claim_source_corrections"]),
        "production_import_permitted": False,
        "preflight_rpc_permitted": False,
    }


if __name__ == "__main__":
    print(json.dumps(readback(), sort_keys=True, indent=2))
