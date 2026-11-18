"""C3.DATA2.A: conservative single-page PDF table-size observation extraction.

Only a first-party document's actual table title and a numeric size row on the
SAME page may be associated. No steel grade, thickness or manufacturability
is inferred from adjacent headers or theoretical weight columns.
"""
from __future__ import annotations
import hashlib
import re
from typing import Any

from .net_pro_producers_catalog_b1 import CatalogueRejected

HEADINGS = (
    (re.compile(r"^RECTANGULAR\s+EN\s*10219\s*[-–]\s*theoretical\s+weight\b", re.I), "RHS", "EN 10219"),
    (re.compile(r"^SQUARE\s+EN\s*10219\s*[-–]\s*theoretical\s+weight\b", re.I), "SHS", "EN 10219"),
    (re.compile(r"^ROUND\s+STRUCTURAL\s+EN\s*10219\s*[-–]\s*theoretical\s+weight\b", re.I), "CHS", "EN 10219"),
    (re.compile(r"^Hot\s+finished\s+Rectangular\s+EN\s*10210\s*[-–]\s*theoretical\s+weight\b", re.I), "RHS", "EN 10210"),
    (re.compile(r"^Hot\s+finished\s+Square\s+EN\s*10210\s*[-–]\s*theoretical\s+weight\b", re.I), "SHS", "EN 10210"),
)
NUMBER = re.compile(r"^\d{1,4}(?:[,.]\d{1,2})?$")
MAX_ROWS = 120


def extract_pdf_table_sizes(pages: list[dict]) -> dict:
    """Extract width×height / outer diameter without guessing header cells.

    Returns source-observed row facts; even a licensed PDF does not turn these
    into a manufacturer_confirmed or a fully source-verified SKU.
    """
    rows: list[dict] = []
    ignored = 0
    for page in pages:
        pageno = page.get("page")
        if type(pageno) is not int or not 1 <= pageno <= 100 or not isinstance(page.get("lines"), list):
            raise CatalogueRejected("C3 invalid PDF page source")
        active: tuple[str, str] | None = None
        header_lines = 0
        saw_data = False
        for raw in page["lines"]:
            if not isinstance(raw, str) or len(raw) > 4000:
                raise CatalogueRejected("C3 invalid PDF text line")
            line = " ".join(raw.strip().split())
            if not line:
                continue
            matched = next(((shape, standard) for regex, shape, standard in HEADINGS if regex.match(line)), None)
            if matched:
                active = matched
                header_lines = 0
                saw_data = False
                continue
            if active is None:
                continue
            if re.search(r"(?:EN\s*10\d{3}|API\s*5[LC]|ASTM|SQUARE|ROUND|RECTANGULAR)", line, re.I):
                active = None
                continue
            # Allow only table dimension/thickness header and its numeric
            # thickness-column labels, not arbitrary product heading paragraphs.
            if re.fullmatch(r"(?:Dim\.?|Diam\.?|Ø|Thickness|Dimensione\s*[-–]\s*Size|Side.s\s*dim\.)",line,re.I):
                header_lines += 1
                if header_lines > 5 and not saw_data:
                    active = None
                continue
            cells = line.split()
            if len(cells) < (3 if active[0] in ("RHS", "SHS") else 2) or len(cells) > 25:
                if saw_data:
                    active = None
                else:
                    ignored += 1
                continue
            if not all(NUMBER.fullmatch(s) for s in cells):
                if saw_data:
                    active = None
                else:
                    ignored += 1
                continue
            # These are weight cells; their alignment with the thickness
            # header is NOT provable from a flattened text row, so we
            # NEVER map weights into thickness values.
            if active[0] == "CHS":
                dia = float(cells[0].replace(",", "."))
                if not 20 <= dia <= 1500:
                    ignored += 1
                    continue
                identifier = str(dia).rstrip("0").rstrip(".") if "." in str(dia) else str(dia)
                dims = {"diameter_mm": dia}
            else:
                width = float(cells[0].replace(",", "."))
                height = float(cells[1].replace(",", "."))
                if not (20 <= width <= 1500 and 10 <= height <= 1500):
                    ignored += 1
                    continue
                if active[0] == "SHS" and width != height:
                    ignored += 1
                    continue
                identifier = f"{width:g}x{height:g}"
                dims = {"width_mm": width, "height_mm": height}
            sha = hashlib.sha256(raw.strip().encode("utf-8")).hexdigest()
            rows.append({
                "page": pageno,
                "standard": active[1],
                "shape": active[0],
                "locator": f"pdf_page:{pageno}:table:{active[0].lower()}_{active[1].lower().replace(' ', '')}:row:{identifier}",
                "line_sha256": sha,
                "extraction_basis": "pypdf_page_layout",
                **dims,
            })
            saw_data = True
            if len(rows) > MAX_ROWS:
                raise CatalogueRejected("C3 PDF size row limit exceeded")
    unique: dict[str, dict] = {}
    for item in rows:
        # Multiple inconsistent rows with the same size under one heading
        # mean ambiguous source; do not write an arbitrary first occurrence.
        key = item["locator"]
        if key not in unique:
            unique[key] = item
        elif unique[key]["line_sha256"] != item["line_sha256"]:
            unique.pop(key)
    return {"rows": list(unique.values()), "ignored_lines": ignored, "source_verified": 0, "manufacturer_confirmed": 0}


def stage_pdf_table_sizes(db: Any, manifest: dict, pages: list[dict]) -> dict:
    """Only invoked after B2 licensed document inspection by the worker."""
    extracted = extract_pdf_table_sizes(pages)
    rows = extracted["rows"]
    added = replayed = 0
    for start in range(0, len(rows), 30):
        part = rows[start:start + 30]
        response = db.rpc("netproducers_c3_pdf_stage", {
            "p_company": manifest["company_id"],
            "p_source": manifest["source_url"],
            "p_rows": part,
        }).execute().data
        if (not isinstance(response, dict)
                or response.get("contract") != "netproducers-c3-pdf-stage-v1"
                or response.get("source_verified") != 0
                or response.get("manufacturer_confirmed") != 0
                or response.get("added", -1) + response.get("replayed", -1) != len(part)):
            raise CatalogueRejected("C3 unexpected service-only PDF size staging reply")
        added += response["added"]
        replayed += response["replayed"]
    return {"size_rows_found": len(rows), "size_rows_new": added,
            "size_rows_replayed": replayed, "source_verified": 0,
            "manufacturer_confirmed": 0}
