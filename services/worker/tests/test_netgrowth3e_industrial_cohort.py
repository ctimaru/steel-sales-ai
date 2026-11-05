"""NET-GROWTH3.E: first 50 real source-backed industrial identities.

These tests are strictly offline; real production must be screened with the
service-role only RPC and independently read back after protected merge.
"""
import asyncio
import copy
import json
from pathlib import Path

import pytest

from app.netgrowth3d_role_correct import run, validate_manifest

MANIFEST = (
    Path(__file__).resolve().parents[1]
    / "data" / "netgrowth3e_industrial_cohort_20261105.json"
)


def load():
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def test_50_distinct_role_correct_industrial_companies():
    batch, kind, items, holds = validate_manifest(load())
    assert batch == "NET-GROWTH3D-IT-INDUSTRIAL-20261105-B"
    assert kind == "industrial" and holds == []
    assert len(items) == 50
    assert sum(i["role"] == "producer" for i in items) == 10
    assert sum(i["role"] == "processor_service_provider" for i in items) == 40
    assert len({i["domain"] for i in items}) == 50
    assert {i["source_status"] for i in items} == {"first_party_screened"}
    assert all(i["material_signal"] == "explicit_steel_tube_product" for i in items)


def test_historical_trader_cannot_enter_industrial_batch():
    data = load()
    data["records"][0]["role"] = "trader_distributor"
    with pytest.raises(ValueError, match="Incorrect role"):
        validate_manifest(data)


def test_unknown_legal_source_and_duplicate_names_block():
    data = load()
    data["records"][0]["identity_evidence_url"] = "https://not-the-company.example/"
    with pytest.raises(ValueError, match="first-party"):
        validate_manifest(data)
    data = load()
    data["records"][1]["name"] = data["records"][0]["name"]
    with pytest.raises(ValueError, match="Duplicated company"):
        validate_manifest(data)


def test_import_rejects_49_or_one_hold_before_credentials(tmp_path):
    data = load()
    data["records"] = data["records"][:-1]
    path = tmp_path / "short.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(RuntimeError, match="50..100"):
        asyncio.run(run(manifest=path, apply=True))
    data = load()
    data["review_hold_domains"] = [data["records"][0]["domain"]]
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(RuntimeError, match="zero legal identity"):
        asyncio.run(run(manifest=path, apply=True))


def test_readonly_dry_run_does_not_import():
    report = asyncio.run(run(manifest=MANIFEST))
    assert report == {
        "mode": "dry_run",
        "status": "ready_for_live_preflight",
        "kind": "industrial",
        "requested": 50,
        "held_for_review": 0,
        "ready_count": 50,
        "new_unconfirmed": 0,
        "published": 0,
    }


def test_no_producer_downcast_and_original_source_hold_not_reclassified():
    data = load()
    assert {"profiltubi.it", "eurotubi.it", "siderinox.it"}.issubset(
        {i["domain"] for i in data["records"] if i["role"] == "producer"}
    )
    assert {"eurocromo.net", "lasertubi.it", "gamma3conifica.com"}.issubset(
        {i["domain"] for i in data["records"] if i["role"] == "processor_service_provider"}
    )
    assert "tubisteelsrl.com" not in {i["domain"] for i in data["records"]}
