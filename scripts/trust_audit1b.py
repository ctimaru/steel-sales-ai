#!/usr/bin/env python3
"""Read-only TRUST-AUDIT1B scanner: aggregate counts only, never secret values or personal identifiers."""
import collections
import json
import os
import re
import subprocess
import sys

PATTERNS = {
  "aws_access_id": rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
  "github_token": rb"\b(?:gh[pousr]_[A-Za-z0-9_]{25,}|github_pat_[A-Za-z0-9_]{35,})\b",
  "private_key_header": rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----",
  "stripe_live_key": rb"\b(?:sk_live|rk_live)_[A-Za-z0-9]{20,}\b",
  "openai_key_pattern": rb"\bsk-(?:proj-)?[A-Za-z0-9_-]{36,}\b",
  "slack_token": rb"\bxox[baprs]-[A-Za-z0-9-]{20,}\b",
}
RULES = {k: re.compile(v) for k,v in PATTERNS.items()}
GENERIC = re.compile(rb"(?im)^[ \t]*(?:export[ \t]+)?(?:[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|SERVICE_ROLE_KEY)[A-Z0-9_]*|(?:password|client_secret|api_key|access_token))[ \t]*[:=][ \t]*[\"']?([A-Za-z0-9_./+=:-]{18,})")
PLACEHOLDER = re.compile(rb"(?:example|placeholder|your[-_]|changeme|dummy|mock|fake|not[-_]?set|test[-_]?key|localhost|sample)", re.I)
SENSITIVE_PATH = re.compile(r"(?i)(?:^|/)(?:\.env(?:\.|$)|[^/]+\.(?:pem|p12|pfx|key|kdbx|sqlite|db|bak|dump|eml|msg|xlsx?|csv|zip)$|(?:private|backup|exports?|credentials|secrets)/)")
def git(*args, payload=None):
    return subprocess.run(["git",*args], input=payload, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout
def scan(data,high,low):
    for k,regex in RULES.items():
        if regex.search(data):
            high[k]+=1
    if any(not PLACEHOLDER.search(v) for v in GENERIC.findall(data)):
        low["assignment_candidate_blobs"]+=1
def main():
    if "--self-test" in sys.argv:
        high,low=collections.Counter(),collections.Counter()
        scan(b"AKIA"+b"A"*16+b"\n",high,low)
        assert high["aws_access_id"]==1
        high,low=collections.Counter(),collections.Counter()
        scan(b'API_KEY="your-example-placeholder"\n',high,low)
        assert not high and not low
        print("TRUST-AUDIT1B scanner self-test PASS")
        return 0
    limit=4194304
    raw=git("rev-list","--objects","--all").decode("utf-8","replace").splitlines()
    objs=set()
    special=set()
    for line in raw:
        sha,_,path=line.partition(" ")
        objs.add(sha)
        if path and SENSITIVE_PATH.search(path):
            special.add(path)
    if not objs:
        raise RuntimeError("No git objects found: incomplete audit")
    ids=sorted(objs)
    meta=git("cat-file","--batch-check=%(objectname) %(objecttype) %(objectsize)",payload=("\n".join(ids)+"\n").encode()).decode().splitlines()
    blobs=[]
    for line in meta:
        fields=line.split()
        if len(fields)!=3:
            raise RuntimeError("Malformed object metadata")
        if fields[1]=="blob":
            blobs.append((fields[0],int(fields[2])))
    high,low=collections.Counter(),collections.Counter()
    scanned=binary=oversize=bytes_read=0
    proc=subprocess.Popen(["git","cat-file","--batch"],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,bufsize=0)
    try:
        for sha,size in blobs:
            if size>limit:
                oversize+=1
                continue
            proc.stdin.write((sha+"\n").encode())
            proc.stdin.flush()
            header=proc.stdout.readline().strip().split()
            if len(header)!=3 or header[0].decode()!=sha or header[1]!=b"blob" or int(header[2])!=size:
                raise RuntimeError("Git blob stream mismatch")
            # Raw pipes may return fewer bytes than requested; read exactly size.
            chunks=[]
            remaining=size
            while remaining:
                part=proc.stdout.read(remaining)
                if not part:
                    raise RuntimeError("Incomplete blob read")
                chunks.append(part)
                remaining-=len(part)
            data=b"".join(chunks)
            if proc.stdout.read(1)!=b"\n":
                raise RuntimeError("Missing blob separator")
            scanned+=1
            bytes_read+=size
            if b"\x00" in data[:4096]:
                binary+=1
                continue
            scan(data,high,low)
    finally:
        proc.stdin.close()
        proc.stdout.close()
        proc.wait(timeout=30)
    refs=git("for-each-ref","--format=%(refname)","refs/remotes/origin","refs/tags").decode().splitlines()
    people=git("log","--all","--format=%aN%x1f%aE%x1f%cN%x1f%cE").decode("utf-8","replace").splitlines()
    authors,committers=collections.Counter(),collections.Counter()
    changes=0
    for row in people:
        f=row.split("\x1f")
        if len(f)==4:
            authors[(f[0],f[1])]+=1
            committers[(f[2],f[3])]+=1
            if f[:2]!=f[2:]:
                changes+=1
    counts=sorted(authors.values(),reverse=True)
    coauthors=sum(s.lower().startswith("co-authored-by:") for s in git("log","--all","--format=%B").decode("utf-8","replace").splitlines())
    report={
      "gate":"TRUST-AUDIT1B","mode":"read-only; aggregate-only",
      "reachable_commit_count":int(git("rev-list","--count","--all").strip()),
      "remote_head_refs":sum(x.startswith("refs/remotes/origin/") for x in refs),
      "tag_refs":sum(x.startswith("refs/tags/") for x in refs),
      "reachable_object_count":len(ids),"unique_blob_count":len(blobs),
      "scanned_blobs":scanned,"scanned_bytes":bytes_read,
      "blobs_over_4MiB_not_scanned":oversize,"binary_blobs_not_regex_scanned":binary,
      "potentially_sensitive_historical_paths":len(special),
      "distinct_author_signatures":len(authors),"distinct_committer_signatures":len(committers),
      "top_author_commit_share_pct":round(100*counts[0]/len(people),2) if people else 0,
      "author_committer_signature_differences":changes,
      "coauthor_attribution_lines":coauthors,
      "high_confidence_pattern_blob_counts":dict(sorted(high.items())),
      "generic_assignment_candidate_blob_counts":dict(sorted(low.items())),
      "limitations":["Regex hits are not verified credentials","Unreachable or deleted refs and inaccessible forks not scanned","Binary and >4MiB blobs skipped","Commit signatures do not establish legal authorship or IP ownership"]
    }
    public_safe=json.dumps(report,ensure_ascii=False,sort_keys=True)
    print(public_safe)
    summary=os.getenv("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary,"a",encoding="utf-8") as f:
            f.write("TRUST-AUDIT1B read-only secret history and provenance counts (no raw findings)\n\n")
            f.write(public_safe+"\n")
    return 0 if scanned>0 else 2
if __name__=="__main__":
    sys.exit(main())
