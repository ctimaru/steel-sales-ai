"""C3: conservative coordinate-bound steel tube table-row candidates.

Input is positioned text from the isolated PDF reader. Only independent numeric
fragments on the same geometric row can establish a thickness-column slot.
Theoretical weights indicate table occupancy, never supply wall thickness.
Output stays pending evidence, not an asserted manufacturer SKU.
"""
from __future__ import annotations

import hashlib
import json
import re

from .net_pro_producers_pdf_table_sizes_c3 import HEADINGS

NUM = re.compile(r"^\d{1,4}(?:[.,]\d{1,2})?$")
GRADE = re.compile(r"^S(?:235|275|355|420|460)(?:JR|J0|J2|M|ML|N|NL)?H$", re.I)


def _lines(spans: list[dict]) -> list[list[dict]]:
    """Never fabricate token x coordinates by splitting PDF text strings."""
    lines: list[list[dict]] = []
    for span in sorted(spans, key=lambda s: (-s["y"], s["x"])):
        if not lines or abs(lines[-1][0]["y"] - span["y"]) > 1.2:
            lines.append([span])
        else:
            lines[-1].append(span)
    for row in lines:
        row.sort(key=lambda s: s["x"])
    return lines


def extract_positioned_thickness(pages: list[dict], size_rows: list[dict]) -> dict:
    """Return only slots linked to one already-observed dimensional source row.

    The geometry must independently support title, thickness header, numeric
    column label, dimension row, and an occupied value at that precise column.
    """
    found: list[dict] = []
    ambiguous = 0
    sizes: dict[tuple, list[dict]] = {}
    for s in size_rows:
        key = (s["page"], s["shape"], s["standard"],
               s.get("width_mm"), s.get("height_mm"), s.get("diameter_mm"))
        sizes.setdefault(key, []).append(s)
    for page in pages:
        pageno = page["page"]
        lines = _lines(page["spans"])
        active = None
        header_y = None
        label_row = None
        last_heading_y = None
        for row in lines:
            line = " ".join(s["text"].strip() for s in row)
            matched = next(((shape, standard) for rx, shape, standard in HEADINGS
                            if rx.match(line)), None)
            if matched:
                active = matched
                header_y = None
                label_row = None
                last_heading_y = row[0]["y"]
                continue
            if re.search(r"\b(?:EN\s*10\d{3}|ASTM|API\s*5L)\b", line, re.I):
                active = None
                label_row = None
                continue
            if active is None:
                continue
            if any(s["text"].lower().strip() in ("thickness", "spessore") for s in row):
                if len([s for s in row if s["text"].lower().strip() in ("thickness", "spessore")]) != 1:
                    active = None
                    continue
                header_y = row[0]["y"]
                label_row = None
                continue
            if header_y is None:
                continue
            if label_row is None:
                numeric = [s for s in row if NUM.fullmatch(s["text"].strip())]
                if (len(numeric) >= 2 and len(numeric) == len(row)
                    and 0 < header_y - row[0]["y"] <= 45
                    and all(.1 <= float(s["text"].replace(",", ".")) <= 100 for s in numeric)):
                    label_row = numeric
                continue
            if not 0 < header_y - row[0]["y"] <= 700:
                active = None
                continue
            numeric = [s for s in row if NUM.fullmatch(s["text"].strip())]
            if len(numeric) != len(row) or len(numeric) < (3 if active[0] != "CHS" else 2):
                continue
            leftmost = min(s["x"] for s in label_row)
            dimensions = [s for s in numeric if s["x"] < leftmost - 5]
            n_dim = 1 if active[0] == "CHS" else 2
            if len(dimensions) != n_dim:
                continue
            try:
                dimension_values = [float(s["text"].replace(",", ".")) for s in dimensions]
            except ValueError:
                continue
            if not all(10 <= d <= 1500 for d in dimension_values):
                continue
            if active[0] == "SHS" and dimension_values[0] != dimension_values[1]:
                continue
            key = (pageno, active[0], active[1],
                   None if active[0] == "CHS" else dimension_values[0],
                   None if active[0] == "CHS" else dimension_values[1],
                   dimension_values[0] if active[0] == "CHS" else None)
            matches = sizes.get(key, [])
            if len(matches) != 1:
                ambiguous += 1
                continue
            for column in label_row:
                aligned = [s for s in numeric if abs(s["x"] - column["x"]) <= 2]
                if len(aligned) != 1:
                    continue
                thickness = float(column["text"].replace(",", "."))
                proof = {"page": pageno, "standard": active[1], "shape": active[0],
                         "dimensions": dimension_values, "thickness": thickness,
                         "label_xy": [column["x"], column["y"]],
                         "value_xy": [aligned[0]["x"], aligned[0]["y"]],
                         "value": aligned[0]["text"], "locator": matches[0]["locator"]}
                found.append({
                    "page": pageno, "source_locator": matches[0]["locator"],
                    "shape": active[0], "standard": active[1],
                    **({ "diameter_mm":dimension_values[0] } if active[0]=="CHS"
                       else { "width_mm":dimension_values[0],"height_mm":dimension_values[1]}),
                    "thickness_mm": thickness,
                    "geometry_sha256": hashlib.sha256(json.dumps(
                        proof, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
                    "status": "pending_producer_confirmation",
                })
            if len(found) > 300:
                raise ValueError("PDF geometry candidate cap")
    return {"candidate_rows":found, "ambiguous_rows":ambiguous,
            "source_verified":0,"manufacturer_confirmed":0}
