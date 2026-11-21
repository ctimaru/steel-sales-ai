#!/usr/bin/env python3
"""TRUST-AUDIT1B.2 read-only candidate triage. ONLY aggregated results leave the runner.

Does not authenticate, validate, disclose, copy, export or rotate credential values.
Classification is automated and NOT final clearance of any candidate.
"""
import collections
import json
import math
import os
import re
import subprocess
import sys
from trust_audit1b import GENERIC, PLACEHOLDER, SENSITIVE_PATH, git

TEST_PATH = re.compile(r"(?i)(^|/)(?:tests?|fixtures?|__tests__|docs?|examples?|samples?|mocks?|ci)(/|$)|(?:test|spec|mock|fixture)\.(?:m?js|tsx?|py)$")
ENV_PATH = re.compile(r"(?i)(^|/)\.env(?:$|\.)")
ARCHIVE_PATH = re.compile(r"(?i)\.(?:zip|bak|dump|sqlite|db|xlsx?|csv|eml|msg|pem|p12|pfx|key|kdbx)$")
RESTRICTED_PATH = re.compile(r"(?i)(^|/)(?:private|backup|exports?|credentials|secrets)(/|$)")
BOT = re.compile(r"(?i)(?:\[bot\]|github.actions|dependabot|renovate|bot@|actions@)")
REFERENCE = re.compile(rb"(?i)(?:process\.env|os\.environ|dotenv|config\.|[A-Za-z]:\\|/usr/|/tmp/|/var/|https?://)")
HEX = re.compile(rb"(?i)^[a-f0-9]{24,}$")
ALNUM = re.compile(rb"^[A-Za-z0-9_-]+$")
HEAD_SCAN_LIMIT = 4_194_304

def kind_of_path(path):
    if not path:
        return "unattributed_path"
    if TEST_PATH.search(path):
        return "test_fixture_or_docs_path"
    if ENV_PATH.search(path) and ("example" in path.lower() or "sample" in path.lower()):
        return "env_example_path"
    if RESTRICTED_PATH.search(path):
        return "restricted_directory_path"
    return "other_source_path"

def kind_of_value(value):
    # No values are ever output or persisted.
    if REFERENCE.search(value):
        return "reference_or_runtime_expression"
    if HEX.fullmatch(value):
        return "hex_like_literal"
    if ALNUM.fullmatch(value):
        if len(value) >= 32 and any(48 <= c <= 57 for c in value) and any(65 <= c <= 90 or 97 <= c <= 122 for c in value):
            return "token_shaped_literal"
        return "identifier_or_text_literal"
    return "other_literal"

def path_flag(path):
    if ENV_PATH.search(path):
        return "env_named_path"
    if ARCHIVE_PATH.search(path):
        return "archive_or_export_extension"
    if RESTRICTED_PATH.search(path):
        return "restricted_directory"
    return "other_sensitive_name"

def is_bot(name, email):
    return bool(BOT.search(name) or BOT.search(email))

def blob_iterator():
    lines = git("rev-list", "--objects", "--all").decode("utf-8", "replace").splitlines()
    ids = []
    paths = {}
    for line in lines:
        sha, _, path = line.partition(" ")
        if sha not in paths:
            paths[sha] = path
            ids.append(sha)
    meta = git("cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)", payload=("\n".join(ids) + "\n").encode()).decode().splitlines()
    blobs = []
    for line in meta:
        fields=line.split()
        if len(fields) != 3:
            raise RuntimeError("Git metadata count mismatch")
        if fields[1] == "blob":
            blobs.append((fields[0],int(fields[2]),paths[fields[0]]))
    return blobs

def batch_blob_data(blobs):
    p=subprocess.Popen(["git","cat-file","--batch"],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,bufsize=0)
    try:
        for sha,size,path in blobs:
            if size > HEAD_SCAN_LIMIT:
                yield sha,path,None
                continue
            p.stdin.write((sha+"\n").encode("ascii"))
            p.stdin.flush()
            h=p.stdout.readline().strip().split()
            if len(h)!=3 or h[0].decode()!=sha or h[1]!=b"blob" or int(h[2])!=size:
                raise RuntimeError("Git object mismatch")
            remaining=size
            chunks=[]
            while remaining:
                block=p.stdout.read(remaining)
                if not block:
                    raise RuntimeError("Partial Git blob stream")
                chunks.append(block)
                remaining-=len(block)
            if p.stdout.read(1)!=b"\n":
                raise RuntimeError("Blob framing mismatch")
            yield sha,path,b"".join(chunks)
    finally:
        p.stdin.close()
        p.stdout.close()
        p.wait(timeout=30)

def main():
    if "--self-test" in sys.argv:
        assert kind_of_value(b"process.env.SECRET") == "reference_or_runtime_expression"
        assert kind_of_value(b"a1b2c3d4e5f6a7b8c9d0e1f2") == "hex_like_literal"
        assert kind_of_path("apps/web/tests/fixtures/token.test.mjs") == "test_fixture_or_docs_path"
        assert path_flag(".env") == "env_named_path"
        assert is_bot("github-actions[bot]","bot@users.noreply.github.com")
        assert not is_bot("Contributor","contributor@example.com")
        print("TRUST-AUDIT1B.2 synthetic classifier tests PASS")
        return 0
    blobs=blob_iterator()
    # HEAD object membership (blob SHA), not just the name of a path that may have changed historically.
    head_tree=git("ls-tree","-r","HEAD").decode("utf-8","replace").splitlines()
    head_blobs={m.group(1) for l in head_tree if (m:=re.match(r"\d+\s+blob\s+([0-9a-f]{40})\t",l))}
    value_kinds=collections.Counter()
    path_kinds=collections.Counter()
    object_scope=collections.Counter()
    suspicious_path_types=collections.Counter()
    candidate_blobs=0
    total_matches=0
    skipped=0
    historical_paths=set()
    for sha,size,path in blobs:
        if path and SENSITIVE_PATH.search(path):
            historical_paths.add(path)
        if size>HEAD_SCAN_LIMIT:
            skipped+=1
    for path in historical_paths:
        suspicious_path_types[path_flag(path)]+=1
    for sha,path,data in batch_blob_data(blobs):
        if data is None or b"\x00" in data[:4096]:
            continue
        matches=[v for v in GENERIC.findall(data) if not PLACEHOLDER.search(v)]
        if not matches:
            continue
        candidate_blobs+=1
        total_matches+=len(matches)
        path_kinds[kind_of_path(path)]+=1
        object_scope["present_in_head" if sha in head_blobs else "historical_or_branch_only"]+=1
        # One risk bucket per matched value, without releasing the value.
        for val in matches:
            value_kinds[kind_of_value(val)]+=1

    a=collections.Counter()
    c=collections.Counter()
    for line in git("log","--all","--format=%aN%x1f%aE%x1f%cN%x1f%cE").decode("utf-8","replace").splitlines():
        f=line.split("\x1f")
        if len(f)!=4:
            continue
        a[(f[0],f[1])]+=1
        c[(f[2],f[3])]+=1
    def signature_overview(counter):
        vals=sorted(counter.values(),reverse=True)
        bot_commits=sum(count for (name,email),count in counter.items() if is_bot(name,email))
        return {
            "distinct_signatures":len(counter),
            "dominant_signature_commits":vals[0] if vals else 0,
            "minority_signature_commits":sum(vals[1:]),
            "bot_like_signature_count":sum(is_bot(n,e) for n,e in counter),
            "bot_like_signature_commits":bot_commits,
            "other_signature_count":sum(not is_bot(n,e) for n,e in counter),
        }
    report={
        "gate":"TRUST-AUDIT1B.2",
        "mode":"aggregate-only, no credential values/paths/identities, read-only",
        "reachable_unique_blobs":len(blobs),
        "skipped_large_blobs":skipped,
        "baseline_generic_candidate_blobs":candidate_blobs,
        "generic_matches_total":total_matches,
        "candidate_blob_contexts":dict(sorted(path_kinds.items())),
        "candidate_value_shapes":dict(sorted(value_kinds.items())),
        "candidate_blob_scope":dict(sorted(object_scope.items())),
        "historical_sensitive_path_name_count":len(historical_paths),
        "historical_sensitive_path_types":dict(sorted(suspicious_path_types.items())),
        "authors":signature_overview(a),
        "committers":signature_overview(c),
        "assessment":"Every candidate remains pending private/manual verification; no credential legitimacy or IP ownership established",
        "limitations":["A pattern shape or test path never proves safe content","Branch/fork or unreachable historical objects may be missing","No raw values are output for independent public review","This tool does not rotate or revoke secrets"]
    }
    if candidate_blobs != sum(path_kinds.values()) or candidate_blobs != sum(object_scope.values()):
        raise RuntimeError("Triage invariant mismatch")
    result=json.dumps(report,ensure_ascii=False,sort_keys=True)
    print(result)
    step_summary=os.getenv("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary,"a",encoding="utf-8") as f:
            f.write("## TRUST-AUDIT1B.2 — Candidate triage (aggregates only)\n\n")
            f.write(result+"\n")
    return 0

if __name__=="__main__":
    sys.exit(main())
