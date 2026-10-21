"""SUPA-LEDGER5F: verify private historical SQL and prepare disposable replay.

The production SQL itself must be obtained through an independently authorized,
private source directory. NEVER commit the SQL, migration literals, or passwords.

This tool never connects to Supabase or modifies production. It verifies source
original-SQL fingerprints *before* optionally making a throwaway candidate tree.
One historical operational INSERT creating an archive import token is omitted
from the candidate with an explicit, documented non-equivalence marker.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile

PROJECT = "ecrafjdummcdfycznitx"
CONTRACT = "supa-ledger5f-private-replay-preparation-v1"
EXCLUDED_DML_VERSION = "20260907173731"
EXCLUDED_DML_NAME = "add_one_time_archive_import_tokens"
EXCLUDED_DML_PREFIX_SHA = (
    "5384d510f0216d9b95d94028c0a0e35fb7add2dd7adc05d48a77e108b5a078fe"
)
DML_MARKER = re.compile(r"\binsert\s+into\s+staging\.archive_import_tokens\b", re.I)
SAFE_FILENAME = re.compile(r"^[0-9]{14}_[a-z][a-z0-9_]+\.sql$")
STORED_CREDENTIAL = re.compile(
    rb"(?:sk_live_|sb_secret_|(?:postgres|postgresql)://|"
    rb"(?i:password|secret|access_token)\s*[:=]\s*['\"][^\n'\"]{12,})"
)


def manifest_index(manifest: dict, snapshot: dict) -> list[dict]:
    if manifest.get("project_ref") != PROJECT or snapshot.get("production_project_id") != PROJECT:
        raise ValueError("Wrong provenance project")
    expected = {
        (str(x["version"]), x["name"]): (x["sha256"], x["bytes"])
        for x in snapshot["migrations"]
    }
    originals = manifest["applied_migrations"]
    if len(originals) != 20:
        raise ValueError("Exactly 20 original predecessors required")
    versions = [str(x["version"]) for x in originals]
    if versions != sorted(set(versions)):
        raise ValueError("Predecessors must be sorted, unique timestamps")
    for x in originals:
        identity = (str(x["version"]), x["name"])
        if expected.get(identity) != (x["sql_sha256"], x["sql_bytes"]):
            raise ValueError("Original ledger fingerprint disagrees with frozen snapshot")
    return originals


def inspect_private_sources(
    source_dir: Path, manifest: dict, snapshot: dict,
) -> list[dict]:
    """No bytes are printed, uploaded or returned; only verified identities."""
    originals = manifest_index(manifest, snapshot)
    verified = []
    for x in originals:
        basename = f'{x["version"]}_{x["name"]}.sql'
        if SAFE_FILENAME.fullmatch(basename) is None:
            raise ValueError("Unsafe historical migration filename")
        target = source_dir / basename
        if not target.is_file() or target.is_symlink():
            raise FileNotFoundError("Private source is missing or a symlink: " + basename)
        content = target.read_bytes()
        sha = hashlib.sha256(content).hexdigest()
        if len(content) != x["sql_bytes"] or sha != x["sql_sha256"]:
            raise ValueError("Historical SQL checksum mismatch: " + basename)
        if STORED_CREDENTIAL.search(content):
            raise ValueError("Potential credential in private SQL: " + basename)
        if x["version"] == EXCLUDED_DML_VERSION:
            if x["name"] != EXCLUDED_DML_NAME:
                raise ValueError("Unexpected token-issuing migration identity")
            match = DML_MARKER.search(content.decode("utf-8"))
            if match is None or len(DML_MARKER.findall(content.decode("utf-8"))) != 1:
                raise ValueError("Unrecognized operational token DML, refuse replay")
            prefix = content[:len(content.decode("utf-8")[:match.start()].encode("utf-8"))]
            if hashlib.sha256(prefix).hexdigest() != EXCLUDED_DML_PREFIX_SHA:
                raise ValueError("Token SQL preamble changed; cannot sanitize")
            if not prefix.strip().lower().endswith(b"authenticated;"):
                raise ValueError("Unknown token SQL preamble ending")
            content = prefix + (
                b"\n-- SUPA-LEDGER5F: historical token INSERT deliberately omitted"
                b" in disposable schema-only test.\n"
            )
        verified.append({"version": x["version"], "name": x["name"],
                         "original_sha256": sha, "candidate_sql": content,
                         "dml_sanitized": x["version"] == EXCLUDED_DML_VERSION})
    return verified


def prepare_candidate(
    source_dir: Path, project_supabase_dir: Path, out_dir: Path,
    manifest: dict, snapshot: dict,
) -> dict:
    verified = inspect_private_sources(source_dir, manifest, snapshot)
    out_dir = out_dir.resolve()
    current_root = project_supabase_dir.resolve()
    if out_dir == current_root or current_root in out_dir.parents:
        raise ValueError("Refuse to write candidate inside checked-in Supabase directory")
    if out_dir.exists():
        raise ValueError("Output directory must not already exist")
    if (current_root / ".temp" / "project-ref").exists():
        raise ValueError("Linked Supabase project detected; refusing candidate")
    source_migrations = current_root / "migrations"
    local = sorted(source_migrations.glob("*.sql"))
    historical = {r["version"] for r in verified}
    existing_versions = {p.name[:14] for p in local}
    if historical & existing_versions:
        raise ValueError("Original/checked-in version collision; refuse preparation")
    if not local:
        raise ValueError("No checked-in migrations available")
    if max(historical) >= min(existing_versions):
        raise ValueError("Historical predecessors not older than local migrations")

    # Create an isolated supabase tree, not a repository schema mutation.
    migration_root = out_dir / "supabase" / "migrations"
    migration_root.mkdir(parents=True)
    shutil.copy2(current_root / "config.toml", out_dir / "supabase" / "config.toml")
    for x in local:
        shutil.copy2(x, migration_root / x.name)
    for x in verified:
        filename = f'{x["version"]}_{x["name"]}.sql'
        (migration_root / filename).write_bytes(x["candidate_sql"])
    return {
        "contract": CONTRACT,
        "production_project_id": PROJECT,
        "candidate_type": "source_verified_sanitized_schema_replay",
        "original_sources_verified": len(verified),
        "local_migration_files": len(local),
        "original_schema_source_files_injected": len(verified),
        "historical_data_migrations_sanitized": [EXCLUDED_DML_NAME],
        "fully_byte_identical_historical_execution": False,
        "final_schema_equivalence_verified": False,
        "strict_repo_only_rebuild_fixed": False,
        "history_mutations_allowed": False,
        "release_authorized": False,
        "production_accessed": False,
        "no_raw_sql_in_report": True,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path,
                        default=Path("supabase/audits/supa_ledger5e_original_baseline_provenance.json"))
    parser.add_argument("--snapshot", type=Path,
                        default=Path("supabase/audits/20261021_migration_content_fingerprints.json"))
    parser.add_argument("--private-source-dir", type=Path, required=True)
    parser.add_argument("--supabase-dir", type=Path, default=Path("supabase"))
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    snapshot = json.loads(args.snapshot.read_text(encoding="utf-8"))
    report = prepare_candidate(args.private_source_dir, args.supabase_dir,
                               args.out_dir, manifest, snapshot)
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({k: report[k] for k in
          ("original_sources_verified", "local_migration_files",
           "historical_data_migrations_sanitized", "release_authorized")},
                     sort_keys=True))


if __name__ == "__main__":
    main()
