from __future__ import annotations

import csv
from pathlib import Path

import pytest

from scripts.import_istat_municipalities import EXPECTED, load_verified_csv


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as out:
        writer = csv.DictWriter(out, fieldnames=EXPECTED)
        writer.writeheader()
        writer.writerows(rows)


def record(i: int) -> dict[str, str]:
    return {
        "istat_code": f"{i:06d}", "municipality_name": f"Comune {i}",
        "province_code": "MI", "province_name": "Milano",
        "region_code": "03", "region_name": "Lombardia",
    }


def test_reject_partial_istat_reference(tmp_path: Path) -> None:
    p = tmp_path / "sample.csv"
    write_csv(p, [record(1)])
    with pytest.raises(ValueError, match="official municipal count mismatch"):
        load_verified_csv(p)


def test_reject_duplicate_istat_code(tmp_path: Path) -> None:
    p = tmp_path / "duplicate.csv"
    write_csv(p, [record(1), record(1)])
    with pytest.raises(ValueError, match="duplicate ISTAT code"):
        load_verified_csv(p)


def test_reject_invalid_province(tmp_path: Path) -> None:
    p = tmp_path / "bad.csv"
    row = record(1)
    row["province_code"] = "Lombardia"
    write_csv(p, [row])
    with pytest.raises(ValueError, match="invalid province"):
        load_verified_csv(p)


def test_reject_unexpected_headers(tmp_path: Path) -> None:
    p = tmp_path / "bad.csv"
    p.write_text("name,istat_code\\nMilano,015146\\n", encoding="utf-8")
    with pytest.raises(ValueError, match="unexpected CSV headings"):
        load_verified_csv(p)
