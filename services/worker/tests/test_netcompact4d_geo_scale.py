from __future__ import annotations
from unittest.mock import MagicMock
import pytest
from app.netcompact4d_geo_scale import next_batch, source_audit

COMPANY="65ed14a0-44ae-46bc-8c59-ad2f5e4a85b2"
def row():
    return dict(kind="discovered",company_id=COMPANY,
      company_name="Test Manufacturer",site="https://example-manufacturer.it/",
      domain="example-manufacturer.it")

class Db:
    def __init__(self,result):
        self.result=result
    def rpc(self,name,args):
        self.name=name
        self.args=args
        return self
    def execute(self):
        return type("Response",(),{"data":self.result})()

def test_next_batch_validates_service_contract_and_exact_domain():
    db=Db({"contract":"netcompact4d-next-geo-v1","eligible":388,
           "limit":5,"items":[row()]})
    rows,total=next_batch(db,5)
    assert total==388 and len(rows)==1
    assert rows[0]["domain"]=="example-manufacturer.it"
    assert db.name=="netcompact4d_next_discovered_geo_batch"
    assert db.args=={"p_limit":5}

def test_next_batch_cannot_read_outside_batch_limit():
    db=Db({"contract":"netcompact4d-next-geo-v1","items":[row()]})
    with pytest.raises(ValueError):
        next_batch(db,26)
    with pytest.raises(ValueError):
        next_batch(db,0)

def test_next_batch_rejects_duplicates_and_unbound_company_domains():
    db=Db({"contract":"netcompact4d-next-geo-v1","eligible":2,
           "items":[row(),dict(row(),company_id="09e0a9d3-71d1-4095-86a9-12e88c3e316e")]})
    with pytest.raises(ValueError):
        next_batch(db,5)
    db.result["items"]=[dict(row(),site="https://wrong-domain.example/")]
    with pytest.raises(ValueError):
        next_batch(db,5)

def test_next_batch_rejects_wrong_kind_or_contract():
    db=Db({"contract":"unexpected","items":[row()]})
    with pytest.raises(ValueError):
        next_batch(db,5)
    db.result={"contract":"netcompact4d-next-geo-v1","items":[dict(row(),kind="canonical")]}
    with pytest.raises(ValueError):
        next_batch(db,5)

def test_quality_audit_read_only_contract():
    db=Db({"contract":"netcompact4d-quality-v1","total":56,
           "identity_review":1,"non_primary":4,"review_items":[]})
    result=source_audit(db)
    assert result["identity_review"]==1
    assert db.name=="netcompact4d_geo_quality_audit"
    with pytest.raises(ValueError):
        source_audit(Db({"contract":"invalid"}))
