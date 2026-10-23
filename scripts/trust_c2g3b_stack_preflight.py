#!/usr/bin/env python3
"""TRUST-C2G3B: read-only Git ancestry + production/staging migration readiness.
No Supabase credentials or remote database calls. --strict fails on every unresolved gate.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SNAP = ROOT / "supabase/audits/trust_c2g3b_stack_migration_snapshot.json"
SQLDIR = ROOT / "supabase/migrations"

def run_git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    return p.returncode, p.stdout.strip()

def status(snapshot, sql_dir=SQLDIR, git=run_git):
    problems = []
    reviewed = {}
    prod = snapshot["production_migrations"]
    staging = snapshot["staging_migrations"]
    prod_by_name = dict((name,ver) for ver,name in prod)
    stage_by_name = dict((name,ver) for ver,name in staging)
    if len(prod_by_name) != len(prod) or len(stage_by_name) != len(staging):
        problems.append("duplicate_migration_name_in_evidence_snapshot")
    for version,name in prod:
        path = sql_dir / (version+"_"+name+".sql")
        reviewed[name] = path.exists()
        if not path.exists():
            problems.append("canonical_repo_migration_missing:"+name)
    for name,version in prod_by_name.items():
        if name not in stage_by_name:
            problems.append("staging_name_missing:"+name)
        elif stage_by_name[name] != version:
            problems.append("staging_prod_version_diverges:"+name)
    for name in stage_by_name:
        if name not in prod_by_name:
            problems.append("staging_only_historical_migration:"+name)
    for version,name in prod:
        matching=list(sql_dir.glob(version+"_*.sql"))
        if len(matching)>1:
            problems.append("duplicate_repo_version:"+version)

    code,main = git("rev-parse","origin/main")
    if code:
        problems.append("main_ref_unavailable")
        counts = None
    else:
        # A stacked branch may contain every predecessor commit, but the first
        # PR currently diverges from main. Never rewrite history automatically.
        code, counts = git("rev-list","--left-right","--count","origin/main...HEAD")
        if code:
            problems.append("cannot_compare_main_and_stack")
        else:
            behind = int(counts.split()[0])
            if behind:
                problems.append("stack_behind_main:"+str(behind))
    for field,value in snapshot["acceptance_gates"].items():
        if value!="PASS":
            problems.append("open_gate:"+field)

    return {
        "audit":snapshot["audit"],"safe_to_merge":not problems,
        "production_migration_files_present":sum(reviewed.values()),
        "production_migration_expected":len(prod),
        "production_and_staging_versions_same":all(stage_by_name.get(k)==v for k,v in prod_by_name.items()) and len(stage)==len(prod),
        "stack_reference_state":counts if isinstance(counts,str) else "unknown",
        "blocking_findings":sorted(set(problems)),
        "policy":"Report only: never reconcile ledger, merge or deploy automatically"
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--strict",action="store_true")
    parser.add_argument("--json",action="store_true")
    opts=parser.parse_args()
    snap=json.loads(SNAP.read_text())
    result=status(snap)
    print(json.dumps(result,indent=2,ensure_ascii=False))
    return 1 if opts.strict and not result["safe_to_merge"] else 0

if __name__ == "__main__":
    sys.exit(main())
