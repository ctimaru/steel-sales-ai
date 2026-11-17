"""AUTO1.A.5 — bounded, source-local diagnostics for missing exact specifications.

This module reports *why* an official HTML page did not yield same-row technical
tuples. It never creates evidence, carries no URLs or HTML text, and cannot
upgrade potential compatibility into documented manufacturing capacity.
"""
from __future__ import annotations

import re

from .net_pro_producers_auto1a4 import (
    _Links, _Rows, DIM_CHS, DIM_RHS, GRADE, SHAPE, STANDARD,
)

MAX_HTML_BYTES = 512_000
MAX_DIAGNOSTIC_ROWS = 120
PDF_LINK = re.compile(r"\\.pdf(?:[?#]|$)", re.I)
REASON_CODES = frozenset({
    "exact_candidate", "no_table_rows", "no_eligible_rows",
    "missing_standard", "missing_grade", "missing_shape",
    "missing_dimensions", "split_across_rows",
    "ambiguous_or_rejected", "no_exact_row",
})


def diagnose_detail_html(html: str, exact_candidates: list[dict]) -> dict:
    """Count observable HTML structures; never infer associations across rows.

    This uses the very same bounded HTML row parser and token regexes as A.4.
    Counts are observational metadata, not additional technical assertions.
    """
    rows = _Rows()
    rows.feed(html[:MAX_HTML_BYTES])
    anchors = _Links()
    anchors.feed(html[:MAX_HTML_BYTES])
    counts = {
        "table_rows": min(len(rows.rows), MAX_DIAGNOSTIC_ROWS),
        "eligible_rows": 0,
        "standard_rows": 0,
        "grade_rows": 0,
        "shape_rows": 0,
        "dimension_rows": 0,
        "same_row_all_fields": 0,
        "pdf_links": min(sum(bool(PDF_LINK.search(href)) for href, _ in anchors.links[:1000]), 1000),
        "exact_candidates": min(len(exact_candidates), 20),
    }

    for cells in rows.rows:
        line = " | ".join(cells)
        if not 10 <= len(line) <= 240:
            continue
        counts["eligible_rows"] += 1
        has_standard = STANDARD.search(line) is not None
        has_grade = GRADE.search(line) is not None
        has_shape = SHAPE.search(line) is not None
        has_dimension = DIM_RHS.search(line) is not None or DIM_CHS.search(line) is not None
        counts["standard_rows"] += int(has_standard)
        counts["grade_rows"] += int(has_grade)
        counts["shape_rows"] += int(has_shape)
        counts["dimension_rows"] += int(has_dimension)
        counts["same_row_all_fields"] += int(
            has_standard and has_grade and has_shape and has_dimension
        )

    if counts["exact_candidates"]:
        reason = "exact_candidate"
    elif not counts["table_rows"]:
        reason = "no_table_rows"
    elif not counts["eligible_rows"]:
        reason = "no_eligible_rows"
    elif counts["same_row_all_fields"]:
        reason = "ambiguous_or_rejected"
    elif all(counts[k] for k in (
        "standard_rows", "grade_rows", "shape_rows", "dimension_rows"
    )):
        reason = "split_across_rows"
    elif not counts["standard_rows"]:
        reason = "missing_standard"
    elif not counts["grade_rows"]:
        reason = "missing_grade"
    elif not counts["shape_rows"]:
        reason = "missing_shape"
    elif not counts["dimension_rows"]:
        reason = "missing_dimensions"
    else:
        reason = "no_exact_row"

    assert reason in REASON_CODES
    return {
        "contract": "netproducers-auto1a5-diagnostic-v1",
        "reason": reason,
        **counts,
    }
