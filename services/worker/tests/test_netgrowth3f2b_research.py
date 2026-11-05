"""NET-GROWTH3.F.2B: 50 domain candidates, zero import authorization."""
import json
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]/"data"
FILES=["netgrowth3f_first_party_research_20261105.json",
       "netgrowth3f2_industrial_research_20261105.json",
       "netgrowth3f2b_industrial_research_20261105.json"]


def load():
    return [json.loads((ROOT/f).read_text(encoding="utf-8")) for f in FILES]


def test_50_distinct_research_domains_not_import_ready():
    a,b,c=load()
    assert [len(x["records"]) for x in (a,b,c)]==[10,21,19]
    records=a["records"]+b["records"]+c["records"]
    assert len(records)==50
    assert len({r["domain"] for r in records})==50
    assert len({r["name"].lower().strip() for r in records})==50
    assert c["mode"]=="research_only" and c["allow_import"] is False
    assert "batch" not in c and "kind" not in c
    assert sum(r["role"]=="producer" for r in c["records"])==5
    assert sum(r["role"]=="processor_service_provider" for r in c["records"])==14
    assert sum(r["role"]=="producer" for r in records)==12
    assert sum(r["role"]=="processor_service_provider" for r in records)==38


def test_all_19_have_evidence_and_explicit_reviewer_gates():
    p=load()[2]
    for r in p["records"]:
        assert r["country"]=="IT"
        assert r["legal_identity_status"]=="pending_independent_review"
        assert r["source_rights"]=="pending_independent_review"
        assert r["role_review_status"]=="candidate_first_party"
        assert r["claims"]
        for u in [r["source_url"],r["identity_evidence_url"]]+[c["source_url"] for c in r["claims"]]:
            z=urlsplit(u)
            assert z.scheme=="https" and not z.username and not z.password and z.port is None
            assert (z.hostname or "").removeprefix("www.").lower()==r["domain"]
        assert all(c["status"]=="candidate_first_party" for c in r["claims"])
        assert not any(k in r for k in ("email","phone","contact","price","stock","verified_supplier","verified_buyer"))
    assert not {r["domain"] for r in p["records"]}&{x["domain"] for x in p["exclusions_from_count"]}
    assert {x["domain"] for x in p["known_legal_holds"]}=={"dematubi.it","amarossi.it"}
