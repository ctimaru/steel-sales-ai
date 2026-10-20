"""SUPA-LEDGER3 — conservative, read-only migration SQL divergence triage.

Source files are hashed locally. Remote data is a read-only fingerprint snapshot
from original applied SQL, not a remote connection. No automatic repair decisions.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re

from migration_sql_fingerprint_audit import (
    classify as baseline_classify,
    load_local,
    load_remote,
)

CONTRACT = "supa-ledger3-normalized-sql-sha256-v1"
SHA = re.compile(r"^[0-9a-f]{64}$")
WS = re.compile(r"[ \t\n]+")


def signatures(raw: bytes) -> dict[str, str]:
    # Migration files must be UTF-8. Reconstruct the exact SAME three
    # transformations performed by PostgreSQL in the read-only snapshot.
    data = raw.decode("utf-8")
    lf = data.replace("\r\n", "\n").replace("\r", "\n")
    edge = lf.strip(" \t\n")
    collapsed = WS.sub(" ", lf)
    digest = lambda s: sha256(s.encode("utf-8")).hexdigest()
    return {
        "lf_sha256": digest(lf),
        "edge_trim_sha256": digest(edge),
        "whitespace_collapse_sha256": digest(collapsed),
        "lf_bytes": len(lf.encode("utf-8")),
    }


def read_normalized_snapshot(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("contract") != CONTRACT:
        raise ValueError("Unknown normalized SQL fingerprint contract")
    rows = data.get("migrations")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Empty normalized SQL fingerprint snapshot")
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Malformed normalized SQL migration fingerprint")
        version, name = row.get("version"), row.get("name")
        if (not isinstance(version, str) or not re.fullmatch(r"[0-9]{14}", version)
            or not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_]+", name)):
            raise ValueError("Invalid SQL fingerprint identity")
        if version in seen:
            raise ValueError("Duplicate remote migration version")
        seen.add(version)
        for key in ("lf_sha256", "edge_trim_sha256", "whitespace_collapse_sha256"):
            if not isinstance(row.get(key), str) or not SHA.fullmatch(row[key]):
                raise ValueError("Invalid normalized SHA-256")
        if not isinstance(row.get("lf_bytes"), int) or row["lf_bytes"] < 0:
            raise ValueError("Invalid SQL bytes")
    return rows


def classify(directory: Path, raw_snapshot: Path, normalized_snapshot: Path) -> dict:
    local = load_local(directory)
    original_remote = load_remote(raw_snapshot)
    normalized_remote = read_normalized_snapshot(normalized_snapshot)
    raw_by_version = {r["version"]: r for r in original_remote}
    normalized_by_version = {r["version"]: r for r in normalized_remote}
    if (len(raw_by_version) != len(original_remote)
        or set(raw_by_version) != set(normalized_by_version)
        or any(raw_by_version[k]["name"] != normalized_by_version[k]["name"]
               for k in raw_by_version)):
        raise ValueError("Original and normalized remote snapshots disagree")
    baseline = baseline_classify(local, original_remote)
    indexes = {r["name"]: r for r in baseline["local_classifications"]}
    observations = []
    risk_summary = {
        "line_endings_only": 0,
        "outer_whitespace_only": 0,
        "global_whitespace_candidate_UNSAFE": 0,
        "substantive_text_divergence_or_comments": 0,
    }
    for row in local:
        base = indexes[row["name"]]
        # Local duplicate migration names are separately ambiguous.
        if base["category"] != "different_sql_same_name":
            continue
        matches = base["same_name_remote_versions"]
        if len(matches) != 1:
            raise ValueError("A duplicate name was marked unambiguous")
        remote = normalized_by_version[matches[0]]
        sql_file = directory / f'{row["version"]}_{row["name"]}.sql'
        local_sigs = signatures(sql_file.read_bytes())
        if local_sigs["lf_sha256"] == remote["lf_sha256"]:
            category = "line_endings_only"
        elif local_sigs["edge_trim_sha256"] == remote["edge_trim_sha256"]:
            category = "outer_whitespace_only"
        elif local_sigs["whitespace_collapse_sha256"] == remote["whitespace_collapse_sha256"]:
            category = "global_whitespace_candidate_UNSAFE"
        else:
            category = "substantive_text_divergence_or_comments"
        risk_summary[category] += 1
        observations.append({
            "name": row["name"],
            "local_version": row["version"],
            "remote_version": matches[0],
            "category": category,
            "local_bytes": row["bytes"],
            "remote_bytes": raw_by_version[matches[0]]["bytes"],
            "same_sql_bytes": False,
            "automatically_equivalent": False,
            # Even exact global-whitespace collapsing does NOT prove SQL
            # equivalence: quoted strings, dollar-quoted functions and comments.
            "warning": "No automatic repair or semantic equivalence inferred",
        })
    if sum(risk_summary.values()) != baseline["summary"]["different_sql_same_name"]:
        raise ValueError("Divergence audit did not classify each conflicting SQL pair")
    return {
        "contract": "supa-ledger3-divergence-triage-v1",
        "safe_for_automatic_repair": False,
        "risk_warning": (
            "No raw SQL exported. Global whitespace equivalence is a "
            "diagnostic CANDIDATE only and may alter literals, comments, or "
            "dollar-quoted definitions. Byte equality cannot establish "
            "current schema equivalence."
        ),
        "baseline_summary": baseline["summary"],
        "divergence_summary": risk_summary,
        "divergences": observations,
        "unresolved_remote_only": baseline["remote_only"],
        "duplicate_names": baseline["duplicate_names"],
        "other_local_classifications": [
            {"name": r["name"], "category": r["category"],
             "local_version": r["local_version"],
             "remote_versions": r["same_name_remote_versions"]}
            for r in baseline["local_classifications"]
            if r["category"] in ("only_in_local", "ambiguous_duplicate_name")
        ],
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--local", type=Path, default=Path("supabase/migrations"))
    p.add_argument("--raw-remote", type=Path, required=True)
    p.add_argument("--normalized-remote", type=Path, required=True)
    p.add_argument("--report", type=Path)
    args = p.parse_args()
    result = classify(args.local, args.raw_remote, args.normalized_remote)
    result["audited_at_utc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n",
                               encoding="utf-8")
    print(json.dumps(result["divergence_summary"], sort_keys=True))
    print("Read-only divergence triage; NONE automatically repairable.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
