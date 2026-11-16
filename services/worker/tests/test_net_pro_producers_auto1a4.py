"""AUTO1.A.4 strict source-local candidate parsing regression tests."""
from app.net_pro_producers_auto1a4 import discover_detail_links, extract_exact_row_candidates

SHA = "a" * 64
ROOT = "https://www.example.it/prodotti/tubi"
SPEC = "https://www.example.it/prodotti/tubi/rhs"


def test_detail_links_official_bounded_and_parent_fingerprint():
    html = ('<a href="/prodotti/tubi/rhs">Technical specifications</a>'
            '<a href="https://evil.test/prodotti/tubi">Technical specifications</a>'
            '<a href="/catalogo.pdf">Datasheet</a>'
            '<a href="/prodotti/tubi/rhs?utm_source=x">Technical specifications</a>'
            '<a href="/privacy">Technical specifications</a>')
    rows = discover_detail_links(html, ROOT, "www.example.it", SHA)
    assert rows == [{"url": SPEC, "parent_url": ROOT, "parent_sha256": SHA, "depth": 2}]
    assert discover_detail_links(html, ROOT, "www.example.it", "invalid") == []
    assert discover_detail_links(html, ROOT, "other.example.it", SHA) == []


def test_exact_rhs_row_candidate_needs_all_fields():
    html = '<table><tr><td>EN 10219</td><td>S355J2H</td><td>RHS</td><td>200×100×6</td></tr></table>'
    rows = extract_exact_row_candidates(html, SPEC, SHA)
    assert len(rows) == 1
    assert rows[0]["dimensions_mm"] == [200.0, 100.0, 6.0]
    assert rows[0]["evidence_status"] == "pending_verification"
    assert rows[0]["locator"] == "table_row:1"


def test_cross_row_cooccurrence_never_becomes_spec():
    html = ('<table><tr><td>EN 10219</td><td>RHS</td></tr>'
            '<tr><td>S355J2H</td><td>200×100×6</td></tr></table>')
    assert extract_exact_row_candidates(html, SPEC, SHA) == []


def test_range_only_does_not_certify_specific_dimension():
    html = '<p>EN 10219 S355J2H RHS 100-300 mm, 4-12 mm</p>'
    assert extract_exact_row_candidates(html, SPEC, SHA) == []


def test_multiple_grades_and_negations_rejected():
    html = ('<table><tr><td>EN 10219 S355J2H S235JR H RHS 200x100x6</td></tr>'
            '<tr><td>EN 10219 S355J2H RHS 200x100x6 not available</td></tr></table>')
    assert extract_exact_row_candidates(html, SPEC, SHA) == []


def test_shs_geometry_and_fingerprint():
    html = ('<table><tr><td>EN 10219 S355J2H SHS 100x100x5</td></tr>'
            '<tr><td>EN 10219 S355J2H SHS 200x100x6</td></tr></table>')
    result = extract_exact_row_candidates(html, SPEC, SHA)
    assert len(result) == 1
    assert result[0]["shape"] == "SHS"
    assert extract_exact_row_candidates(html, SPEC, "bad") == []
