"""SUPA-LEDGER5B — offline orphan & duplicate provenance index (NO REPAIR).

All inputs are local migration SQL files and the checked-in, fingerprint-only
production snapshot. No connection, SQL execution, publication or history edit.
Same hash is evidence of bytes, NOT authorization to rewrite versions.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path

from migration_sql_fingerprint_audit import load_local, load_remote

CONTRACT = "supa-ledger5b-orphan-duplicate-provenance-v1"
EXPECTED_PROJECT = "ecrafjdummcdfycznitx"

# Routing hint ONLY; any new name defaults to manual review, never approval.
HIGH_IMPACT_PREFIXES = (
    "sec", "pa1_", "pa2_", "pp1_", "p3_", "rfq", "bd1_", "netfast",
    "netlaunch", "netconnect", "netdata", "trader", "school",
    "pl1_", "initial_commercial", "create_app_facing", "commercial_unify",
    "worker_", "secure_", "human_correction", "add_human_correction",
)


def _risk(name: str) -> str:
    return "P0_IDENTITY_SECURITY_OR_DATA" if name.startswith(HIGH_IMPACT_PREFIXES) else "P1_PROVENANCE"


def _rec(row: dict) -> dict:
    return {
        "name": row["name"], "version": row["version"],
        "sha256": row["sha256"], "bytes": row["bytes"],
    }


def analyze(local: list[dict], remote: list[dict]) -> dict:
    """Diagnose ALL unpaired names and duplicates. Never propose a repair."""
    ln = defaultdict(list)
    rn = defaultdict(list)
    local_by_bytes = defaultdict(list)
    remote_by_bytes = defaultdict(list)
    for x in local:
        ln[x["name"]].append(x)
        local_by_bytes[(x["sha256"], x["bytes"])].append(x)
    for x in remote:
        rn[x["name"]].append(x)
        remote_by_bytes[(x["sha256"], x["bytes"])].append(x)

    local_only = []
    for name in sorted(set(ln) - set(rn)):
        for x in sorted(ln[name], key=lambda y: y["version"]):
            matches = sorted((_rec(z) for z in remote_by_bytes[(x["sha256"], x["bytes"])]
                              if z["name"] != name), key=lambda z: (z["version"], z["name"]))
            local_only.append({
                **_rec(x), "impact_hint": _risk(name),
                "status": "HOLD_NOT_RECORDED_BY_NAME",
                "remote_identical_sql_other_name": matches,
                "schema_presence_verified": False,
                "repair_authorized": False,
            })

    remote_only = []
    for name in sorted(set(rn) - set(ln)):
        for x in sorted(rn[name], key=lambda y: y["version"]):
            matches = sorted((_rec(z) for z in local_by_bytes[(x["sha256"], x["bytes"])]
                              if z["name"] != name), key=lambda z: (z["version"], z["name"]))
            remote_only.append({
                **_rec(x), "impact_hint": _risk(name),
                "status": "HOLD_PRODUCTION_PROVENANCE",
                "local_identical_sql_other_name": matches,
                "can_remove_remote_record": False, "repair_authorized": False,
            })

    remote_duplicates = []
    for name, versions in sorted(rn.items()):
        if len(versions) <= 1:
            continue
        ordered = sorted(versions, key=lambda x: x["version"])
        hashes = {(x["sha256"], x["bytes"]) for x in ordered}
        local_versions = sorted(ln.get(name, []), key=lambda x: x["version"])
        remote_duplicates.append({
            "name": name, "impact_hint": _risk(name),
            "status": ("HOLD_DUPLICATE_SQL_IDENTICAL" if len(hashes) == 1
                       else "HOLD_DUPLICATE_SQL_DIVERGENT"),
            "remote_versions": [_rec(x) for x in ordered],
            "distinct_remote_content_variants": len(hashes),
            "local_same_name_files": [_rec(x) for x in local_versions],
            "local_version_pairs": [
                {
                    "version": l["version"],
                    "matched_remote_version_and_sql": any(
                        r["version"] == l["version"] and r["sha256"] == l["sha256"]
                        and r["bytes"] == l["bytes"] for r in ordered
                    ),
                } for l in local_versions
            ],
            "repair_authorized": False,
        })

    local_duplicates = []
    for name, versions in sorted(ln.items()):
        if len(versions) <= 1:
            continue
        hashes = {(x["sha256"], x["bytes"]) for x in versions}
        local_duplicates.append({
            "name": name,
            "impact_hint": _risk(name),
            "status": "HOLD_LOCAL_DUPLICATE_IDENTITY",
            "local_versions": [_rec(x) for x in sorted(versions, key=lambda z: z["version"])],
            "distinct_local_content_variants": len(hashes),
            "remote_same_name_versions": [_rec(r) for r in sorted(rn.get(name, []),
                                                                   key=lambda z: z["version"])],
            "repair_authorized": False,
        })

    # No SQL contents, organization rows, tokens or secret values in output.
    counts = Counter({
        "local_only_entries": len(local_only),
        "remote_only_entries": len(remote_only),
        "remote_duplicate_name_groups": len(remote_duplicates),
        "local_duplicate_name_groups": len(local_duplicates),
        "identical_sql_remote_duplicate_groups": sum(
            x["distinct_remote_content_variants"] == 1 for x in remote_duplicates),
        "divergent_sql_remote_duplicate_groups": sum(
            x["distinct_remote_content_variants"] > 1 for x in remote_duplicates),
        "remote_only_byte_matches_differently_named_local_file": sum(
            bool(x["local_identical_sql_other_name"]) for x in remote_only),
        "local_only_byte_matches_differently_named_remote_file": sum(
            bool(x["remote_identical_sql_other_name"]) for x in local_only),
    })
    return {
        "contract": CONTRACT,
        "project_id": EXPECTED_PROJECT,
        "source": "offline git migrations + protected-free production SHA256 snapshot",
        "snapshot_freshness_checked_live": False,
        "note": "Matches in name, version, bytes, object, or SQL hash DO NOT prove safe repairs.",
        "safe_for_automatic_repair": False,
        "history_mutations_allowed": False,
        "repair_commands": [],
        "requires_manual_approval": True,
        "counts": dict(sorted(counts.items())),
        "local_only": local_only,
        "remote_only": remote_only,
        "remote_duplicate_groups": remote_duplicates,
        "local_duplicate_groups": local_duplicates,
        "next_evidence_required": [
            "Repeat fresh live (name/version/SQL SHA256/bytes) readback before any future change",
            "Read current catalog grants/RLS/objects for all security/Network/listino candidates",
            "Document all remote-only predecessor/successor effects and never delete baselines",
            "Resolve divergent PA1.4 duplicate on current trigger and test tenant/claim acceptance",
            "Resolve local RFQH13 divergent duplicate against both remote recorded versions",
            "Clean rebuild M5, SK4.2 and PL1.5 dependency and data invariants",
            "Official linked migration list with existing PostgreSQL password, when available",
            "Separate per-version reviewed and authorized plan with backup and rollback",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--local", type=Path, default=Path("supabase/migrations"))
    parser.add_argument("--remote-hashes", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    header = json.loads(args.remote_hashes.read_text(encoding="utf-8"))
    if header.get("production_project_id") != EXPECTED_PROJECT:
        raise SystemExit("Wrong production project: fail closed")
    doc = analyze(load_local(args.local), load_remote(args.remote_hashes))
    doc["snapshot_observed_on"] = header.get("observed_on")
    doc["generated_at_utc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(doc, indent=2, sort_keys=True) + "\n",
                           encoding="utf-8")
    print(json.dumps(doc["counts"], sort_keys=True))
    print("NO-REPAIR: all historical records retained for review.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
