"""SUPA-LEDGER5 — deterministic OFFLINE migration-history reconciliation *assessment*.

Reads checked-in migration SQL and SHA256/byte-size snapshot. Never connects to
Supabase, runs SQL, edits the migration ledger or emits executable repair commands.
The output is a decision ledger requiring separate human/technical approval.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path

from migration_sql_fingerprint_audit import classify, load_local, load_remote


EXPECTED_PROJECT = "ecrafjdummcdfycznitx"
CONTRACT = "supa-ledger5-conservative-history-plan-v1"


def assess(local: list[dict], remote: list[dict]) -> dict:
    """Classify all local+remote rows. No category authorizes a DB history edit."""
    base = classify(local, remote)
    remote_name = defaultdict(list)
    remote_version = defaultdict(list)
    local_name = defaultdict(list)
    local_version = defaultdict(list)
    for r in remote:
        remote_name[r["name"]].append(r)
        remote_version[r["version"]].append(r)
    for l in local:
        local_name[l["name"]].append(l)
        local_version[l["version"]].append(l)

    # A timestamp is the identity compared by the Supabase CLI. Reject
    # collisions in either direction even when a matching name/hash exists.
    local_version_collisions = {
        v: sorted({x["name"] for x in group})
        for v, group in local_version.items() if len(group) != 1
    }
    remote_version_collisions = {
        v: sorted({x["name"] for x in group})
        for v, group in remote_version.items() if len(group) != 1
    }

    rows = []
    for candidate in base["local_classifications"]:
        name, version, category = (
            candidate["name"], candidate["local_version"], candidate["category"]
        )
        other_at_target = sorted({
            x["name"] for x in remote_version.get(version, [])
            if x["name"] != name
        })
        remote_own = remote_name.get(name, [])
        if category == "exact_version_and_sql":
            decision = "RETAIN_EXACT_NO_ACTION"
        elif category == "identical_sql_different_version":
            decision = "HOLD_SAME_SQL_VERSION_MISMATCH"
        elif category == "cosmetic_prefix_or_trailing_space_difference":
            decision = "HOLD_COSMETIC_TEXT_DIFFERENCE"
        elif category == "different_sql_same_name":
            decision = "HOLD_DIFFERENT_SQL"
        elif category == "ambiguous_duplicate_name":
            decision = "HOLD_AMBIGUOUS_NAME"
        elif category == "only_in_local":
            decision = "HOLD_ONLY_LOCAL"
        else:
            raise AssertionError("Unknown classifier category: " + category)
        if other_at_target or version in local_version_collisions or version in remote_version_collisions:
            # Preserve the original diagnosis while explicitly blocking any
            # timestamp collision. Never replace a remote migration by number.
            decision = "HOLD_VERSION_COLLISION"
        rows.append({
            "name": name,
            "local_version": version,
            "decision": decision,
            "content_match_class": category,
            "remote_same_name_versions": sorted(x["version"] for x in remote_own),
            "identical_sql_remote_versions": candidate["matching_remote_versions"],
            "remote_names_at_local_version": other_at_target,
            "requires_order_and_schema_review": category != "exact_version_and_sql",
            "repair_authorized": False,
        })
    rows.sort(key=lambda r: (r["local_version"], r["name"]))

    remote_only = sorted(base["remote_only"], key=lambda r: (r["remote_version"], r["name"]))
    remote_only_sha_matches_elsewhere = []
    all_local_sha = defaultdict(list)
    for local_row in local:
        all_local_sha[(local_row["sha256"], local_row["bytes"])].append(local_row)
    for r in remote_only:
        # A differently named local SQL file with the same SHA is evidence
        # to investigate, not evidence of identical version semantics.
        same = all_local_sha.get((r["sql_sha256"], r["remote_bytes"]), [])
        if same:
            remote_only_sha_matches_elsewhere.append({
                "remote_name": r["name"],
                "remote_version": r["remote_version"],
                "identical_local_name_versions": sorted(
                    [{"name": x["name"], "version": x["version"]} for x in same],
                    key=lambda x: (x["version"], x["name"])
                ),
                "repair_authorized": False,
            })

    # Detect cases where ordering by GitHub's timestamps and by the stored
    # production timestamps would have conflicting migration relative order.
    # This is diagnostic; it does not prove the original execution order.
    unique_map = []
    for l in rows:
        own = remote_name.get(l["name"], [])
        if len(own) == 1 and len(local_name[l["name"]]) == 1:
            unique_map.append((l["local_version"], own[0]["version"], l["name"]))
    unique_map.sort()
    max_seen = ""
    order_conflicts = []
    for local_v, remote_v, name in unique_map:
        if remote_v < max_seen:
            order_conflicts.append({"name": name, "local_version": local_v,
                                    "remote_version": remote_v})
        if remote_v > max_seen:
            max_seen = remote_v

    decision_totals = dict(sorted(Counter(r["decision"] for r in rows).items()))
    return {
        "contract": CONTRACT,
        "production_project_id": EXPECTED_PROJECT,
        "snapshot_live_freshness_checked": False,
        "freshness_warning": (
            "Offline script cannot verify snapshot still equals production. "
            "Require a fresh independent read-only SQL/hash comparison just "
            "before any separate approved migration-history operation."
        ),
        "safe_for_automatic_repair": False,
        "history_mutations_allowed": False,
        "repair_commands": [],
        "required_gates": [
            "Full current production ledger SHA256/name/version revalidation",
            "Official Supabase linked CLI migration list using correct privately managed password",
            "Resolve all duplicate names and version collisions with ordering provenance",
            "Evaluate remote-only and local-only schema effects, including security and tenant isolation",
            "Isolated clean-build comparisons for M5 retrieval targets, SK4.2 structure seeds and PL1.5 geometry key",
            "Read-only multi-role RLS/RPC/catalog acceptance for Identity2D, Commerciale and Network",
            "Backup/recovery/maintenance-window plan with approval for individually enumerated history actions",
            "After any approved future change, full read-only re-audit before db push or Identity2D release",
        ],
        "summary": {
            "local_total": len(local),
            "remote_total": len(remote),
            "unique_local_names": len(local_name),
            "unique_remote_names": len(remote_name),
            "decision_totals": decision_totals,
            "only_remote_entries": len(remote_only),
            "remote_only_identical_sql_different_name": len(remote_only_sha_matches_elsewhere),
            "local_duplicate_names": len(base["duplicate_names"]["local"]),
            "remote_duplicate_names": len(base["duplicate_names"]["remote"]),
            "local_version_collisions": len(local_version_collisions),
            "remote_version_collisions": len(remote_version_collisions),
            "order_conflicts_indicated": len(order_conflicts),
            "all_historical_differences_cleared": False,
        },
        "local_assessment": rows,
        "remote_only": remote_only,
        "duplicate_names": base["duplicate_names"],
        "local_version_collisions": local_version_collisions,
        "remote_version_collisions": remote_version_collisions,
        "order_conflicts": order_conflicts,
        "remote_only_with_identical_sql_under_another_local_name":
            remote_only_sha_matches_elsewhere,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--local", type=Path, default=Path("supabase/migrations"))
    parser.add_argument("--remote-hashes", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    doc = json.loads(args.remote_hashes.read_text(encoding="utf-8"))
    if doc.get("production_project_id") != EXPECTED_PROJECT:
        raise SystemExit("Wrong production project: fail closed")
    data = assess(load_local(args.local), load_remote(args.remote_hashes))
    data["snapshot_observed_on"] = doc.get("observed_on")
    data["generated_at_utc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(data["summary"], sort_keys=True))
    print("READ ONLY: zero permitted migration-history repair commands.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
