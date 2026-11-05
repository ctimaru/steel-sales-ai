"""NET-GROWTH3.D: tests for source evidence, company roles, and 50-item gate."""
import asyncio
import copy
import json
import pytest

from app.netgrowth3d_role_correct import (
    DEFAULT_MANIFEST, validate_manifest, run,
)

INDUSTRIAL = DEFAULT_MANIFEST.parent / "netgrowth3d_industrial_research_20261105.json"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_trader_records_are_always_traders():
    batch, kind, records, holds = validate_manifest(read(DEFAULT_MANIFEST))
    assert kind == "trader"
    assert len(records) == 3 and not holds
    assert all(r["role"] == "trader_distributor" for r in records)


def test_industrial_roles_are_preserved():
    _, kind, records, holds = validate_manifest(read(INDUSTRIAL))
    assert kind == "industrial"
    assert {r["role"] for r in records} == {"producer", "processor_service_provider"}
    assert holds == ["tubisteelsrl.com"]


def test_sub_fifty_and_holds_cannot_write():
    with pytest.raises(RuntimeError, match="50"):
        asyncio.run(run(apply=True))
    with pytest.raises(RuntimeError, match="50"):
        asyncio.run(run(manifest=INDUSTRIAL, apply=True))


def test_invalid_role_or_foreign_legal_source():
    data = read(DEFAULT_MANIFEST)
    data["records"][0]["role"] = "producer"
    with pytest.raises(ValueError, match="Incorrect role"):
        validate_manifest(data)
    data = read(DEFAULT_MANIFEST)
    data["records"][0]["identity_evidence_url"] = "https://another-domain.example/"
    with pytest.raises(ValueError, match="first-party"):
        validate_manifest(data)


def test_duplicate_company_or_unknown_hold_fails():
    data = read(DEFAULT_MANIFEST)
    data["records"].append(copy.deepcopy(data["records"][0]))
    with pytest.raises(ValueError, match="Duplicated"):
        validate_manifest(data)
    data = read(DEFAULT_MANIFEST)
    data["review_hold_domains"] = ["unknown.example"]
    with pytest.raises(ValueError, match="Unknown"):
        validate_manifest(data)


def test_offline_research_has_no_import():
    trader = asyncio.run(run())
    industrial = asyncio.run(run(manifest=INDUSTRIAL))
    assert trader["status"] == "research_only"
    assert industrial["status"] == "research_only"
    assert trader["new_unconfirmed"] == 0
    assert industrial["new_unconfirmed"] == 0


def test_fifty_synthetic_distinct_industrial_sources_are_valid():
    data = read(INDUSTRIAL)
    sample = data["records"][0]
    data["review_hold_domains"] = []
    records = []
    for i in range(50):
        rec = dict(sample)
        rec["name"] = f"Fixture Steel Tube Producer {i}"
        rec["domain"] = f"fixture-steel-{i}.example"
        for key in ("evidence_url", "role_evidence_url", "identity_evidence_url"):
            rec[key] = f"https://fixture-steel-{i}.example/tubes/"
        records.append(rec)
    data["records"] = records
    _, kind, actual, holds = validate_manifest(data)
    assert kind == "industrial" and len(actual) == 50 and not holds
