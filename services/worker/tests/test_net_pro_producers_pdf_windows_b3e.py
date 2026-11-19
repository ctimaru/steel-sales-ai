"""Real PDF fixture tests for bounded B3.E multi-window extraction."""
from io import BytesIO

import pytest
from pypdf import PdfWriter

from app.net_pro_producers_catalog_b1 import CatalogueRejected
from app.net_pro_producers_pdf_windows_b3e import read_pdf_fact_window


def blank_catalogue(page_count: int) -> bytes:
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=595, height=842)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_44_page_pdf_processes_15_15_14_with_absolute_page_ids():
    pdf = blank_catalogue(44)
    first = read_pdf_fact_window(pdf)
    second = read_pdf_fact_window(pdf, start_page=16)
    third = read_pdf_fact_window(pdf, start_page=31)
    assert [len(x["pages"]) for x in (first, second, third)] == [15, 15, 14]
    assert all(x["total_pages"] == 44 for x in (first, second, third))
    assert [[p["page"] for p in x["pages"]] for x in (first, second, third)] == [
        list(range(1, 16)), list(range(16, 31)), list(range(31, 45))]
    assert [p["page"] for p in third["positions"]] == list(range(31, 45))


@pytest.mark.parametrize("number", [0, 61, True])
def test_invalid_window_offsets_are_rejected(number):
    with pytest.raises(CatalogueRejected):
        read_pdf_fact_window(blank_catalogue(2), start_page=number)


def test_pdfs_over_60_pages_are_bounded():
    with pytest.raises(CatalogueRejected):
        read_pdf_fact_window(blank_catalogue(61))


def test_non_pdf_bytes_are_never_sent_to_child():
    with pytest.raises(CatalogueRejected):
        read_pdf_fact_window(b"not a pdf")
