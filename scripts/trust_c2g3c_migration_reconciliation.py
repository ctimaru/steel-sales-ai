#!/usr/bin/env python3
"""TRUST-C2G3C: offline source/schema migration drift inventory; NEVER repairs ledgers.
Consumes a dated, read-only live Supabase snapshot. No DB connection, no credentials.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "supabase/audits/20261023_trust_c2g3c_catalog_and_ledger_snapshot.json"
SQLDIR = ROOT / "supabase/migrations"

def reconcile(snapshot, migrations_dir=SQLDIR):
    prod = snapshot["production"]
    stage = snapshot["staging"]
    result = {"audit": snapshot["audit"], "snapshot_date": snapshot["captured_on"]}
    def indexed(rows, key):
        out = {}
        for row in rows:
            k = key(row)
            if k in out:
                raise ValueError("Duplicated audit metadata key")
            out[k] = row
        return out
    pcat = indexed(prod["catalog"],lambda r:r["kind"]+":"+r["key"])
    scat = indexed(stage["catalog"],lambda r:r["kind"]+":"+r["key"])
    common = sorted(set(pcat)&set(scat))
    differences = [k for k in common if pcat[k]["digest"]!=scat[k]["digest"]]
    only_prod = sorted(set(pcat)-set(scat))
    only_stage = sorted(set(scat)-set(pcat))
    exceptions = snapshot["reviewed_textual_differences"]
    unreviewed = sorted(set(differences)-set(exceptions))
    stale_exceptions = sorted(set(exceptions)-set(differences))
    behavior = snapshot["observed_behavioral_probe"]
    behavior_pass = (
        behavior["staging"].startswith("PASS:")
        and behavior["production"].startswith("PASS:")
        and behavior["synthetic_writes_rolled_back"] is True
    )
    result["catalog"] = {
        "production_objects":len(pcat),"staging_objects":len(scat),
        "same_definition":len(common)-len(differences),
        "text_differences":differences,"only_production":only_prod,
        "only_staging":only_stage,"unreviewed_differences":unreviewed,
        "stale_reviewed_exceptions":stale_exceptions,
        "scoped_behavioral_probe_pass":behavior_pass
    }

    pmig = indexed(prod["migrations"],lambda r:r["name"])
    smig = indexed(stage["migrations"],lambda r:r["name"])
    shared = sorted(set(pmig)&set(smig))
    wrong_versions=[n for n in shared if pmig[n]["version"]!=smig[n]["version"]]
    different_sql=[n for n in shared if pmig[n]["sql_digest"]!=smig[n]["sql_digest"]]
    expected_files = [
        migrations_dir/(r["version"]+"_"+r["name"]+".sql")
        for r in prod["migrations"]
    ]
    absent = [str(p.name) for p in expected_files if not p.is_file()]
    reused = [
        r["version"] for r in prod["migrations"]
        if len(list(migrations_dir.glob(r["version"]+"_*.sql")))>1
    ]
    result["migrations"] = {
        "production":len(pmig),"staging":len(smig),
        "different_version_same_name":wrong_versions,
        "different_executed_sql_same_name":different_sql,
        "production_only":sorted(set(pmig)-set(smig)),
        "staging_only":sorted(set(smig)-set(pmig)),
        "canonical_repo_files_present":len(expected_files)-len(absent),
        "canonical_repo_files_expected":len(expected_files),
        "missing_files":absent,
        "duplicate_repo_versions":reused
    }
    incomplete = sorted(k for k,v in snapshot["release_gates"].items() if v!="PASS")
    result["gates"] = {"incomplete":incomplete}
    snapshot_scope_ok = (
        len(pcat)==27 and len(scat)==27
        and not only_prod and not only_stage
        and not unreviewed and not stale_exceptions and behavior_pass
    )
    result["scoped_catalog_parity_tested"] = snapshot_scope_ok
    blockers=[]
    if not snapshot_scope_ok: blockers.append("unreviewed_catalog_or_behavioral_drift")
    if wrong_versions or different_sql or len(pmig)!=len(smig):
        blockers.append("migration_history_drift_requires_manual_reconciliation")
    if absent or reused: blockers.append("canonical_migration_files_not_unique")
    if incomplete: blockers.extend("open_"+k for k in incomplete)
    result["release_ready"] = len(blockers)==0
    result["blockers"] = blockers
    result["automatic_schema_migration_repair_allowed"] = False
    result["note"] = ("Snapshot and scoped behavior only; neither equivalent SQL "
                      "nor a clean replay is proved. Never update migration ledger.")
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--snapshot",type=Path,default=SNAPSHOT)
    parser.add_argument("--migrations-dir",type=Path,default=SQLDIR)
    parser.add_argument("--report",type=Path)
    parser.add_argument("--strict",action="store_true")
    args=parser.parse_args()
    result=reconcile(json.loads(args.snapshot.read_text(encoding="utf8")),args.migrations_dir)
    serialized=json.dumps(result,indent=2,ensure_ascii=False)
    print(serialized)
    if args.report:
        args.report.write_text(serialized+"\n",encoding="utf8")
    return 1 if args.strict and not result["release_ready"] else 0

if __name__=="__main__":
    raise SystemExit(main())
