"""B3.E durable queue and independent deployment flags."""
from pathlib import Path
import pytest

from app import net_pro_producers_pdf_public_facts_b3e as b3e
from app.net_pro_producers_catalog_b1 import CatalogueRejected

ROOT=Path(__file__).resolve().parents[3]
SQL=(ROOT/"supabase/migrations/20261118223000_net_producers_b3e_pdf_fact_queue.sql").read_text()
WORKER=(ROOT/"services/worker/app/net_pro_producers_auto1.py").read_text()


def test_private_claims_and_lease_gates():
    assert "enable row level security" in SQL
    assert "revoke all on private.network_producer_pdf_fact_queue" in SQL
    assert "from public,anon,authenticated" in SQL
    assert "to service_role;" in SQL
    assert "for update skip locked" in SQL
    assert "lease_token=v_token" in SQL
    assert "rights_status='link_only'" in SQL
    assert "document_type='official_pdf'" in SQL
    assert "canonical_key='producer'" in SQL
    assert "status='inspected' and p_payload->>'stage'='true'" in SQL


def test_worker_opt_in_disabled_by_default():
    assert 'NETPRODUCERS_B3E_FACT_OBSERVATION_ENABLED' in WORKER
    assert 'NETPRODUCERS_B3E_FACT_STAGE_ENABLED' in WORKER
    assert 'stage=os.getenv("NETPRODUCERS_B3E_FACT_STAGE_ENABLED") == "1"' in WORKER


class DB:
    def __init__(self, lease):
        self.calls=[]
        self.lease=lease
    def rpc(self, name, args):
        assert name=="netproducers_b3e_pdf_fact_queue"
        op=args["p_operation"]
        data=args["p_payload"]
        self.calls.append((op,data))
        if op=="seed":
            result={"contract":"netproducers-b3e-pdf-queue-v1",
                    "operation":"seed","added":0}
        elif op=="claim":
            result={"contract":"netproducers-b3e-pdf-queue-v1",
                    "operation":"claim","count":1,"items":[self.lease]}
        else:
            result={"contract":"netproducers-b3e-pdf-queue-v1",
                    "operation":"complete","updated":1}
        class Exec:
            def execute(self):
                self.data=result
                return self
        return Exec()


@pytest.mark.asyncio
async def test_dry_run_retains_lease_for_later_stage(monkeypatch):
    row={"company_id":"c","source_url":"https://alessiotubi.it/doc.pdf",
         "canonical_domain":"alessiotubi.it",
         "source_status":"official_link_observed","rights_status":"link_only",
         "lease_token":"t"}
    db=DB(row)
    def mock(*args, **kwargs):
        assert kwargs["dry_run"] is True
        return {"dimension_candidates":3,"thickness_candidates":2,
                "staged_dimensions":0,"staged_thickness":0}
    monkeypatch.setattr(b3e,"observe_pdf_source",mock)
    result=await b3e.run_b3e_fact_queue(db,limit=1,stage=False)
    assert result["inspected"]==1 and result["complete"]==0
    assert db.calls[1]==("claim",{"limit":1,"stage":False})
    assert db.calls[2][1]["status"]=="inspected"


@pytest.mark.asyncio
async def test_one_bad_pdf_does_not_fabricate_facts(monkeypatch):
    row={"company_id":"c","source_url":"https://alessiotubi.it/doc.pdf",
         "canonical_domain":"alessiotubi.it",
         "source_status":"official_link_observed","rights_status":"link_only",
         "lease_token":"t"}
    db=DB(row)
    def reject(*args,**kwargs):
        raise CatalogueRejected("robots denied")
    monkeypatch.setattr(b3e,"observe_pdf_source",reject)
    result=await b3e.run_b3e_fact_queue(db,stage=True)
    assert result["blocked"]==1
    assert result["staged_thickness"]==result["published_claims"]==0
    assert db.calls[-1][1]["status"]=="blocked"
