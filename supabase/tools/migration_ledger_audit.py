"""SUPA-LEDGER1 — read-only migration-history drift classification.

NEVER writes a database, runs migration repair, or executes a SQL migration.
Remote input is an explicit dated snapshot exported from Supabase list_migrations.
Use Supabase CLI 'migration list --linked' for fresh operational confirmation.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path
import re


FILE_PATTERN = re.compile(r"^(?P<version>\d{14})_(?P<name>[a-zA-Z0-9_]+)\.sql$")


def read_local(directory: Path) -> list[dict[str, str]]:
    if not directory.is_dir():
        raise ValueError("Missing GitHub migration directory")
    records = []
    for file in sorted(directory.iterdir()):
        if file.suffix != ".sql":
            continue
        match = FILE_PATTERN.fullmatch(file.name)
        if not match:
            raise ValueError("Migration without valid 14-digit version: " + file.name)
        records.append(match.groupdict())
    return records


def read_remote(path: Path) -> list[dict[str, str]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("migrations"), list):
        raise ValueError("Expected Supabase list_migrations JSON with migrations")
    records = payload["migrations"]
    if not records:
        raise ValueError("No remote migrations; refusing ungrounded audit")
    for row in records:
        if (not isinstance(row, dict) or
            not isinstance(row.get("version"), str) or
            not re.fullmatch(r"\d{14}", row["version"]) or
            not isinstance(row.get("name"), str) or
            not re.fullmatch("[a-zA-Z0-9_]+", row["name"])):
            raise ValueError("Malformed remote migration")
    return [{"version": item["version"], "name": item["name"]} for item in records]


def classify(local: list[dict[str, str]], remote: list[dict[str, str]]) -> dict:
    by_local_name: dict[str, list[str]] = defaultdict(list)
    by_remote_name: dict[str, list[str]] = defaultdict(list)
    by_local_version: dict[str, list[str]] = defaultdict(list)
    by_remote_version: dict[str, list[str]] = defaultdict(list)
    for item in local:
        by_local_name[item["name"]].append(item["version"])
        by_local_version[item["version"]].append(item["name"])
    for item in remote:
        by_remote_name[item["name"]].append(item["version"])
        by_remote_version[item["version"]].append(item["name"])

    matched, mismatch, local_only = [], [], []
    for item in local:
        versions = by_remote_name.get(item["name"])
        if versions is None:
            local_only.append(item)
        elif item["version"] in versions:
            matched.append(item)
        else:
            mismatch.append({
                "name": item["name"], "local_version": item["version"],
                "remote_versions": sorted(versions)
            })
    remote_only = [row for row in remote if row["name"] not in by_local_name]
    duplicates = {
        "local_names": {k: sorted(v) for k,v in by_local_name.items() if len(v)>1},
        "remote_names": {k: sorted(v) for k,v in by_remote_name.items() if len(v)>1},
        "local_versions": {k: sorted(v) for k,v in by_local_version.items() if len(v)>1},
        "remote_versions": {k: sorted(v) for k,v in by_remote_version.items() if len(v)>1},
    }
    # A migration name is not a content checksum or proof that the same SQL
    # has run. "matched" means matching version and name only.
    summary = {
        "local_files": len(local), "remote_entries": len(remote),
        "exact_name_version": len(matched),
        "same_name_version_mismatch": len(mismatch),
        "local_only": len(local_only), "remote_only": len(remote_only),
        "remote_duplicate_names": len(duplicates["remote_names"]),
        "local_duplicate_names": len(duplicates["local_names"]),
        "remote_duplicate_versions": len(duplicates["remote_versions"]),
        "local_duplicate_versions": len(duplicates["local_versions"]),
    }
    clean = not (
        mismatch or local_only or remote_only or any(duplicates.values())
    ) and len(local)==len(remote)
    return {
        "contract": "supa-ledger1-drift-audit-v1",
        "clean": clean,
        "warning": ("Metadata-only comparison. Do NOT auto-repair, db push, "
                    "or infer SQL equivalence from matching names."),
        "summary": summary,
        "exact_name_version": matched,
        "same_name_version_mismatch": mismatch,
        "local_only": local_only,
        "remote_only": remote_only,
        "duplicates": duplicates,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare local migration names/versions to a read-only Supabase snapshot")
    parser.add_argument("--local", type=Path, default=Path("supabase/migrations"))
    parser.add_argument("--remote", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--require-clean", action="store_true",
                        help="Exit 2 for any drift (never modifies anything)")
    args = parser.parse_args()
    result = classify(read_local(args.local), read_remote(args.remote))
    result["snapshot_file"] = args.remote.name
    result["audited_at_utc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2, sort_keys=True)+"\n", encoding="utf-8")
    print(json.dumps({"clean": result["clean"], **result["summary"],
                      "snapshot": result["snapshot_file"]}, sort_keys=True))
    return 2 if args.require_clean and not result["clean"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
