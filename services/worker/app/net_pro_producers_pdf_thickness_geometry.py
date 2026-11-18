"""Fail-closed geometric observation of PDF thickness-column availability.

Accepts independently extracted, page-local PDF cell coordinates, not flattened
layout text. It never converts theoretical weights into wall thickness.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import re

NUMBER = re.compile(r"^(?:\\d{1,3})(?:[,.]\\d{1,2})?$")


@dataclass(frozen=True)
class Cell:
    page: int
    row: int
    col: int
    x0: float
    x1: float
    text: str


def observed_thickness_cells(cells: list[Cell], *, max_cells: int = 3000) -> list[dict]:
    """Observe populated thickness slots; never confirm an SKU.

    Page/row/column identity must originate from a separate positional PDF
    extractor, not a whitespace split. A same-page thickness header, numeric
    column label and occupied numeric data cell must align geometrically.
    """
    if len(cells) > max_cells:
        raise ValueError("PDF cell limit")
    keys = set()
    byrow: dict[tuple[int, int], list[Cell]] = {}
    for cell in cells:
        if (type(cell.page) is not int or type(cell.row) is not int
                or type(cell.col) is not int or not 1 <= cell.page <= 100
                or cell.row < 0 or cell.col < 0 or cell.col > 60
                or not 0 <= cell.x0 < cell.x1 <= 10000
                or not isinstance(cell.text, str) or len(cell.text) > 80):
            raise ValueError("Invalid PDF geometry")
        key = (cell.page, cell.row, cell.col)
        if key in keys:
            raise ValueError("Ambiguous PDF cell grid")
        keys.add(key)
        byrow.setdefault((cell.page, cell.row), []).append(cell)
    out: list[dict] = []
    for (page, row), row_cells in sorted(byrow.items()):
        headers = byrow.get((page, row - 2), [])
        labels = byrow.get((page, row - 1), [])
        matched = [c for c in headers if c.text.strip().lower() in ("thickness", "spessore")]
        if len(matched) != 1:
            continue
        header = matched[0]
        value_by_col = {c.col: c for c in row_cells}
        for label in labels:
            if not NUMBER.fullmatch(label.text.strip()):
                continue
            thickness = float(label.text.replace(",", "."))
            if not 0.1 <= thickness <= 100:
                continue
            value = value_by_col.get(label.col)
            if value is None or not NUMBER.fullmatch(value.text.strip()):
                continue
            overlap = min(label.x1, value.x1) - max(label.x0, value.x0)
            if overlap <= 0 or label.x0 < header.x0 or label.x1 > header.x1:
                continue
            evidence = f"{page}|{row}|{label.col}|{label.text}|{value.text}|{header.x0}:{header.x1}|{label.x0}:{label.x1}|{value.x0}:{value.x1}"
            out.append({"page": page, "row": row, "column": label.col,
                        "thickness_mm": thickness,
                        "geometry_sha256": hashlib.sha256(evidence.encode("utf-8")).hexdigest(),
                        "evidence_status": "pending_producer_confirmation"})
    return out
