"""Offline chain-of-custody for 20 production-only September foundation records.

Metadata-only: historical hashes, DDL object identifiers and CI approximations.
No production access, secret material, data rows, DDL or history repair.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re

EXPECTED_PROJECT = "ecrafjdummcdfycznitx"
CONTRACT = "supa-ledger5e-baseline-chain-of-custody-v1"

CREATE_TABLE = re.compile(
    r'\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?'
    r'((?:public|staging|private)\.[a-z][a-z0-9_]*)', re.IGNORECASE,
)


def inspect(manifest: dict, snapshot: dict, baseline_sql: list[str],
            local_filenames: list[str]) -> dict:
    assert manifest["project_ref"] == EXPECTED_PROJECT, "Wrong manifest project"
    assert snapshot["production_project_id"] == EXPECTED_PROJECT, "Wrong snapshot project"
    all_rows = {
        (r["version"], r["name"]): (r["sha256"], r["bytes"])
        for r in snapshot["migrations"]
    }
    first = manifest["applied_migrations"]
    original_match = all(
        all_rows.get((r["version"], r["name"])) ==
        (r["sql_sha256"], r["sql_bytes"])
        for r in first
    )
    baseline_tables = sorted(set(
        m.group(1).lower()
        for sql in baseline_sql for m in CREATE_TABLE.finditer(sql)
    ))
    original_created = sorted(set(
        table for entry in first for table in entry["creates_tables"]
    ))
    omitted = sorted(set(original_created) - set(baseline_tables))
    local_versions = sorted(
        name[:14] for name in local_filenames if re.fullmatch(
            r'\d{14}_[a-zA-Z0-9_]+\.sql', name
        )
    )
    first_local = local_versions[0] if local_versions else None
    last_remote = first[-1]["version"] if first else None
    return {
        "contract": CONTRACT,
        "project_id": EXPECTED_PROJECT,
        "original_sql_hashes_match_snapshot": original_match,
        "historical_foundations_before_first_local":
            bool(first_local and last_remote and last_remote < first_local),
        "first_local_version": first_local,
        "last_early_remote_version": last_remote,
        "production_only_foundation_records": len(first),
        "historical_created_table_identifiers": len(original_created),
        "ci_reconstructed_table_identifiers": len(baseline_tables),
        "historical_table_names_not_created_by_ci_baselines": omitted,
        "note": ("Historical table creation does not prove current existence. "
                 "Some objects were intentionally dropped. "
                 "Only original SQL hashes, not full SQL bodies, are archived."),
        "self_contained_migrations_proven": False,
        "repair_commands": [],
        "history_mutations_allowed": False,
        "authorized_for_production": False,
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", type=Path, required=True)
    p.add_argument("--snapshot", type=Path, required=True)
    p.add_argument("--migrations", type=Path, required=True)
    p.add_argument("--ci-foundation", type=Path, nargs=2, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    report = inspect(
        json.loads(args.manifest.read_text(encoding="utf-8")),
        json.loads(args.snapshot.read_text(encoding="utf-8")),
        [p.read_text(encoding="utf-8") for p in args.ci_foundation],
        [p.name for p in args.migrations.glob("*.sql")],
    )
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({
        "original_sql_hashes_match_snapshot":
            report["original_sql_hashes_match_snapshot"],
        "foundations_before_first_local":
            report["historical_foundations_before_first_local"],
        "historical_table_identifiers":
            report["historical_created_table_identifiers"],
        "ci_table_identifiers":
            report["ci_reconstructed_table_identifiers"],
        "release_authorized": False,
    }, sort_keys=True))
    if (not report["original_sql_hashes_match_snapshot"]
        or not report["historical_foundations_before_first_local"]):
        raise SystemExit("Historical provenance manifest changed: fail closed")


if __name__ == "__main__":
    main()
