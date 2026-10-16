from app.netlaunch2_wikidata_density import sparql,parse_bindings,SECTORS
import pytest

def item(qid,name,site):
 return {"item":{"value":"http://www.wikidata.org/entity/"+qid},
 "label":{"value":name},"website":{"value":site}}
def test_industry_queries_use_wikidata_country_website_and_actual_named_entity():
 for sector in SECTORS:
  s=sparql(sector,0)
  assert "wdt:P17 wd:Q38" in s
  assert "wdt:P452 wd:"+sector in s
  assert "wdt:P856 ?website" in s
  assert "rdfs:label" in s and "LIMIT 100" in s
 for bad in ("Q5","Q50000000000000"):
  with pytest.raises(ValueError):sparql(bad,0)
 for n in (-100,1,2050):
  with pytest.raises(ValueError):sparql("Q1957908",n)
def test_real_qid_is_stored_instead_of_industry_qid():
 industry="Q190117"
 data={"results":{"bindings":[
  item("Q27586","Ferrari","https://www.ferrari.com/"),
  item("Q27586","Ferrari","https://www.ferrari.com/en"),
  item("Q27587","Marca Old","http://old.example/"),
  item("Q26823","Abarth","https://www.abarth.com/"),
  item("Q9944","Bad address","https://linkedin.com/company/example"),
  item("Q9711","Bad url","https://example.invalid:8080/"),
 ]}}
 rows,n=parse_bindings(data,industry)
 assert n==6
 assert len(rows)==2
 assert rows[0]["qid"]=="Q27586"
 assert rows[0]["industry_qid"]=="Q190117"
 assert rows[0]["website"]=="https://ferrari.com/"
 assert rows[1]["qid"]=="Q26823"
def test_response_bounds_and_malformed_rows():
 with pytest.raises(ValueError):parse_bindings({"results":{"bindings":[{}]*101}},"Q190117")
 with pytest.raises(ValueError):parse_bindings({"results":{"bindings":"oops"}},"Q190117")
 rows,n=parse_bindings({"results":{"bindings":[{"item":{"value":"http://www.wikidata.org/entity/Q5"}}]}},"Q1957908")
 assert rows==[] and n==1
