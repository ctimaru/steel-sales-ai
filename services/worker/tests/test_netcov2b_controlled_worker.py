from datetime import datetime, timedelta, timezone

import pytest
from app.netcov2b_controlled_worker import LABEL, validate_manifest


NOW = datetime(2026, 10, 16, tzinfo=timezone.utc)


def fixture():
    run = {
        "id": "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
        "status": "queued", "governance_status": "approved", "label": LABEL,
        "terms_status": "allows_reuse", "database_rights_status": "licensed",
        "personal_data_policy": "company_data_only",
        "source_reference": "https://first-party-submissions.example.com/consent",
        "seed_urls": ["https://firm.example/"],
    }
    source = {
        "id": "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
        "source_url": run["source_reference"],
        "source_type": "company_submission", "enabled_for_discovery": True,
        "governance_status": "approved", "terms_status": "allows_reuse",
        "database_rights_status": "licensed", "personal_data_policy": "company_data_only",
        "reviewed_at": "2026-10-15T10:00:00Z", "reviewed_by": "operator",
        "rights_evidence_url": "https://first-party-submissions.example.com/consent",
        "max_domains_per_run": 10,
    }
    leads = [{
        "id": "cccccccc-1111-4111-8111-cccccccccccc", "domain": "firm.example",
        "proposed_url": "https://firm.example/", "status": "pending_review",
        "intake_run_id": run["id"], "source_id": source["id"],
    }]
    grants = [{"domain": "firm.example", "revoked_at": None,
               "expires_at": (NOW + timedelta(days=30)).isoformat()}]
    return run, source, leads, grants


def test_explicit_first_party_permission_is_required():
    run, source, leads, grants = fixture()
    assert validate_manifest(run, source, leads, grants, NOW) == leads
    with pytest.raises(RuntimeError, match="consent"):
        validate_manifest(run, source, leads, [], NOW)
    grants[0]["expires_at"] = (NOW - timedelta(hours=1)).isoformat()
    with pytest.raises(RuntimeError, match="consent"):
        validate_manifest(run, source, leads, grants, NOW)


def test_separate_run_source_governance_and_exact_seed_boundaries():
    run, source, leads, grants = fixture()
    run["governance_status"] = "unreviewed"
    with pytest.raises(RuntimeError, match="governance"):
        validate_manifest(run, source, leads, grants, NOW)
    run["governance_status"] = "approved"
    source["source_type"] = "licensed_search"
    with pytest.raises(RuntimeError, match="source"):
        validate_manifest(run, source, leads, grants, NOW)
    source["source_type"] = "company_submission"
    leads[0]["domain"] = "unlicensed.example"
    with pytest.raises(RuntimeError, match="consent"):
        validate_manifest(run, source, leads, grants, NOW)


def test_budget_and_duplicate_seeds_fail_closed():
    run, source, leads, grants = fixture()
    run["seed_urls"].append(run["seed_urls"][0])
    with pytest.raises(RuntimeError, match="duplicated"):
        validate_manifest(run, source, leads, grants, NOW)
