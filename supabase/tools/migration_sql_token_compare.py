"""SUPA-LEDGER3B — re-runnable conservative PostgreSQL SQL lexical comparator.

This is a narrow forensic aid, not a PostgreSQL parser or proof of schema
equivalence. No network, DB writes, migration repair or source SQL export.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import re


_DOLLAR = re.compile(r"\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$")
_WORD = re.compile(r"[A-Za-z_0-9$]")


def tokenize_sql(source: str, *, depth: int = 0) -> list[str]:
    if depth > 8:
        raise ValueError("Nested dollar quote depth exceeds review budget")
    result = []
    i, n = 0, len(source)
    while i < n:
        c, following = source[i], source[i + 1] if i + 1 < n else ""
        if c.isspace():
            i += 1
            continue
        if c == "-" and following == "-":
            i += 2
            while i < n and source[i] != "\n":
                i += 1
            continue
        if c == "/" and following == "*":
            level = 1
            i += 2
            while i < n and level:
                if source.startswith("/*", i):
                    level += 1
                    i += 2
                elif source.startswith("*/", i):
                    level -= 1
                    i += 2
                else:
                    i += 1
            if level:
                raise ValueError("Unterminated SQL block comment")
            continue
        if c == "$":
            found = _DOLLAR.match(source, i)
            if found is not None:
                mark = found.group()
                close = source.find(mark, found.end())
                if close < 0:
                    raise ValueError("Unterminated dollar-quoted SQL body")
                result.append("D_OPEN:" + mark)
                result.extend(tokenize_sql(source[found.end():close], depth=depth + 1))
                result.append("D_CLOSE:" + mark)
                i = close + len(mark)
                continue
        if c in ("'", '"'):
            j, closed = i + 1, False
            e_quoted = (
                c == "'" and i > 0 and source[i-1] in ("E", "e")
                and (i < 2 or not (source[i-2].isalnum() or source[i-2] == "_"))
            )
            while j < n:
                if source[j] == c:
                    if j + 1 < n and source[j+1] == c:
                        j += 2
                        continue
                    j += 1
                    closed = True
                    break
                if e_quoted and source[j] == "\\":
                    j += 2
                    continue
                j += 1
            if not closed:
                raise ValueError("Unterminated SQL quoted string")
            result.append("Q:" + source[i:j])
            i = j
            continue
        if _WORD.fullmatch(c):
            j = i + 1
            while j < n and _WORD.fullmatch(source[j]):
                j += 1
            result.append("W:" + source[i:j])
            i = j
            continue
        result.append("P:" + c)
        i += 1
    return result


def compare_sql(remote: str, local: str) -> dict:
    """Return non-sensitive comparison metadata, never source SQL tokens."""
    try:
        left, right = tokenize_sql(remote), tokenize_sql(local)
    except ValueError as exc:
        return {"classification": "PARSER_UNCERTAIN", "warning": str(exc),
                "safe_for_automatic_repair": False}
    changed = sum(a != b for a, b in zip(left, right)) + abs(len(left) - len(right))
    return {
        "classification": ("LEXICAL_TOKENS_IDENTICAL_CANDIDATE"
                           if changed == 0 else "EXECUTABLE_TOKEN_DIFFERENCE"),
        "remote_token_count": len(left),
        "local_token_count": len(right),
        "positional_token_differences": changed,
        "safe_for_automatic_repair": False,
    }


def validate_manifest(data: dict) -> dict:
    if data.get("contract") != "supa-ledger3b-original-sql-token-comparison-v1":
        raise ValueError("Wrong original SQL token audit contract")
    rows = data.get("results")
    if not isinstance(rows, list) or len(rows) != 59:
        raise ValueError("Missing review entries")
    ids = {(r["name"], r["local_version"]) for r in rows}
    if len(ids) != len(rows):
        raise ValueError("Duplicate migration pair")
    counts = Counter(r["lexical_category"] for r in rows)
    if (counts.get("LEXICAL_TOKENS_IDENTICAL_CANDIDATE") != 38
        or counts.get("EXECUTABLE_TOKEN_DIFFERENCE") != 21
        or sum(counts.values()) != 59):
        raise ValueError("Mismatch in SQL comparison group counts")
    if data.get("auto_repair_authorized") is not False or data.get("db_writes") != 0:
        raise ValueError("Forensic evidence may not authorize modification")
    return {"compared": 59, "lexical_match_candidates": 38, "token_differences": 21}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--remote-sql", type=Path)
    parser.add_argument("--local-sql", type=Path)
    args = parser.parse_args()
    if args.manifest is not None:
        result = validate_manifest(json.loads(args.manifest.read_text(encoding="utf-8")))
    elif args.remote_sql is not None and args.local_sql is not None:
        # Use only on separately authorized and securely handled operator files.
        # Source SQL strings are NEVER emitted by this CLI.
        result = compare_sql(args.remote_sql.read_text(encoding="utf-8"),
                             args.local_sql.read_text(encoding="utf-8"))
    else:
        parser.error("Provide --manifest or both --remote-sql and --local-sql")
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
