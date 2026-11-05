"""NET-RO1.3.B — synthetic ONRC snapshot tests, NEVER real personal/company data."""
import csv
import json
from pathlib import Path
import sys

WORKER = Path(__file__).resolve().parents[1]
if str(WORKER) not in sys.path:
    sys.path.insert(0, str(WORKER))
from scripts import netro1_3b_onrc_snapshot_reconcile as onrc  # noqa: E402

import pytest


def _csv(path: Path, headers: list[str], rows: list[tuple]):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter="^", lineterminator="\r\n")
        w.writerow(headers)
        w.writerows(rows)


def _official_meta(tmp_path: Path):
    path = tmp_path / "package_show.json"
    obj = {
        "success": True,
        "result": {
            "title": "Firme înregistrate la Registrul Comerțului până la data de 19.10.2026",
            "id": "TEST-PACKAGE-NOT-REAL",
            "organization": {"name": "onrc"},
            "license_id": "CC-BY-4.0",
            "resources": [
                {"id": "TEST-OD-FIRME", "name": "OD_FIRME.CSV",
                 "url": "https://data.gov.ro/dataset/demo/resource/demo/download/OD_FIRME.CSV"},
                {"id": "TEST-OD-STARE", "name": "OD_STARE_FIRMA.CSV",
                 "url": "https://data.gov.ro/dataset/demo/resource/demo/download/OD_STARE_FIRMA.CSV"},
            ],
        },
    }
    path.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")
    return path


def _fixture(tmp_path):
    firms = tmp_path / "OD_FIRME.CSV"
    status = tmp_path / "OD_STARE_FIRMA.CSV"
    rows = [
        # Romanian company identities are SYNTHETIC except for aliases/CUI already in research.
        ("K1", "1111111", "ARTROM STEEL TUBES S.A.", "J00/0001/2026", "SA"),
        ("K2", "18587332", "VAN LEEUWEN ROMANIA S.R.L.", "J00/0002/2026", "SRL"),
        ("K3", "18992475", "tk accelis Materials Romania SRL", "J00/0003/2026", "SRL"),
        ("K4", "9600823", "COMTECH CO SRL", "J00/0004/2026", "SRL"),
        ("K5", "6666666", "Ion Test PFA", "F00/0005/2026", "PFA"),
    ]
    _csv(firms, ["COD_INMATRICULARE", "CUI", "DENUMIRE", "NR_INREGISTRARE", "FORMA_JURIDICA"], rows)
    _csv(status, ["COD_INMATRICULARE", "COD_STARE_FIRMA"], [
        ("K1", "1"), ("K2", "1"), ("K3", "2"), ("K4", "1"), ("K5", "1")
    ])
    return _official_meta(tmp_path), firms, status


def _row(result, domain):
    return next(item for item in result["results"] if item["domain"] == domain)


def test_sample_snapshot_matches_known_company_aliases_but_cannot_approve(tmp_path):
    meta, firms, status = _fixture(tmp_path)
    report = onrc.run(onrc.LEDGER, onrc.OBSERVATIONS, meta, firms, status)
    assert report["candidate_websites"] == 50
    assert report["csv_rows_scanned"] == 5
    assert report["import_authorized"] is False
    assert report["production_writes"] == 0
    assert report["onrc_live_verified"] == 0
    assert report["legal_identity_and_source_rights_approved"] == 0
    assert report["source_snapshot_not_live"] is True
    artrom = _row(report, "artrom.com")
    assert artrom["match_result"] == "unique_exact_name_snapshot_cui_discovered"
    assert artrom["snapshot_matches"][0]["cui"] == "1111111"
    assert artrom["snapshot_matches"][0]["state_verified_active"] is False
    assert artrom["snapshot_matches"][0]["state_codes"] == ["1"]
    assert _row(report, "vanleeuwen.com")["match_result"] == "cui_and_name_snapshot_match"
    renamed = _row(report, "thyssenkrupp-materials.ro")
    assert renamed["match_result"] == "cui_and_name_snapshot_match"
    assert renamed["snapshot_matches"][0]["registered_name"] == "tk accelis Materials Romania SRL"
    assert _row(report, "comtechco.ro")["match_result"] == "cui_and_name_snapshot_match"
    assert _row(report, "isoplus.group")["match_result"] == "not_found"
    assert all(item["qualified_for_import"] is False for item in report["results"])
    assert len([x for x in report["results"] if x["snapshot_matches"]]) == 4


def test_direct_official_package_metadata_fails_on_date_license_and_publisher(tmp_path):
    path = _official_meta(tmp_path)
    accepted = onrc.load_catalog_metadata(path)
    assert accepted["license_id_declared"] == "CC-BY-4.0"
    assert accepted["source_reuse_approved"] is False
    assert accepted["company_rights_reviewed"] is False
    for key, value in [
        ("title", "Firme înregistrate până la data de 08.07.2026"),
        ("license_id", "Unknown-License"),
        ("organization", {"name": "not_onrc"}),
    ]:
        data = json.loads(path.read_text(encoding="utf-8"))
        data["result"][key] = value
        path.write_text(json.dumps(data), encoding="utf-8")
        with pytest.raises(ValueError):
            onrc.load_catalog_metadata(path)
        _official_meta(tmp_path)


def test_reject_external_csv_resource_and_incomplete_package(tmp_path):
    path = _official_meta(tmp_path)
    doc = json.loads(path.read_text(encoding="utf-8"))
    doc["result"]["resources"][0]["url"] = "https://third-party.example.org/raw/OD_FIRME.CSV"
    path.write_text(json.dumps(doc), encoding="utf-8")
    with pytest.raises(ValueError, match="third-party"):
        onrc.load_catalog_metadata(path)
    doc = json.loads(_official_meta(tmp_path).read_text(encoding="utf-8"))
    doc["result"]["resources"].pop()
    path.write_text(json.dumps(doc), encoding="utf-8")
    with pytest.raises(ValueError, match="resources"):
        onrc.load_catalog_metadata(path)


def test_ambiguous_company_same_name_multiple_cui_is_never_auto_accepted(tmp_path):
    meta, firms, status = _fixture(tmp_path)
    with firms.open("a", encoding="utf-8", newline="") as f:
        csv.writer(f, delimiter="^").writerow(
            ("K6", "2222222", "ARTROM STEEL TUBES S.A.", "J00/0006/2026", "SA")
        )
    result = onrc.run(onrc.LEDGER, onrc.OBSERVATIONS, meta, firms, status)
    assert _row(result, "artrom.com")["match_result"] == "ambiguous_multiple_registry_rows"
    assert _row(result, "artrom.com")["qualified_for_import"] is False


def test_company_name_match_with_incorrect_cui_is_explicitly_blocked(tmp_path):
    meta, firms, status = _fixture(tmp_path)
    with firms.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter="^")
        w.writerow(["COD_INMATRICULARE", "CUI", "DENUMIRE", "NR_INREGISTRARE", "FORMA_JURIDICA"])
        w.writerow(["K1", "12345678", "VAN LEEUWEN ROMANIA S.R.L.", "J00/0002/2026", "SRL"])
    result = onrc.run(onrc.LEDGER, onrc.OBSERVATIONS, meta, firms, status)
    assert _row(result, "vanleeuwen.com")["match_result"] == "cui_conflicts_with_name_match"


def test_only_corporate_entities_projected_natural_persons_excluded():
    assert onrc.is_corporate_entity("Test Metals SRL", "SRL")
    assert onrc.is_corporate_entity("Steel Tubes S.A.", "")
    assert not onrc.is_corporate_entity("Ion Test PFA", "PFA")
    assert not onrc.is_corporate_entity("Ion Test", "PERSOANA FIZICA AUTORIZATA")
    assert not onrc.is_corporate_entity("Scaffold Metal", "")
    assert onrc.normalize_name("REMAT BRAȘOV S.A.") == onrc.normalize_name("REMAT BRASOV SA")


def test_missing_join_key_and_invalid_metadata_never_silently_pass(tmp_path):
    meta, firms, status = _fixture(tmp_path)
    _csv(firms, ["CUI", "DENUMIRE"], [("12345678", "Example SRL")])
    with pytest.raises(ValueError, match="header"):
        onrc.run(onrc.LEDGER, onrc.OBSERVATIONS, meta, firms, status)
    metadata = json.loads(meta.read_text(encoding="utf-8"))
    metadata["success"] = False
    meta.write_text(json.dumps(metadata), encoding="utf-8")
    with pytest.raises(ValueError, match="successful"):
        onrc.load_catalog_metadata(meta)
