"""Opt-in SUPA-LEDGER5F historical source replay in a throwaway local stack.

Only run on an explicitly authorized machine with local Docker and a PRIVATE
folder of original migrations; the files are *never* copied into the repository,
printed, uploaded or applied to production. This is NOT automatic CI.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

from prepare_original_foundation_candidate import prepare_candidate
from strict_rebuild_probe import classify_failure, sanitized_dependency


def run_local(argv: list[str], *, cwd: Path, timeout: int) -> tuple[bool,str,str]:
    safe_env = dict(os.environ)
    for key in (
        "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD",
        "DATABASE_URL", "SUPABASE_PROJECT_REF", "POSTGRES_PASSWORD",
        "PGPASSWORD", "SUPABASE_SERVICE_ROLE_KEY",
    ):
        safe_env.pop(key, None)
    try:
        result=subprocess.run(
            argv,cwd=cwd,env=safe_env,timeout=timeout,
            stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,check=False,
        )
    except subprocess.TimeoutExpired:
        return False,"","timeout"
    return result.returncode==0,result.stdout or "","completed"


def main() -> None:
    p=argparse.ArgumentParser()
    p.add_argument("--private-source-dir",required=True,type=Path)
    p.add_argument("--report",required=True,type=Path)
    p.add_argument("--confirm-disposable-local-only",action="store_true")
    p.add_argument("--timeout",type=int,default=240)
    opts=p.parse_args()
    if not opts.confirm_disposable_local_only:
        raise SystemExit("Explicit --confirm-disposable-local-only required")
    repo=Path(__file__).resolve().parents[2]
    if (repo/"supabase"/".temp"/"project-ref").exists():
        raise SystemExit("Linked Supabase project detected: refuse replay")
    manifest=json.loads((repo/"supabase"/"audits"/
       "supa_ledger5e_original_baseline_provenance.json").read_text())
    snapshot=json.loads((repo/"supabase"/"audits"/
       "20261021_migration_content_fingerprints.json").read_text())
    with tempfile.TemporaryDirectory(prefix="ledger5f-local-scratch-") as d:
        base=Path(d)
        project=base/"isolated-project"
        meta=prepare_candidate(opts.private_source_dir,repo/"supabase",
                               project,manifest,snapshot)
        start_ok=reset_ok=False
        failure=None
        missing={"missing_object":None,"last_migration":None}
        try:
            start_ok,output,state=run_local(
                ["supabase","start"],cwd=project,timeout=opts.timeout)
            if not start_ok:
                failure="start_timeout" if state=="timeout" else classify_failure(output)
                missing=sanitized_dependency(output)
            else:
                reset_ok,output,state=run_local(
                    ["supabase","db","reset","--local"],cwd=project,timeout=opts.timeout)
                if not reset_ok:
                    failure="reset_timeout" if state=="timeout" else classify_failure(output)
                    missing=sanitized_dependency(output)
        finally:
            run_local(["supabase","stop","--no-backup"],cwd=project,timeout=120)
        result={
            "contract":"supa-ledger5f-private-disposable-replay-v1",
            "candidate_type":meta["candidate_type"],
            "origins_sha256_verified":meta["original_sources_verified"],
            "local_migrations_included":meta["local_migration_files"],
            "operational_token_insert_sanitized":True,
            "local_supabase_start_passed":start_ok,
            "local_supabase_reset_passed":reset_ok,
            "candidate_replay_passed":bool(start_ok and reset_ok),
            "failure_category":failure,
            **missing,
            "database_schema_acl_diff_verified":False,
            "signed_jwt_role_acceptance_verified":False,
            "source_exact_execution_proven":False,
            "repository_only_clean_rebuild_fixed":False,
            "history_repair_authorized":False,
            "production_deploy_authorized":False,
            "production_touched":False,
            "secrets_exported":False,
        }
    opts.report.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    print(json.dumps({
        "candidate_replay_passed":result["candidate_replay_passed"],
        "failure_category":result["failure_category"],
        "missing_object":result["missing_object"],
        "last_migration":result["last_migration"],
        "production_deploy_authorized":False,
    },sort_keys=True))
    # Candidate failure is an incomplete audit: non-zero exit distinguishes it
    # from a successful replay without exposing schema SQL in the logs.
    if not result["candidate_replay_passed"]:
        sys.exit(2)


if __name__=="__main__":
    main()
