"""Keep real technical requirements unknown unless a first-party claim matches exactly."""
from app.netgrowth3f2_qualification import qualify


def candidate():
    return {"domain":"sample.example","source_url":"https://sample.example/tubi",
            "review_state":"research_candidate","role":"processor_service_provider",
            "claims":[{"type":"process","value":"taglio laser tubi",
                       "source_url":"https://sample.example/tubi",
                       "review_state":"candidate_first_party"}]}


def test_no_unverified_structural_dimensions_or_grade():
    r=qualify(candidate(),{"role":"processor_service_provider","process":"taglio laser tubi",
                            "standard":"EN 10219","grade":"S355","dimension":"100x100x6"})
    assert sorted(r["matched"])==["process","role"]
    assert r["unknown"]==["dimension","grade","standard"]
    assert r["full_spec_documented"] is False
    assert r["rfq_allowed"] is False and r["stock_confirmed"] is False


def test_even_exact_process_does_not_make_a_verified_supplier():
    r=qualify(candidate(),{"process":"taglio laser tubi"})
    assert r["full_spec_documented"] is True
    assert r["supplier_verified"] is False and r["rfq_allowed"] is False


def test_bad_or_cross_domain_source_never_counts():
    r=candidate()
    r["claims"][0]["source_url"]="https://other.example/tubi"
    assert qualify(r,{"process":"taglio laser tubi"})["unknown"]==["process"]
    r["source_url"]="http://sample.example/tubi"
    assert qualify(r,{"process":"taglio laser tubi"})["status"]=="hold"
