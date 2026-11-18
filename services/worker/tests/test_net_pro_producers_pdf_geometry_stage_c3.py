"""Security contracts: producer geometry remains private and opt-in."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SQL = (ROOT / "supabase/migrations" /
    "20261118204500_net_producers_pdf_geometry_pending_evidence.sql").read_text()
B3 = (ROOT / "services/worker/app/net_pro_producers_catalog_b3b_pdf.py").read_text()


def test_geometry_staging_private_service_only():
    assert "create table private.network_producer_pdf_thickness_evidence" in SQL
    assert "enable row level security" in SQL
    assert "revoke all on private.network_producer_pdf_thickness_evidence" in SQL
    assert "owner_review<>'removed'" in SQL
    assert "unique (size_row_id,document_sha256,thickness_mm)" in SQL
    assert "source_verified" in SQL and "manufacturer_confirmed" in SQL
    assert "grant execute on function public.netproducers_c3_pdf_stage_geometry" in SQL
    assert "to service_role;" in SQL
    assert "to anon,authenticated;" not in SQL.split(
        "grant execute on function public.netproducers_c3_pdf_stage_geometry")[-1]
    assert "create function public.netproducers_c3_pdf_stage_geometry" in SQL
    assert "security invoker" in SQL


def test_geometry_processing_stays_disabled_until_schema_deployment():
    assert 'NETPRODUCERS_C3_GEOMETRY_STAGE_ENABLED' in B3
    assert 'NETPRODUCERS_C3_POSITION_OBSERVATION_ENABLED' in B3
    assert 'NETPRODUCERS_C3_PDF_SIZE_PUBLISH_ENABLED' in B3
    assert B3.index('pdf_size_rows = stage_pdf_table_sizes') < B3.index(
        'geometry_stage = stage_positioned_thickness')


def test_geometry_writer_rpc_keeps_pending_status():
    from app.net_pro_producers_pdf_table_geometry_c3 import stage_positioned_thickness
    example = {"geometry_sha256": "a" * 64,
               "source_locator": "pdf_page:1:table:rhs_en10219:row:200x100",
               "status": "pending_producer_confirmation"}
    class DB:
        def rpc(self,name,args):
            assert name=="netproducers_c3_pdf_stage_geometry"
            assert args["p_document_sha"]=="d"*64
            assert len(args["p_candidates"])==1
            class Response:
                def execute(self):
                    self.data={"contract":"netproducers-c3-geometry-stage-v1",
                               "added":1,"replayed":0,
                               "source_verified":0,"manufacturer_confirmed":0}
                    return self
            return Response()
    r=stage_positioned_thickness(DB(),
        {"company_id":"co", "source_url":"https://factory.example/catalog.pdf"},
        "d"*64, [example])
    assert r["added"]==1
    assert r["source_verified"]==r["manufacturer_confirmed"]==0
