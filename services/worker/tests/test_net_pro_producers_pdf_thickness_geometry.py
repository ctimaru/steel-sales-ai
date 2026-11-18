"""C3: thickness requires physical column correspondence, never weight inference."""
import pytest

from app.net_pro_producers_pdf_thickness_geometry import Cell, observed_thickness_cells


def test_same_column_occupied_thickness_slots():
    cells = [
        Cell(2, 10, 0, 90, 310, "Thickness"),
        Cell(2, 11, 2, 150, 175, "5"),
        Cell(2, 11, 3, 200, 225, "6"),
        Cell(2, 12, 0, 5, 40, "200"),
        Cell(2, 12, 1, 45, 80, "100"),
        Cell(2, 12, 2, 152, 175, "22,3"),
        Cell(2, 12, 3, 203, 225, "26,4"),
    ]
    result = observed_thickness_cells(cells)
    assert [x["thickness_mm"] for x in result] == [5, 6]
    assert all(x["evidence_status"] == "pending_producer_confirmation" for x in result)
    assert all(len(x["geometry_sha256"]) == 64 for x in result)


def test_misaligned_weight_rejected():
    cells = [Cell(1, 1, 0, 90, 310, "Thickness"),
             Cell(1, 2, 2, 150, 175, "5"),
             Cell(1, 3, 2, 190, 220, "22,3")]
    assert observed_thickness_cells(cells) == []


def test_missing_header_rejected():
    assert observed_thickness_cells([
        Cell(1, 2, 2, 150, 175, "5"),
        Cell(1, 3, 2, 150, 175, "22,3")]) == []


def test_ambiguous_grid_rejected():
    cells = [Cell(1, 1, 0, 90, 310, "Thickness"),
             Cell(1, 2, 2, 150, 175, "5"),
             Cell(1, 3, 2, 150, 175, "22,3"),
             Cell(1, 3, 2, 150, 175, "26,4")]
    with pytest.raises(ValueError, match="Ambiguous"):
        observed_thickness_cells(cells)
