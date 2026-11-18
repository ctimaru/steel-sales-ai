"""C3 coordinate extractor: bounded, isolated and evidence-only."""
from __future__ import annotations

import pytest

from app.net_pro_producers_catalog_b1 import CatalogueRejected
from app.net_pro_producers_pdf_positions_c3 import (
    read_pdf_text_origins, position_diagnostics,
)
from test_net_pro_producers_catalog_b3b_pdf import pdf_bytes


def test_real_pdf_origin_capture_without_sku_inference():
    source = pdf_bytes([
        "RECTANGULAR EN 10219 - theoretical weight kg/m",
        "Thickness",
        "4 5 6 8 10",
        "200 100 18 22,3 26,4",
    ])
    pages = read_pdf_text_origins(source)
    assert len(pages) >= 1
    assert all("page" in p and "spans" in p for p in pages)
    summary = position_diagnostics(pages)
    assert summary["pages"] >= 1
    assert summary["dimension_thickness_pairs_verified"] == 0
    assert summary["producer_skus_confirmed"] == 0


def test_bad_pdf_never_reaches_position_extractor():
    for raw in (b"", b"not a pdf", b"%PDF-" + b"x" * (8 * 1024 * 1024)):
        with pytest.raises(CatalogueRejected):
            read_pdf_text_origins(raw)


def test_diagnostic_does_not_expose_pdf_text():
    pages = [{"page": 1, "spans": [{"x": 100, "y": 200, "size": 12,
               "text": "S355J2H 200x100x6"}]}]
    diagnostic = position_diagnostics(pages)
    assert "S355J2H" not in str(diagnostic)
    assert diagnostic["producer_skus_confirmed"] == 0
