from __future__ import annotations

from app.net_intel1_fields import industrial_evidence


def _outcome(text: str):
    return {
        "status": "candidate_only",
        "source_website": "https://tubificio.example/",
        "evidence": [{"url": "https://www.tubificio.example/prodotti", "snippet": text}],
    }


def test_producer_requires_direct_tube_evidence():
    result = industrial_evidence(
        _outcome("Produciamo tubi saldati in acciaio e profilati cavi EN 10219."),
        "2026-11-15T20:00:00Z",
    )
    fields = {r["field_key"]: r for r in result}
    assert fields["products"]["field_value"]["explicit_relationships"] == [
        {"family": "tubes_pipes", "relationship": "produces"}
    ]
    assert fields["products"]["field_value"]["standards_mentioned_unlinked"] == ["EN 10219"]
    assert fields["products"]["field_value"]["verified_scope"] is False
    assert fields["industry"]["field_value"] == ["producer"]


def test_generic_supplier_production_does_not_make_trader_a_manufacturer():
    result = industrial_evidence(
        _outcome("Vendita di tubi in acciaio. La produzione dei nostri fornitori è ampia."),
        "2026-11-15T20:00:00Z",
    )
    fields = {r["field_key"]: r for r in result}
    assert fields["industry"]["field_value"] == ["trader_distributor"]
    assert fields["products"]["field_value"]["explicit_relationships"] == [
        {"family": "tubes_pipes", "relationship": "distributes"}
    ]


def test_services_need_source_phrase():
    result = industrial_evidence(
        _outcome("Carpenteria metallica e taglio laser tubi in acciaio."),
        "2026-11-15T20:00:00Z",
    )
    assert any(r["field_key"] == "services" and "laser_cutting" in r["field_value"] for r in result)


def test_unrelated_domain_not_allowed():
    outcome = _outcome("Produciamo tubi in acciaio.")
    outcome["evidence"][0]["url"] = "https://competitor.example/"
    assert industrial_evidence(outcome, "2026-11-15T20:00:00Z") == []


def test_unqualified_company_does_not_create_claims():
    outcome = _outcome("Produciamo tubi in acciaio.")
    outcome["status"] = "insufficient_steel_evidence"
    assert industrial_evidence(outcome, "2026-11-15T20:00:00Z") == []
