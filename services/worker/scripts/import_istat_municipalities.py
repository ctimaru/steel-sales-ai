"""CRAWL-IT4.1 official ISTAT reference import (CSV staging, strict validation).

Expected CSV UTF-8 headers:
istat_code,municipality_name,province_code,province_name,region_code,region_name

Convert the official ISTAT XLSX to this mapping after visually verifying headers.
Run with --check to validate. --apply requires configured Supabase worker credentials,
and never updates network_facilities or network_companies.
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import json
import re
import unicodedata
from datetime import date
from pathlib import Path

from app.repository import WorkerRepository

EXPECTED = ("istat_code", "municipality_name", "province_code", "province_name",
            "region_code", "region_name")
SOURCE = "https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.xlsx"
REFERENCE_DATE = date(2026, 2, 21)
EXPECTED_COUNT = 7894


def normalize_name(name: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", name).strip().casefold().split())


def load_verified_csv(filename: Path) -> list[dict[str, object]]:
    with filename.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames is None or tuple(reader.fieldnames) != EXPECTED:
            raise ValueError(f"unexpected CSV headings: {reader.fieldnames!r}")
        rows = []
        seen: set[str] = set()
        for line, row in enumerate(reader, start=2):
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"malformed CSV row {line}")
            code = row["istat_code"].strip()
            province = row["province_code"].strip().upper()
            region_code = row["region_code"].strip()
            city = row["municipality_name"].strip()
            province_name = row["province_name"].strip()
            region = row["region_name"].strip()
            if not re.fullmatch(r"[0-9]{6}", code) or code in seen:
                raise ValueError(f"invalid or duplicate ISTAT code at row {line}")
            if not re.fullmatch(r"[A-Z]{2}", province) or not re.fullmatch(r"[0-9]{2}", region_code):
                raise ValueError(f"invalid province or region code at row {line}")
            if not city or not province_name or not region:
                raise ValueError(f"incomplete municipality record at row {line}")
            seen.add(code)
            rows.append({
                "istat_code": code, "municipality_name": city,
                "municipality_normalized": normalize_name(city),
                "province_code": province, "province_name": province_name,
                "region_code": region_code, "region_name": region,
                "reference_date": REFERENCE_DATE.isoformat(),
                "source_url": SOURCE,
            })
    if len(rows) != EXPECTED_COUNT:
        raise ValueError(f"official municipal count mismatch: {len(rows)} != {EXPECTED_COUNT}")
    if len({r["region_code"] for r in rows}) != 20:
        raise ValueError("expected exactly 20 ISTAT region codes")
    if not any(r["municipality_name"].casefold() == "castegnero nanto" for r in rows):
        raise ValueError("missing new Castegnero Nanto municipality in 2026 reference")
    return rows


async def apply_reference(rows: list[dict[str, object]]) -> None:
    repo = WorkerRepository()
    # All validation happens before first write. Idempotent upsert by ISTAT code.
    for start in range(0, len(rows), 200):
        await repo._request(
            "POST", "/rest/v1/network_it_municipalities?on_conflict=istat_code",
            json=rows[start:start + 200],
            prefer="resolution=merge-duplicates,return=minimal",
        )
    stored = await repo._request(
        "GET", "/rest/v1/network_it_municipalities?select=istat_code",
        prefer="count=exact",
    )
    if not isinstance(stored, list):
        raise RuntimeError("post-import reference read returned unexpected payload")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", type=Path, help="Official ISTAT XLSX mapped to strict normalized CSV")
    parser.add_argument("--apply", action="store_true", help="Write only official municipality reference rows")
    args = parser.parse_args()
    rows = load_verified_csv(args.csv)
    fingerprint = hashlib.sha256(args.csv.read_bytes()).hexdigest()
    print(json.dumps({"status": "validated", "count": len(rows),
                      "reference_date": REFERENCE_DATE.isoformat(), "sha256": fingerprint,
                      "source": SOURCE, "apply": args.apply}))
    if args.apply:
        asyncio.run(apply_reference(rows))


if __name__ == "__main__":
    main()
