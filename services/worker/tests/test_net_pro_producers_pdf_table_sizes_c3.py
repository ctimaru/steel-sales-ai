"""C3.DATA2.A — real PDF page-local rows and fail-closed source boundaries."""
from __future__ import annotations
from pathlib import Path

import pytest

from app.net_pro_producers_catalog_b1 import CatalogueRejected
from app.net_pro_producers_catalog_b3b_pdf import _read_pdf_lines
from app.net_pro_producers_pdf_table_sizes_c3 import extract_pdf_table_sizes, stage_pdf_table_sizes
from test_net_pro_producers_catalog_b3b_pdf import pdf_bytes

ROOT=Path(__file__).resolve().parents[3]
SQL=(ROOT/"supabase/migrations"/
     "20261118193000_net_producers_c3_pdf_real_size_rows.sql").read_text()


def test_first_party_pdf_table_rows_exact_shape_and_standard():
    pages=[{"page":3,"lines":[
        "RECTANGULAR EN 10219 - theoretical weight kg/m",
        "Dim.","Thickness","4 5 6 8 10 12,5",
        "60 40 5,45 6,56",
        "100 60 9,22 11,30 13,20 16,40 19,30",
        "200 100 18 22,3 26,4 33,9 41,3",
        "RECTANGULAR EN10219 EN10210",
        "Hot finished Rectangular EN10210 - theoretical weight kg/m",
        "Dim.","Thickness","4 5 6,3 8 10 12,5",
        "200 100 18,2 22,6 28,1 35,1 43,1",
        "SQUARE EN 10219 - theoretical weight kg/m",
        "Side's dim.","Thickness","4 5 6 8 10 12,5",
        "100 100 11,7 14,4 17 21,4 25,6",
        "200 100 11,7 14,4 17 21,4 25,6",
    ]},
    {"page":4,"lines":[
        "ROUND STRUCTURAL EN 10219 - theoretical weight kg/m",
        "Diam.","Ø","Thickness","4 5 6 6,3 8 10 12,5",
        "114,3 10,88 13,48 16,02 20,97 25,72",
        "219,1 21,22 26,4 31,53 41,65 51,56",
        "EN10217-1-2-3",
        "508 74,28 77,94 98,65 122,81",
    ]}]
    result=extract_pdf_table_sizes(pages)
    entries=result["rows"]
    assert len(entries)==7
    assert [x["shape"] for x in entries]==["RHS","RHS","RHS","RHS","SHS","CHS","CHS"]
    look={(x["shape"],x["standard"],x.get("width_mm",x.get("diameter_mm"))):x for x in entries}
    assert ("RHS","EN 10219",200.0) in look
    assert ("RHS","EN 10210",200.0) in look
    assert ("SHS","EN 10219",100.0) in look
    assert ("CHS","EN 10219",114.3) in look
    assert ("CHS","EN 10219",219.1) in look
    assert all("thickness_mm" not in x for x in entries)
    assert all("steel_grade" not in x for x in entries)
    assert all(x["line_sha256"] and len(x["line_sha256"])==64 for x in entries)
    assert result["source_verified"]==result["manufacturer_confirmed"]==0


def test_pypdf_subprocess_reads_real_pdf_page_text_into_conservative_parser():
    data=pdf_bytes([
        "RECTANGULAR EN 10219 - theoretical weight kg/m",
        "Dim.","Thickness","4 5 6 8 10 12,5",
        "200 100 18 22,3 26,4 33,9 41,3",
        "100 60 9,22 11,30 13,20 16,40 19,30",
    ])
    extracted=extract_pdf_table_sizes(_read_pdf_lines(data))
    assert len(extracted["rows"])==2
    assert all(item["standard"]=="EN 10219" and item["shape"]=="RHS" for item in extracted["rows"])


def test_grade_from_prior_page_cannot_be_inferred():
    rows=extract_pdf_table_sizes([
      {"page":1,"lines":["EN 10219","S355J2H"]},
      {"page":2,"lines":["200 100 18 22,3 26,4"]},
    ])["rows"]
    assert rows==[]


def test_unknown_or_mixed_table_heading_does_not_become_an_sku():
    rows=extract_pdf_table_sizes([{"page":1,"lines":[
      "RECTANGULAR EN 10219 EN 10210",
      "200 100 18 22,3 26,4",
      "EN 10217-7",
      "200 100 18 22,3 26,4",
    ]}])["rows"]
    assert rows==[]


def test_service_stage_batches_and_replay_never_confirms_manufacturing():
    pages=[{"page":1,"lines":[
     "SQUARE EN 10219 - theoretical weight kg/m",
     "Thickness","4 5 6 8 10",
     "100 100 11,7 14,4",
    ]}]
    class Stub:
      def __init__(self):self.count=0
      def rpc(self,name,args):
        assert name=="netproducers_c3_pdf_stage"
        assert args["p_company"]=="COMPANY"
        assert args["p_source"]=="https://example.com/catalogue.pdf"
        assert len(args["p_rows"])==1
        self.count+=1
        class Reply:
          def execute(self):
            self.data={"contract":"netproducers-c3-pdf-stage-v1",
              "added":1,"replayed":0,"source_verified":0,
              "manufacturer_confirmed":0}
            return self
        return Reply()
    db=Stub()
    result=stage_pdf_table_sizes(db,{
      "company_id":"COMPANY","source_url":"https://example.com/catalogue.pdf"},pages)
    assert result["size_rows_found"]==result["size_rows_new"]==1
    assert db.count==1
    assert result["source_verified"]==result["manufacturer_confirmed"]==0


def test_service_sql_and_private_producer_veto():
    for needle in (
       "create table private.network_producer_pdf_size_rows",
       "unique(company_id,source_url,locator)",
       "owner_review text not null default 'pending'",
       "netproducers_c3_pdf_events_append_only",
       "from private.network_producer_catalog_links l",
       "l.document_type='official_pdf'",
       "l.rights_status='link_only'",
       "create function private.netproducers_c3_pdf_stage",
       "to service_role",
       "create function sec1_public.netproducers_c3_pdf_public_impl",
       "public.netproducers_c3_pdf_owner",
       "netproducers1_b3c2_is_authorized_company_admin",
       "owner_review<>'removed'",
       "verified_manufacturer_skus',0",
       "mirrored_pdf_copies',0",
    ):
       assert needle in SQL,needle
    assert "to anon,authenticated,service_role;" in SQL
    assert "grant execute on function public.netproducers_c3_pdf_stage(uuid,text,jsonb) to authenticated" not in SQL
