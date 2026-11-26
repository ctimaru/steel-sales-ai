"""Focused geographic evidence tests: no network or database writes."""
from app.company_discovery import CrawledPage, _it_priority_links, _it_text_localities, extract_candidate

def page(text="", url="https://example.it/", links=()):
    return CrawledPage(url=url, title="Example S.r.l.", site_name="Example S.r.l.",
                       meta_description=None, h1=None, text=text, links=links)

def test_contact_page_reserves_one_slot_and_respects_domain():
    p = page(links=("/prodotti", "/azienda", "/servizi", "/lavorazioni",
                    "https://other.it/contatti", "/contatti"))
    assert _it_priority_links(p) == ["https://example.it/contatti",
        "https://example.it/prodotti", "https://example.it/azienda", "https://example.it/servizi"]

def test_address_after_initial_snippet_is_preserved_verbatim():
    excerpt = "Via Roma, 12 - 25017 Lonato del Garda (BS)"
    p = page("Carpenteria metallica e lavorazione acciaio. " + "testo " * 300 + excerpt)
    hits = _it_text_localities([p], "example.it")
    assert len(hits) == 1
    assert hits[0]["source_excerpt"] == excerpt
    assert hits[0]["city"] == "Lonato del Garda"
    assert hits[0]["province_code"] == "BS"
    candidate = extract_candidate([p], "IT")
    assert candidate is not None
    assert any(e["snippet"] == excerpt for e in candidate["evidence"])

def test_no_inference_or_cross_domain_or_customer_address():
    assert not _it_text_localities([page("Via Roma, 12 - 25017 Lonato del Garda")], "example.it")
    assert not _it_text_localities([page("Via Roma, 12 - 25017 Lonato del Garda (BS)", "https://other.it/contatti")], "example.it")
    assert not _it_text_localities([page("Cliente: Via Roma, 12 - 25017 Lonato del Garda (BS)")], "example.it")
    assert not _it_text_localities([page("Via Roma, 12 - 25017 Lonato del Garda (BS)", "https://example.it/news")], "example.it")

def test_multiple_locations_are_not_silently_resolved():
    text = "Carpenteria metallica e lavorazione acciaio. " + "testo " * 300
    p = page(text + "Via Roma, 12 - 25017 Lonato del Garda (BS) | Via Milano, 5 - 24060 Endine Gaiano (BG)")
    assert len(_it_text_localities([p], "example.it")) == 2
    candidate = extract_candidate([p], "IT")
    assert candidate is not None and len(candidate["evidence"]) == 1
