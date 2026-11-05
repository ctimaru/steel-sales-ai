"""Research-only F.2: 21 candidates; 31 incl. F.1, no import permitted."""
import json
from pathlib import Path
from urllib.parse import urlsplit

DATA = Path(__file__).resolve().parents[1]/"data"/"netgrowth3f2_industrial_research_20261105.json"
BASE = DATA.with_name("netgrowth3f_first_party_research_20261105.json")


def test_f2_is_not_ready_for_import_and_is_distinct_from_f1():
    p = json.loads(DATA.read_text(encoding="utf-8"))
    f1 = json.loads(BASE.read_text(encoding="utf-8"))
    assert p["mode"] == "research_only" and p["allow_import"] is False
    assert "batch" not in p and "kind" not in p
    assert len(p["records"]) == 21 and len(f1["records"]) == 10
    assert sum(r["role"]=="producer" for r in p["records"])==2
    assert sum(r["role"]=="processor_service_provider" for r in p["records"])==19
    assert not {r["domain"] for r in p["records"]}&{r["domain"] for r in f1["records"]}
    assert not {r["domain"] for r in p["records"]}&{r["domain"] for r in p["exclusions"]}
    for r in p["records"]:
        assert r["review_state"] == "research_candidate"
        assert r["legal_identity_status"] == "pending_independent_review"
        assert r["source_rights"] == "pending_independent_review"
        for u in [r["source_url"],r["identity_evidence_url"]]+[c["source_url"] for c in r["claims"]]:
            p_url=urlsplit(u)
            assert p_url.scheme=="https" and not p_url.username and not p_url.password
            assert p_url.hostname.removeprefix("www.") == r["domain"]
        assert all(c["review_state"]=="candidate_first_party" for c in r["claims"])
        assert not any(k in r for k in ("email","phone","contact","verified","stock","price"))
