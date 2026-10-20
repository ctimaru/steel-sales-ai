"""SUPA-LEDGER2: read-only *byte-exact* migration SQL fingerprint comparison.

Never uses remote credentials, changes SQL, or proposes automatic migration repair.
The remote audit input contains SHA256 and byte sizes only, NOT migration SQL.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re

PATTERN = re.compile(r"^(?P<version>[0-9]{14})_(?P<name>[A-Za-z0-9_]+)\.sql$")
SHA = re.compile(r"^[0-9a-f]{64}$")
EXPECTED_CONTRACT = "supa-ledger2-sql-sha256-v1"


def load_local(folder: Path) -> list[dict]:
    if not folder.is_dir():
        raise ValueError("Missing local migration directory")
    result = []
    for path in sorted(folder.glob("*.sql")):
        match = PATTERN.fullmatch(path.name)
        if match is None:
            raise ValueError("Invalid migration filename " + path.name)
        data = path.read_bytes()
        result.append({**match.groupdict(), "sha256": sha256(data).hexdigest(),
                       "bytes": len(data)})
    if not result:
        raise ValueError("No local migration files")
    return result


def load_remote(path: Path) -> list[dict]:
    document = json.loads(path.read_text(encoding="utf-8"))
    if document.get("contract") != EXPECTED_CONTRACT:
        raise ValueError("Unknown SQL fingerprint input")
    raw = document.get("migrations")
    if not isinstance(raw, list) or len(raw) == 0:
        raise ValueError("Empty remote migration fingerprint index")
    records = []
    for item in raw:
        if not isinstance(item, dict):
            raise ValueError("Malformed remote entry")
        name, version, fingerprint, size = (
            item.get("name"), item.get("version"), item.get("sha256"), item.get("bytes")
        )
        if (not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_]+", name)
            or not isinstance(version, str) or not re.fullmatch(r"[0-9]{14}", version)
            or not isinstance(fingerprint, str) or not SHA.fullmatch(fingerprint)
            or not isinstance(size, int) or isinstance(size, bool) or size < 0):
            raise ValueError("Invalid remote SQL fingerprint field")
        records.append({"name": name, "version": version, "sha256": fingerprint,
                        "bytes": size})
    return records


def classify(local: list[dict], remote: list[dict]) -> dict:
    local_by_name: dict[str, list[dict]] = defaultdict(list)
    remote_by_name: dict[str, list[dict]] = defaultdict(list)
    remote_by_version: dict[str, list[dict]] = defaultdict(list)
    for row in local:
        local_by_name[row["name"]].append(row)
    for row in remote:
        remote_by_name[row["name"]].append(row)
        remote_by_version[row["version"]].append(row)

    candidates: list[dict] = []
    category_counts: Counter = Counter()
    for item in local:
        group = remote_by_name.get(item["name"], [])
        matched_sql = [r for r in group
                       if r["sha256"] == item["sha256"] and r["bytes"] == item["bytes"]]
        exact = [r for r in matched_sql if r["version"] == item["version"]]
        if len(group) > 1 or len(local_by_name[item["name"]]) > 1:
            kind = "ambiguous_duplicate_name"
        elif len(exact) == 1:
            kind = "exact_version_and_sql"
        elif len(matched_sql) == 1:
            kind = "identical_sql_different_version"
        elif group:
            kind = "different_sql_same_name"
        else:
            kind = "only_in_local"
        version_collision = [
            r for r in remote_by_version.get(item["version"], [])
            if r["name"] != item["name"]
        ]
        category_counts[kind] += 1
        candidates.append({
            "name": item["name"], "local_version": item["version"],
            "category": kind, "local_bytes": item["bytes"],
            "matching_remote_versions": [r["version"] for r in matched_sql],
            "same_name_remote_versions": [r["version"] for r in group],
            "remote_version_name_collisions": [r["name"] for r in version_collision],
            "content_hash": item["sha256"],
        })
    remote_only = [
        {"name": r["name"], "remote_version": r["version"],
         "remote_bytes": r["bytes"], "sql_sha256": r["sha256"]}
        for r in remote if r["name"] not in local_by_name
    ]
    duplicate_names = {
        "local": {k: [x["version"] for x in v]
                  for k, v in local_by_name.items() if len(v) > 1},
        "remote": {k: [x["version"] for x in v]
                   for k, v in remote_by_name.items() if len(v) > 1}
    }
    summary = {
        "local_total": len(local), "remote_total": len(remote),
        "exact_version_and_sql": category_counts["exact_version_and_sql"],
        "identical_sql_different_version": category_counts["identical_sql_different_version"],
        "different_sql_same_name": category_counts["different_sql_same_name"],
        "only_in_local": category_counts["only_in_local"],
        "ambiguous_duplicate_name": category_counts["ambiguous_duplicate_name"],
        "only_in_remote": len(remote_only),
        "remote_duplicate_names": len(duplicate_names["remote"]),
        "local_duplicate_names": len(duplicate_names["local"]),
    }
    return {
        "contract": "supa-ledger2-sql-equivalence-report-v1",
        "warning": ("Byte-exact SQL history match establishes submitted SQL contents only. "
                    "Does NOT establish current schema state, migration ordering or "
                    "authorization to rewrite the remote migration history."),
        "safe_for_automatic_repair": False,
        "summary": summary,
        "local_classifications": candidates,
        "remote_only": remote_only,
        "duplicate_names": duplicate_names,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--local", type=Path, default=Path("supabase/migrations"))
    parser.add_argument("--remote-hashes", required=True, type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--require-seven-trader-matches", action="store_true")
    args = parser.parse_args()
    result = classify(load_local(args.local), load_remote(args.remote_hashes))
    if args.require_seven_trader_matches:
        names = {
            "netdata1eu_trader1a_research_foundation",
            "netdata1eu_trader1b_firstparty_pilot",
            "netdata1eu_trader1b2_source_research",
            "netdata1eu_trader1c1_source_research",
            "netdata1eu_trader1c2_source_research",
            "netdata1eu_trader1d_review_readiness",
            "trader1d2_superadmin_review_console",
        }
        hits = [row for row in result["local_classifications"]
                if row["name"] in names and
                row["category"] == "identical_sql_different_version"]
        if len(hits) != 7:
            raise SystemExit("TRADER1 EU evidence mismatch: abort")
    result["audited_at_utc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    result["remote_snapshot"] = args.remote_hashes.name
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n",
                               encoding="utf-8")
    print(json.dumps(result["summary"], sort_keys=True))
    print("Never perform migration repair solely from this classifier.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
