#!/usr/bin/env python3
"""Audit current tracked source references to the founder's employer.

Read-only: never prints matched text, file contents, credentials or PII.
Keeps existing Git history unchanged. Reports names of tracked files
and count per class for targeted review; not proof of clean historical Git.
"""
from __future__ import annotations
import argparse
import collections
import json
import pathlib
import re
import subprocess

# Split the patterns to avoid an accidental brand string in the audit guard.
EMPLOYER = re.compile(r"\bal" + r"essio(?:[\W_]*tu" + r"bi)?\b", re.I)
GROUP = re.compile(r"\bam" + r"enduni\b", re.I)
HTMLABLE = {".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".sql", ".json", ".md", ".py", ".yml", ".yaml", ".html", ".txt", ".sh", ".csv"}
EXCLUDE_SELF = {"scripts/trust_audit1c2_employer_reference.py"}

def files():
    result = subprocess.run(["git","ls-files","-z"],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    for raw in result.stdout.split(b"\0"):
        if raw:
            yield pathlib.Path(raw.decode("utf-8","replace"))

def area(path):
    name=path.as_posix()
    if name.startswith("apps/web/app/") or name.startswith("apps/web/components/") or name.startswith("apps/web/lib/"):
        return "active_frontend"
    if name.startswith("services/worker/"):
        return "worker"
    if name.startswith("supabase/migrations/"):
        return "historical_migration_do_not_edit"
    if name.startswith("supabase/"):
        return "database_other"
    if name.startswith("docs/"):
        return "docs"
    if "/tests/" in name or name.startswith("apps/web/tests/"):
        return "tests"
    return "other"

def scan():
    hit_files=[]
    by_area=collections.Counter()
    name_hits=0
    group_hits=0
    all_files=0
    unreadable=0
    for path in files():
        if path.as_posix() in EXCLUDE_SELF or path.suffix.lower() not in HTMLABLE:
            continue
        if not path.exists() or not path.is_file():
            unreadable+=1
            continue
        all_files+=1
        data=path.read_bytes()
        if len(data)>4_194_304 or b"\0" in data[:4096]:
            unreadable+=1
            continue
        text=data.decode("utf-8","replace")
        a=len(EMPLOYER.findall(text))
        b=len(GROUP.findall(text))
        if a or b:
            cat=area(path)
            hit_files.append({"path":path.as_posix(),"area":cat,"name_matches":a,"group_matches":b})
            by_area[cat]+=1
            name_hits+=a
            group_hits+=b
    return {"gate":"TRUST-AUDIT1C.2","scope":"tracked working tree only, read-only","files_scanned":all_files,"files_skipped":unreadable,
            "files_with_references":len(hit_files),"name_occurrences":name_hits,"group_occurrences":group_hits,
            "file_counts_by_area":dict(sorted(by_area.items())),"files":sorted(hit_files,key=lambda x:x["path"]),
            "limitations":["Paths and counts only: no matched text","Git history and deleted refs are not cleaned","Third-party network records require separate source-rights decisions","Migration history must be preserved; use forward remediation"]}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--self-test",action="store_true")
    p.add_argument("--fail-active",action="store_true")
    args=p.parse_args()
    if args.self_test:
        assert EMPLOYER.search("Alessio Tubi")
        assert EMPLOYER.search("ALESSIOTUBI")
        assert EMPLOYER.search("Alessio")
        assert GROUP.search("AMENDUNI")
        assert not EMPLOYER.search("Smart Steel Sales")
        print("Reference audit self-test PASS")
        return 0
    report=scan()
    # Source paths are disclosed, never matching text.
    rendered=json.dumps(report,ensure_ascii=False,sort_keys=True)
    print(rendered)
    if args.fail_active:
        active=[x for x in report["files"] if x["area"] in ("active_frontend","worker")]
        if active:
            print(f"Active product source still contains {len(active)} reference-bearing files.")
            return 1
    return 0
if __name__=="__main__":
    raise SystemExit(main())
