"""Resolve the first sanitized strict rebuild failure against immutable original SQL metadata.

This is provenance mapping only: never copies historical SQL, creates migrations,
or makes a schema/history change. Historical create != permission to replay.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re

CONTRACT = "supa-ledger5e-first-missing-relation-v1"


def resolve(diag: dict, manifest: dict, migration_sql: str = "") -> dict:
    missing = diag.get("missing_object")
    failed_migration = diag.get("last_migration")
    if missing is not None and not re.fullmatch(
        r"(?:public|staging|private)\.[a-z_][a-z_0-9]*", missing
    ):
        raise ValueError("Unsafe object identifier; refuse provenance mapping")
    if failed_migration is not None and not re.fullmatch(
        r"\d{14}_[a-zA-Z0-9_]+\.sql", failed_migration
    ):
        raise ValueError("Unsafe migration filename; refuse provenance mapping")
    matches = sorted(
        (
            {"name": x["name"], "version": x["version"],
             "sql_sha256": x["sql_sha256"],
             "contains_rls": x.get("adds_rls", False),
             "contains_policies": x.get("creates_policies", False),
             "contains_grants": x.get("contains_grants", False)}
            for x in manifest["applied_migrations"]
            if missing is not None and missing in x["creates_tables"]
        ),
        key=lambda x: x["version"],
    )
    local_version = failed_migration[:14] if failed_migration else None
    safe_order = bool(
        local_version and matches and matches[0]["version"] < local_version
    )
    return {
        "contract": CONTRACT,
        "project_id": manifest["project_ref"],
        "strict_rebuild_passed": diag.get("strict_rebuild_passed", False),
        "missing_object": missing,
        "failing_local_migration": failed_migration,
        "missing_object_referenced_in_local_sql": (
            missing in migration_sql.lower() if missing is not None else False
        ),
        "original_remote_creators": matches,
        "original_creator_precedes_local_consumer": safe_order,
        "original_sql_source_and_dependency_identified": (
            bool(matches) and safe_order
        ),
        "strict_rebuild_recovered": False,
        "future_baseline_replay_authorized": False,
        "history_mutations_allowed": False,
        "repair_commands": [],
        "note": ("Historical SQL fingerprints establish a provenance candidate only. "
                 "Restore full preceding ACL/RLS/table dependencies in separately "
                 "reviewed test-only migration chain before suggesting any production change."),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--migrations", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    diagnostic = json.loads(args.strict.read_text(encoding="utf-8"))
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    migration = diagnostic.get("last_migration")
    local_sql = ""
    if migration:
        # Regex-validated basename only, within repo migrations directory.
        if not re.fullmatch(r"\d{14}_[a-zA-Z0-9_]+\.sql", migration):
            raise SystemExit("Unsafe migration name from diagnostic")
        path = args.migrations / migration
        if path.is_file():
            local_sql = path.read_text(encoding="utf-8").lower()
    report = resolve(diagnostic, manifest, local_sql)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n",
                           encoding="utf-8")
    print(json.dumps({
        "missing_object": report["missing_object"],
        "failed_migration": report["failing_local_migration"],
        "original_creator_versions": [x["version"] for x in report["original_remote_creators"]],
        "origin_identified": report["original_sql_source_and_dependency_identified"],
        "automatic_repair": False,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
