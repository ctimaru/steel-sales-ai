from app.netfast2_wikidata_feed import parse_bindings, sparql
import pytest

def binding(qid,site,label):
    return {"item":{"value":"http://www.wikidata.org/entity/"+qid},
       "website":{"value":site},"label":{"value":label}}

def test_only_structured_cc0_italian_industry_query():
    query=sparql("Q2285982",0)
    assert "wdt:P17 wd:Q38" in query
    assert "wdt:P452 wd:Q2285982" in query
    assert "wdt:P856 ?website" in query
    assert "LIMIT 100" in query
    assert "FILTER NOT EXISTS" in query
    with pytest.raises(ValueError): sparql("Q999999999",0)
    with pytest.raises(ValueError): sparql("Q190117",1000)

def test_parse_strict_qid_and_domain_prevents_false_volume():
    payload={"results":{"bindings":[
      binding("Q12345","https://www.acciai-verdi.it/en/","Acciai Verdi S.p.A."),
      binding("Q12345","https://www.acciai-verdi.it/en/","Acciai Verdi"),
      binding("Q12346","https://facebook.com/steel","Facebook"),
      binding("Q12347","https://example.it/","John <private>"),
      binding("not-a-qid","https://manufacturer.it/","Producer Company"),
      binding("Q12348","http://metal-factory.it/","Metal Factory"),
    ]}}
    rows=parse_bindings(payload,"Q1924906")
    assert len(rows)==1
    assert rows[0]["domain"]=="acciai-verdi.it"
    assert rows[0]["website"]=="https://acciai-verdi.it/"
    assert rows[0]["qid"]=="Q12345"
    assert rows[0]["industry_qid"]=="Q1924906"

def test_reject_unbounded_payload():
    with pytest.raises(ValueError):
      parse_bindings({"results":{"bindings":[binding("Q42","https://abc.it/","ABC")]*101}},"Q190117")
