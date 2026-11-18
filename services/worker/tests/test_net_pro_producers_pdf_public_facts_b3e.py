"""Bounded B3.E first-party factual PDF observation."""
import pytest
from app.net_pro_producers_catalog_b1 import CatalogueRejected
from app import net_pro_producers_pdf_public_facts_b3e as b3e

URL = "https://alessiotubi.it/files/catalog.pdf"
DOMAIN = "alessiotubi.it"


def _mock_pipeline(monkeypatch):
    monkeypatch.setattr(b3e, "_robots_allows", lambda *a: True)
    monkeypatch.setattr(b3e, "bounded_official_pdf", lambda *a: b"%PDF-dummy")
    monkeypatch.setattr(b3e, "_read_pdf_lines", lambda *a: [{"page":1,"lines":["RECTANGULAR EN 10219 - theoretical weight kg/m"]}])
    monkeypatch.setattr(b3e, "read_pdf_text_origins", lambda *a: [{"page":1,"spans":[]}])
    rows = [{"page":1,"standard":"EN 10219","shape":"RHS",
             "width_mm":200,"height_mm":100,"locator":"pdf_page:1:table:rhs_en10219:row:200x100"}]
    monkeypatch.setattr(b3e, "extract_pdf_table_sizes", lambda *a: {"rows":rows})
    monkeypatch.setattr(b3e, "extract_positioned_thickness", lambda *a: {
        "candidate_rows":[{"thickness_mm":6,"geometry_sha256":"f"*64}],
        "ambiguous_rows":0,
    })


def _call(**kwargs):
    return b3e.observe_pdf_source(
        object(), company_id="c", source_url=URL, canonical_domain=DOMAIN,
        source_status="official_link_observed", rights_status="link_only",
        allow_factual_observation=True, **kwargs
    )


def test_dry_run_inspects_but_does_not_stage(monkeypatch):
    _mock_pipeline(monkeypatch)
    monkeypatch.setattr(b3e, "stage_pdf_table_sizes", lambda *a: pytest.fail("write in dry run"))
    result = _call(dry_run=True)
    assert result["dimension_candidates"] == result["thickness_candidates"] == 1
    assert result["staged_thickness"] == result["published_claims"] == 0
    assert result["dry_run"] is True


def test_service_stages_dimension_before_geometry(monkeypatch):
    _mock_pipeline(monkeypatch)
    order=[]
    def size(*args):
        order.append("size")
        return {"size_rows_new":1}
    def geometry(*args):
        order.append("geometry")
        return {"added":1}
    monkeypatch.setattr(b3e, "stage_pdf_table_sizes", size)
    monkeypatch.setattr(b3e, "stage_positioned_thickness", geometry)
    result=_call(dry_run=False)
    assert order == ["size","geometry"]
    assert result["staged_dimensions"]==result["staged_thickness"]==1
    assert result["manufacturer_confirmed"] == 0


@pytest.mark.parametrize("change",[
    {"allow_factual_observation":False},
    {"source_status":"unverified"},
    {"rights_status":"not_allowed"},
    {"canonical_domain":"different.example"},
])
def test_denied_source_is_never_fetched(monkeypatch,change):
    monkeypatch.setattr(b3e, "_robots_allows", lambda *a: pytest.fail("robots called"))
    monkeypatch.setattr(b3e, "bounded_official_pdf", lambda *a: pytest.fail("PDF fetched"))
    args=dict(company_id="c",source_url=URL,canonical_domain=DOMAIN,
              source_status="official_link_observed",rights_status="link_only",
              allow_factual_observation=True,dry_run=False)
    args.update(change)
    with pytest.raises(CatalogueRejected):
        b3e.observe_pdf_source(object(),**args)


def test_denied_robots_cannot_stage(monkeypatch):
    monkeypatch.setattr(b3e,"_robots_allows",lambda *args:False)
    monkeypatch.setattr(b3e,"bounded_official_pdf",lambda *a:pytest.fail("PDF fetched"))
    with pytest.raises(CatalogueRejected,match="robots"):
        _call(dry_run=False)


def test_non_pdf_and_cross_host_rejected_before_dns():
    with pytest.raises(CatalogueRejected):
        b3e.bounded_official_pdf("https://alessiotubi.it/catalog.html",DOMAIN)
    with pytest.raises(CatalogueRejected):
        b3e.bounded_official_pdf("https://evil.example/catalog.pdf",DOMAIN)
