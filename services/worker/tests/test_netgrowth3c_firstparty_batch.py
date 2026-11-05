"""NET-GROWTH3.C regression/security tests for 50-company curated acquisition."""
import asyncio
import copy
import json

import pytest

import app.netgrowth3c_firstparty_batch as module
from app.netgrowth3c_firstparty_batch import MANIFEST, run, validate_manifest


def payload():
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def test_fifty_distinct_source_backed_traders_and_explicit_holds():
    batch, records, hold = validate_manifest(payload())
    assert batch == "NET-GROWTH3C-IT-TRADERS-20261105-A"
    assert len(records) == 50
    assert len({x["domain"] for x in records}) == 50
    assert len(hold) == 8
    assert all(x["role"] == "trader_distributor" for x in records)
    assert all(x["evidence_url"].startswith("https://") for x in records)


def test_review_hold_not_silently_dropped():
    item = payload()
    item["review_hold_domains"].append("unrelated.example")
    with pytest.raises(ValueError, match="Unknown company"):
        validate_manifest(item)


def test_source_count_gate_fails_on_short_or_duplicated_batch():
    item = payload()
    item["records"] = item["records"][:49]
    with pytest.raises(ValueError, match="50"):
        validate_manifest(item)
    item = payload()
    item["records"][0] = copy.deepcopy(item["records"][1])
    with pytest.raises(ValueError):
        validate_manifest(item)


def test_bad_role_or_foreign_source_blocked():
    item = payload()
    item["records"][0]["role"] = "producer"
    with pytest.raises(ValueError):
        validate_manifest(item)
    item = payload()
    item["records"][0]["evidence_url"] = "https://unrelated.example/"
    with pytest.raises(ValueError):
        validate_manifest(item)


def test_default_offline_dry_run_makes_no_http_calls(monkeypatch):
    monkeypatch.setattr(module, "credentials_from_environment", lambda: (
        _ for _ in ()).throw(AssertionError("No secrets on offline run")))
    result = asyncio.run(run(apply=False))
    assert result["status"] == "validated_offline"
    assert result["requested"] == 50
    assert result["held_for_source_review"] == 8
    assert result["published"] == 0


def test_apply_refuses_holds_before_credentials_or_writes(monkeypatch):
    monkeypatch.setattr(module, "credentials_from_environment", lambda: (
        _ for _ in ()).throw(AssertionError("No secrets when held")))
    with pytest.raises(RuntimeError, match="holds must be cleared"):
        asyncio.run(run(apply=True))


def test_source_review_must_be_consistent_and_auditable():
    item = payload()
    item["review_hold_domains"] = ["not-the-source.example"]
    with pytest.raises(ValueError, match="Unknown company"):
        validate_manifest(item)
