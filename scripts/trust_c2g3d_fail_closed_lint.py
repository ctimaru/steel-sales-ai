#!/usr/bin/env python3
"""Fail-closed gate for Supabase CLI plpgsql_check JSON diagnostics.

The Supabase lint CLI may exit 0 despite per-function 'level=error' diagnostics.
Only a parseable lint report or the documented no-schema-errors sentinel passes.
Never print function bodies, SQL statements or sensitive source values to CI logs.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ANSI=re.compile(r"\x1b\[[0-9;]*m")
CLEAN=re.compile(r"(?:No schema errors found|No schema errors detected|No database lint errors found)",re.I)

def parse_report(source: str) -> list:
    text=ANSI.sub("",source).strip()
    decoder=json.JSONDecoder()
    for i,char in enumerate(text):
        if char!="[": continue
        try:
            candidate,end=decoder.raw_decode(text[i:])
        except json.JSONDecodeError:
            continue
        if isinstance(candidate,list) and all(
           isinstance(entry,dict) and
           isinstance(entry.get("function"),str) and
           isinstance(entry.get("issues"),list) for entry in candidate):
            return candidate
    if CLEAN.search(text):
        return []
    raise ValueError("Unrecognized lint output: fail-closed (no verified diagnostics)")

def inspect(text: str) -> dict:
    rows=parse_report(text)
    found=[]
    for item in rows:
        for issue in item["issues"]:
            if not isinstance(issue,dict):
                raise ValueError("Malformed diagnostic: fail-closed")
            level=str(issue.get("level","")).strip().lower()
            if not level:
                raise ValueError("Missing severity: fail-closed")
            if level in ("error","fatal","critical"):
                found.append(item["function"])
    return {"functions_checked":len(rows),
            "blocking_diagnostics":len(found),
            "blocking_functions":sorted(set(found)),
            "pass":not found}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("report",type=Path)
    args=p.parse_args()
    try:
        result=inspect(args.report.read_text(encoding="utf8"))
    except (OSError,ValueError) as e:
        print("TRUST-C2G3D lint gate BLOCKED: missing/invalid report")
        return 1
    print(json.dumps(result,ensure_ascii=False))
    if not result["pass"]:
        print("TRUST-C2G3D lint gate BLOCKED: error diagnostics must be repaired")
    return 0 if result["pass"] else 1

if __name__=="__main__":
    sys.exit(main())
