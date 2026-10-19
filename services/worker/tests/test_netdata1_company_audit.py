from unittest.mock import AsyncMock, patch
from app.netdata1_company_audit import page,CONTRACT
import pytest

UID="65ed14a0-44ae-46bc-8c59-ad2f5e4a85b2"
OTHER="65ed14a0-44ae-46bc-8c59-ad2f5e4a85b3"

class DB:
 def __init__(self,items,contract=CONTRACT):
  self.payload={"contract":contract,"items":items,"profiles_total":501}
 def rpc(self,name,args):
  self.name=name;self.args=args
  return self
 def execute(self):
  return type("Response",(),{"data":self.payload})()

def valid():
 return {"company_id":UID,"kind":"canonical","domain":"example-manufacturer.it",
  "site":"https://www.example-manufacturer.it/contatti",
  "source_identity_status":"site_domain_matches_unconfirmed_identity"}

def test_audit_includes_all_profiles_and_selects_exact_source_domain():
 db=DB([valid(),{"company_id":OTHER,"kind":"discovered",
            "source_identity_status":"needs_official_source","site":None}])
 snapshot,entries=page(db,limit=2,offset=499)
 assert snapshot["profiles_total"]==501
 assert len(entries)==1
 assert entries[0]["kind"]=="canonical"
 assert db.name=="netdata1_company_audit"
 assert db.args=={"p_limit":2,"p_offset":499}

def test_invalid_bounds_fail_closed():
 db=DB([valid()])
 for limit,offset in ((0,0),(26,0),(25,-1),(25,10001)):
  with pytest.raises(ValueError): page(db,limit=limit,offset=offset)

def test_invalid_contract_and_unsafe_domains_fail_closed():
 with pytest.raises(ValueError):page(DB([valid()],contract="evil"))
 with pytest.raises(ValueError):page(DB([dict(valid(),site="http://example-manufacturer.it/")]))
 with pytest.raises(ValueError):page(DB([dict(valid(),site="https://other.example/")]))
 with pytest.raises(ValueError):page(DB([dict(valid(),source_identity_status="shared_domain_identity_review")]))
 with pytest.raises(ValueError):page(DB([valid(),dict(valid(),company_id=OTHER)]),limit=3)

def test_no_candidate_if_source_requires_identity_review():
 a={"company_id":UID,"kind":"discovered","site":None,
    "source_identity_status":"shared_domain_identity_review"}
 db=DB([a])
 snapshot,entries=page(db)
 assert snapshot["profiles_total"]==501 and entries==[]
