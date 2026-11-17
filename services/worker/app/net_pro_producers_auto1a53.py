"""AUTO1.A.5.3 — hash only *observed* technical table rows, not a manufacturing claim.

A full-page byte SHA is always authoritative for source provenance and A4
candidate acceptance. This additional fingerprint is only a bounded private
diagnostic: it can distinguish a changed HTML shell from unchanged *detected
technical rows* in a FUTURE, separately verified snapshot. It does not imply
that all technical information on the site is unchanged.
"""
from __future__ import annotations

import hashlib
import re

from .net_pro_producers_auto1a4 import (
    _Rows, STANDARD, GRADE, SHAPE, DIM_RHS, DIM_CHS, MAX_ROWS,
)

MAX_HTML_BYTES = 512_000
TECHNICAL_FINGERPRINT_CONTRACT = "netproducers-auto1a53-row-fingerprint-v1"


def fingerprint_technical_rows(html: str) -> dict:
    """Deterministic table-row fingerprint; no HTML, claims or excerpts returned.

    Rows with at least one technical signal are included in document order.
    The original A4 table extraction and 10..240 character row limit apply.
    A page with no detected technical rows has *no comparable signature*.
    """
    rows = _Rows()
    rows.feed(html[:MAX_HTML_BYTES])
    selected: list[str] = []
    for cells in rows.rows:
        line = " | ".join(cells)
        if not 10 <= len(line) <= 240:
            continue
        if not any(p.search(line) for p in (
            STANDARD, GRADE, SHAPE, DIM_RHS, DIM_CHS
        )):
            continue
        # Ignore HTML markup, indentation, case and incidental whitespace.
        # Retain full observed technical text, cell boundaries, row order,
        # dimensions, units and negation: never extract a partial "claim".
        normalized = " | ".join(
            " ".join(cell.casefold().split()) for cell in cells
        )
        normalized = re.sub(r"\s*[×]\s*", "x", normalized)
        selected.append(normalized)

    assert len(selected) <= MAX_ROWS
    digest = hashlib.sha256(
        ("a53-v1\n" + "\n".join(selected)).encode("utf-8")
    ).hexdigest() if selected else None

    return {
        "contract": TECHNICAL_FINGERPRINT_CONTRACT,
        "technical_rows": len(selected),
        "technical_sha256": digest,
    }
