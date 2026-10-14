"""CRAWL-IT6.6c synthetic RNA XML samples, no live source or personal data."""
import csv
from pathlib import Path
from tempfile import TemporaryDirectory
import pytest
from app.rna_corporate_candidates import export_rna_candidates, safe_rna_url, sector_roles

def aid(name,tax,cor,sector):
    return ("<AIUTO><DENOMINAZIONE_BENEFICIARIO>"+name+
      "</DENOMINAZIONE_BENEFICIARIO><CODICE_FISCALE_BENEFICIARIO>"+tax+
      "</CODICE_FISCALE_BENEFICIARIO><COR>"+cor+
      "</COR><COMPONENTI_AIUTO><COMPONENTE_AIUTO><SETTORE_ATTIVITA>"+
      sector+"</SETTORE_ATTIVITA></COMPONENTE_AIUTO></COMPONENTI_AIUTO></AIUTO>")

def test_only_official_monthly_xml_url():
    assert safe_rna_url("https://www.rna.gov.it/sites/rna.mise.gov.it/files/opendata/OpenData_Aiuti_2026_09.xml").endswith(".xml")
    for bad in ["http://www.rna.gov.it/sites/rna.mise.gov.it/files/opendata/OpenData_Aiuti_2026_09.xml",
                "https://unapproved.example/open-data/monthly.xml",
                "https://www.rna.gov.it/sites/rna.mise.gov.it/files/opendata/OpenData_Aiuti_2026_09.xml?x=1"]:
        with pytest.raises(ValueError):safe_rna_url(bad)

def test_corporate_merchants_buyers_dedup_and_no_unsupported_fiscal_ids():
    xml="<LISTA_AIUTI>"+aid("LAMIERE PROVA S.R.L.","01234567890","321","46.72")+aid("LAMIERE PROVA S.R.L.","01234567890","322","46.72")+aid("CARPENTERIA PROVA SPA","09876543210","456","25.11")+aid("Mario Rossi persona fisica","RSSMRA80A01H501U","333","46.72")+aid("Societa non riconosciuta","12345678901","999","62.00")+"</LISTA_AIUTI>"
    with TemporaryDirectory() as d:
        source=Path(d)/"source.xml";out=Path(d)/"out.csv"
        source.write_text(xml,encoding="utf-8")
        report=export_rna_candidates(source,out,"both",200)
        with out.open(encoding="utf-8-sig") as f:rows=list(csv.DictReader(f))
    assert report["candidates"]==2
    assert report["traders"]==1 and report["potential_buyers"]==1
    assert report["duplicate_tax"]==1
    assert report["supabase_writes"]==0 and report["network_publications"]==0
    assert [r["corporate_tax_id"] for r in rows]==["01234567890","09876543210"]
    assert [r["role"] for r in rows]==["trader_distributor","end_user"]
    assert "vat_id" not in rows[0] and "ateco_code" not in rows[0]
    assert rows[0]["source_record_id"]=="RNA-321-NACE-46.72"
    assert rows[0]["evidence_url"]=="https://www.rna.gov.it/open-data/aiuti"

def test_xml_namespaces_and_invalid_data():
    xml='<n:LISTA_AIUTI xmlns:n="urn:rna:fixture"><n:AIUTO><n:DENOMINAZIONE_BENEFICIARIO>STEEL TRADE SRL</n:DENOMINAZIONE_BENEFICIARIO><n:CODICE_FISCALE_BENEFICIARIO>12345678901</n:CODICE_FISCALE_BENEFICIARIO><n:COR>AB_1</n:COR><n:COMPONENTI_AIUTO><n:COMPONENTE_AIUTO><n:SETTORE_ATTIVITA>46.82</n:SETTORE_ATTIVITA></n:COMPONENTE_AIUTO></n:COMPONENTI_AIUTO></n:AIUTO></n:LISTA_AIUTI>'
    with TemporaryDirectory() as d:
        p=Path(d)/"source.xml";q=Path(d)/"output.csv";p.write_text(xml)
        assert export_rna_candidates(p,q,"trader",1)["candidates"]==1
        p.write_text("<!DOCTYPE LISTA_AIUTI><LISTA_AIUTI/>")
        with pytest.raises(ValueError,match="DTD"):export_rna_candidates(p,q)
        p.write_text("<html/>")
        with pytest.raises(ValueError,match="root"):export_rna_candidates(p,q)
        with pytest.raises(ValueError,match="1-300"):export_rna_candidates(p,q,max_rows=301)

def test_nace_component_hint_is_not_free_text():
    assert sector_roles(["46.72 other business"],"trader") is None
    assert sector_roles(["C.25.11"],"buyer")==("end_user","25.11")
    assert sector_roles(["46.82"],"trader")==("trader_distributor","46.82")
