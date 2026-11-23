"""NET-PRODUCERS-FILTERS2 · passo 3: short facts from official PDF pages."""
from app.net_pro_producers_pdf_claims_f2 import extract_pdf_short_facts, MAX_FACTS_PER_DOCUMENT


def values(result, kind):
    return [f["value"] for f in result["facts"] if f["kind"] == kind]


def test_product_page_yields_standards_grades_processes_shapes():
    pages = [{"page": 4, "lines": [
        "TUBI SALDATI FORMATI A FREDDO - COLD FORMED WELDED HOLLOW SECTIONS",
        "Norma di riferimento: UNI EN 10219-1 / EN 10219-2",
        "Qualità: S235JRH - S275J0H - S355 J2H",
        "Tubi tondi, tubi quadri e tubi rettangolari",
        "Saldatura longitudinale ad alta frequenza (HFI)",
    ]}]
    out = extract_pdf_short_facts(pages)
    assert values(out, "technical_standard") == ["EN 10219-1", "EN 10219-2"]
    assert values(out, "steel_grade") == ["S235JRH", "S275J0H", "S355J2H"]
    assert set(values(out, "manufacturing_process")) == {
        "Tubi saldati", "Formati a freddo", "Saldatura longitudinale", "Saldatura ad alta frequenza"}
    assert values(out, "section_shape") == ["Tondo", "Quadro", "Rettangolare"]
    assert all(f["page"] == 4 and len(f["line_sha256"]) == 64 for f in out["facts"])


def test_certifications_and_execution_standards_are_not_product_standards():
    pages = [{"page": 2, "lines": [
        "Tubi in acciaio certificati UNI EN ISO 9001:2015 e EN 1090-1",
        "Certificato di ispezione EN 10204 3.1",
        "ISO 14001 ambiente",
    ]}]
    out = extract_pdf_short_facts(pages)
    assert values(out, "technical_standard") == []


def test_index_pages_and_toc_lines_are_skipped():
    pages = [
        {"page": 1, "lines": ["INDICE", "Tubi EN 10219 ........ 12", "Tubi EN 10255 ........ 18"]},
        {"page": 2, "lines": ["Tubi EN 10305-4 ........ 20"]},
    ]
    out = extract_pdf_short_facts(pages)
    assert out["facts"] == []
    assert out["pages_skipped"] == 2


def test_unknown_codes_and_ambiguous_tokens_are_ignored():
    pages = [{"page": 3, "lines": [
        "Tubi per oleodinamica EN 99999, ASTM A999, codice L360 lunghezza 6 m",
        "Via E 235, magazzino 2",
        "Tubi di precisione E235+C e E355 secondo EN 10305-1",
    ]}]
    out = extract_pdf_short_facts(pages)
    assert values(out, "technical_standard") == ["EN 10305-1"]
    assert values(out, "steel_grade") == ["E235+C", "E355"]


def test_stainless_and_pressure_grades():
    pages = [{"page": 5, "lines": [
        "Tubi inox AISI 304L / AISI 316L (1.4307 - 1.4404) EN 10217-7",
        "Tubi per pressione P235GH TC1, P265 TR2 secondo EN 10216-2 e ASTM A 106",
        "Seamless tubes cold drawn",
    ]}]
    out = extract_pdf_short_facts(pages)
    assert set(values(out, "steel_grade")) == {"AISI 304L", "AISI 316L", "1.4307", "1.4404", "P235GH", "P265TR2"}
    assert set(values(out, "technical_standard")) == {"EN 10217-7", "EN 10216-2", "ASTM A106"}
    assert set(values(out, "manufacturing_process")) == {"Senza saldatura", "Trafilati a freddo"}


def test_one_fact_per_value_first_page_wins_and_cap():
    pages = [{"page": 2, "lines": ["Tubi S355J2H EN 10219"]}, {"page": 7, "lines": ["Tubi S355J2H EN 10219"]}]
    out = extract_pdf_short_facts(pages)
    assert [(f["value"], f["page"]) for f in out["facts"]] == [("EN 10219", 2), ("S355J2H", 2)]
    many = [{"page": 1, "lines": ["Tubi " + " ".join(f"EN {n}" for n in (
        "10025", "10028", "10088", "10149", "10208", "10210", "10216", "10217", "10219", "10220",
        "10224", "10225", "10255", "10296", "10297", "10305", "10312", "10357", "10358", "10083"))]},
            {"page": 2, "lines": ["Tubi " + " ".join(f"AISI {g}" for g in (
        "201", "202", "301", "304", "304L", "309", "309S", "310", "310S", "316", "316L", "316Ti",
        "321", "409", "410", "420", "430", "439", "441", "444", "904L"))]}]
    capped = extract_pdf_short_facts(many)
    assert len(capped["facts"]) == MAX_FACTS_PER_DOCUMENT and capped["truncated"] is True


def test_page_without_product_words_needs_two_kinds():
    lone = [{"page": 9, "lines": ["Riferimento EN 10255 per il listino"]}]
    assert extract_pdf_short_facts(lone)["facts"] == []
    pair = [{"page": 9, "lines": ["EN 10255", "S195T e S235JRH"]}]
    assert values(extract_pdf_short_facts(pair), "technical_standard") == ["EN 10255"]


# ---------------------------------------------------------------- queue runner
import pytest
from app.net_pro_producers_pdf_claims_f2 import run_f2_claims_queue


class _Exec:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return self


class FakeDb:
    def __init__(self, items):
        self.items = items
        self.calls = []

    def rpc(self, name, params):
        assert name == "netproducers3_pdf_claims"
        op, payload = params["p_operation"], params["p_payload"]
        self.calls.append((op, payload))
        base = {"contract": "netproducers3-pdf-claims-v1", "operation": op}
        if op == "seed":
            return _Exec({**base, "added": 0})
        if op == "claim":
            return _Exec({**base, "items": self.items, "count": len(self.items)})
        if op == "stage":
            return _Exec({**base, "added": len(payload["facts"])})
        return _Exec({**base, "updated": 1})


ITEM = {"company_id": "c1", "source_url": "https://acme.it/cat.pdf", "lease_token": "t1",
        "canonical_domain": "acme.it", "source_status": "official_link_observed", "rights_status": "link_only"}
PAGES = [{"page": 3, "lines": ["Tubi saldati EN 10219 S355J2H"]}]


def test_review_mode_never_stages_and_reports_facts():
    db = FakeDb([ITEM])
    report = run_f2_claims_queue(db, mode="review", read_pages=lambda u, d: PAGES)
    ops = [op for op, _ in db.calls]
    assert "stage" not in ops
    assert ops[-1] == "complete" and db.calls[-1][1]["status"] == "inspected"
    assert report["review"][0]["facts"] == [
        {"kind": "technical_standard", "value": "EN 10219", "page": 3},
        {"kind": "steel_grade", "value": "S355J2H", "page": 3},
        {"kind": "manufacturing_process", "value": "Tubi saldati", "page": 3},
    ]
    assert report["published"] == 0


def test_publish_mode_stages_then_completes():
    db = FakeDb([ITEM])
    report = run_f2_claims_queue(db, mode="publish", read_pages=lambda u, d: PAGES)
    ops = [op for op, _ in db.calls]
    assert ops == ["seed", "claim", "stage", "complete"]
    assert db.calls[-1][1]["status"] == "complete" and report["published"] == 3


def test_source_errors_are_isolated():
    from app.net_pro_producers_catalog_b1 import CatalogueRejected

    def blocked(u, d):
        raise CatalogueRejected("robots")

    db = FakeDb([ITEM])
    report = run_f2_claims_queue(db, mode="publish", read_pages=blocked)
    assert report["blocked"] == 1 and db.calls[-1][1]["status"] == "blocked"

    def broken(u, d):
        raise RuntimeError("boom")

    db = FakeDb([ITEM])
    assert run_f2_claims_queue(db, mode="publish", read_pages=broken)["retry"] == 1


def test_bad_mode_rejected():
    with pytest.raises(ValueError):
        run_f2_claims_queue(FakeDb([]), mode="auto")
