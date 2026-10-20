"""SUPA-LEDGER3B — prioritize unresolved historical SQL discrepancies.

Zero DB or network access. This is a *local source risk index*, NOT a proof
of whether the stored REMOTE migration has different executable behavior.
Never authorizes automatic migration repair, replay, or db push.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import re

CRITICAL_SIGNALS = {
    "rls": r"\b(?:row\s+level\s+security|create\s+policy|alter\s+policy|drop\s+policy|force\s+row\s+level\s+security|enable\s+row\s+level\s+security)\b",
    "permissions": r"\b(?:grant|revoke)\s+(?:all|select|insert|update|delete|execute|usage|create)\b",
    "security_definer": r"\bsecurity\s+definer\b",
    "identity_auth": r"\b(?:auth\.(?:uid|jwt|users)|platform_user_roles|organization_members|claim(?:s|_requests)?|superadmin)\b",
}
BUSINESS_SIGNALS = {
    "network": r"\b(?:network_companies|network_discovered_companies|company_discovery|netdata1eu_trader|discovery_company)\b",
    "company_data": r"\b(?:companies|company_contacts|contact_person|organizations|facilities)\b",
    "data_writes": r"\b(?:insert\s+into|update\s+[\w.\"]+\s+set|delete\s+from|truncate\s+table)\b",
    "runtime_logic": r"\b(?:create\s+(?:or\s+replace\s+)?function|alter\s+function|drop\s+function|create\s+trigger|execute\s+function)\b",
}
NAME_PATTERN = re.compile(r"^[A-Za-z0-9_]+$")


def prioritize(report: dict, migrations: Path) -> dict:
    if report.get("contract") != "supa-ledger3-divergence-triage-v1":
        raise ValueError("Unknown SQL divergence contract")
    baseline = report.get("baseline_summary", {})
    if report.get("safe_for_automatic_repair") is not False:
        raise ValueError("This evidence cannot authorize migration repair")
    unresolved = [x for x in report.get("divergences", [])
                  if x.get("category") == "substantive_text_divergence_or_comments"]
    if len(unresolved) != report.get("divergence_summary", {}).get(
            "substantive_text_divergence_or_comments"):
        raise ValueError("Unresolved divergence counts do not match")
    rows = []
    seen = set()
    for r in unresolved:
        name, version = r.get("name"), r.get("local_version")
        if (not isinstance(name, str) or not NAME_PATTERN.fullmatch(name)
                or not isinstance(version, str) or not re.fullmatch(r"\d{14}", version)):
            raise ValueError("Invalid migration name or version")
        if (name, version) in seen:
            raise ValueError("Duplicate unresolved migration identity")
        seen.add((name, version))
        file = migrations / (version + "_" + name + ".sql")
        if not file.is_file():
            raise ValueError("Missing local file for unresolved migration: " + name)
        sql = file.read_text(encoding="utf-8")
        signals = [
            key for key, pattern in {**CRITICAL_SIGNALS, **BUSINESS_SIGNALS}.items()
            if re.search(pattern, sql, flags=re.I | re.S)
        ]
        label = ("P0_SECURITY_OR_OWNERSHIP" if any(s in CRITICAL_SIGNALS for s in signals)
                 else "P1_NETWORK_OR_DML" if any(s in BUSINESS_SIGNALS for s in signals)
                 else "P2_GENERAL_SQL_OR_COMMENTS")
        rows.append({
            "name": name,
            "local_version": version,
            "remote_version": r.get("remote_version"),
            "priority": label,
            "local_source_indicators": signals,
            "local_bytes": r.get("local_bytes"),
            "remote_bytes": r.get("remote_bytes"),
            "remote_executable_sql_compared": False,
            "status": "requires_actual_remote_sql_comparison",
        })
    order = {"P0_SECURITY_OR_OWNERSHIP": 0, "P1_NETWORK_OR_DML": 1,
             "P2_GENERAL_SQL_OR_COMMENTS": 2}
    rows.sort(key=lambda r: (order[r["priority"]], r["name"]))
    counters = Counter(row["priority"] for row in rows)
    return {
        "contract": "supa-ledger3b-critical-risk-index-v1",
        "safe_for_automatic_repair": False,
        "warning": ("Signals are identified in the LOCAL SQL text and may appear in "
                    "comments. They are conservative review priorities, NOT proof "
                    "of remote behavioral divergence or safe SQL equivalence."),
        "source_counts": {"local": baseline.get("local_total"),
                          "remote": baseline.get("remote_total"),
                          "unresolved": len(rows)},
        "summary": {
            "P0_SECURITY_OR_OWNERSHIP": counters["P0_SECURITY_OR_OWNERSHIP"],
            "P1_NETWORK_OR_DML": counters["P1_NETWORK_OR_DML"],
            "P2_GENERAL_SQL_OR_COMMENTS": counters["P2_GENERAL_SQL_OR_COMMENTS"],
        },
        "queue": rows,
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--divergence-report", type=Path, required=True)
    p.add_argument("--local", type=Path, default=Path("supabase/migrations"))
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    document = json.loads(args.divergence_report.read_text(encoding="utf-8"))
    output = prioritize(document, args.local)
    output["audited_at_utc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(output["summary"], sort_keys=True))
    print("Top 25 local-source risk-priority cases (not semantic equivalence):")
    for row in output["queue"][:25]:
        print(f"{row['priority']} {row['name']} "
              f"({row['local_version']} vs {row['remote_version']}) "
              f"[{','.join(row['local_source_indicators']) or 'none'}]")
    print("No repair, db push, company verification or publication is authorized.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
