"""SUPA-LEDGER5D: test real repo-only Supabase replay, without baseline injection.

Runs only on ephemeral CI runners, no --linked/--project-ref and no remote DB.
The outcome is diagnostic and ALWAYS fails closed. A blocked replay is a valid
audit result, NOT proof that the application can be released.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess

CONTRACT = "supa-ledger5d-strict-rebuild-probe-v1"

# Do not store raw CLI stdout: it may contain SQL contents or environment data.
ERROR_PATTERNS = [
    (re.compile(r'relation ["\x27]?([a-z_][\w.]+)["\x27]? does not exist', re.I), "missing_relation"),
    (re.compile(r'type ["\x27]?([a-z_][\w.]+)["\x27]? does not exist', re.I), "missing_type"),
    (re.compile(r'function [\w.() ,]+ does not exist', re.I), "missing_function"),
    (re.compile(r'permission denied', re.I), "permission_denied"),
    (re.compile(r'failed to apply migration', re.I), "migration_apply_failure"),
    (re.compile(r'failed to start', re.I), "local_start_failure"),
]


def classify_failure(output: str) -> str:
    for pattern, label in ERROR_PATTERNS:
        if pattern.search(output):
            return label
    return "unclassified_failure"


# Only schema object identifiers / migration file basenames can leave the CI runner.
# No raw SQL, log lines, connection strings or error messages are persisted.
OBJECT_ERROR_RE = re.compile(
    r'(?:relation|table|type|schema)\\s+["\\x27]?([a-z_][a-z_0-9.]*)["\\x27]?\\s+does not exist',
    re.IGNORECASE,
)
MIGRATION_TRACE_RE = re.compile(
    r'(?:applying migration|failed to apply migration)\\s+([0-9]{14}_[a-zA-Z0-9_]+\\.sql)',
    re.IGNORECASE,
)


def sanitized_dependency(output: str) -> dict[str, str | None]:
    objects = OBJECT_ERROR_RE.findall(output)
    migrations = MIGRATION_TRACE_RE.findall(output)
    return {
        "missing_object": objects[-1].lower()[:128] if objects else None,
        "last_migration": migrations[-1][:180] if migrations else None,
    }


def command(args: list[str], timeout: int) -> tuple[bool, str, str]:
    try:
        result = subprocess.run(
            args, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            timeout=timeout, check=False,
        )
        return result.returncode == 0, result.stdout or "", "completed"
    except subprocess.TimeoutExpired as exc:
        partial = exc.stdout or b""
        if isinstance(partial, bytes):
            partial = partial.decode("utf-8", errors="replace")
        return False, partial, "timeout"


def assess(*, start_ok: bool, reset_ok: bool, failure: str | None) -> dict:
    return {
        "contract": CONTRACT,
        "mode": "strict_repository_only_no_ci_baselines",
        "production_touched": False,
        "migration_history_repair_authorized": False,
        "automatic_release_authorized": False,
        "strict_rebuild_passed": bool(start_ok and reset_ok),
        "start_succeeded": start_ok,
        "reset_succeeded": reset_ok,
        "blocker_category": None if start_ok and reset_ok else (failure or "unknown"),
        "raw_migration_sql_stored": False,
        "next_gate": (
            "Independently compare full remote-only foundation provenance; do not "
            "mark this green unless a no-helper reset actually succeeds."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--start-timeout", type=int, default=240)
    parser.add_argument("--reset-timeout", type=int, default=240)
    options = parser.parse_args()

    # The runner must be disposable and never have a linked Supabase project.
    if not Path("supabase/config.toml").is_file():
        raise SystemExit("Missing local config: strict probe not started")
    if Path("supabase/.temp/project-ref").exists():
        raise SystemExit("Linked Supabase project detected: refusing probe")
    start_ok = reset_ok = False
    failure = None
    dependency = {"missing_object": None, "last_migration": None}
    try:
        start_ok, output, state = command(["supabase", "start"], options.start_timeout)
        if not start_ok:
            failure = "start_timeout" if state == "timeout" else classify_failure(output)
            dependency = sanitized_dependency(output)
        else:
            reset_ok, output, state = command(
                ["supabase", "db", "reset", "--local"], options.reset_timeout
            )
            if not reset_ok:
                failure = "reset_timeout" if state == "timeout" else classify_failure(output)
                dependency = sanitized_dependency(output)
    finally:
        # All operations restricted to the LOCAL Docker stack. Avoid persisting
        # a partially initialized local database into assisted acceptance.
        command(["supabase", "stop", "--no-backup"], 120)

    result = assess(start_ok=start_ok, reset_ok=reset_ok, failure=failure)
    result.update(dependency)
    result["diagnostic_contract"] = "supa-ledger5e-sanitized-first-dependency-v1"
    result["executed_utc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    options.output.parent.mkdir(parents=True, exist_ok=True)
    options.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps({
        "strict_rebuild_passed": result["strict_rebuild_passed"],
        "blocker_category": result["blocker_category"],
        "missing_object": result["missing_object"],
        "last_migration": result["last_migration"],
        "production_touched": False,
        "automatic_release_authorized": False,
    }, sort_keys=True))
    # Non-success is evidence. The gated CI must still run full assisted tests.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
