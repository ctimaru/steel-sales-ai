from __future__ import annotations

from app.net_intel1_ingest import evidence_batch


def _outcome(**updates):
    payload = {
        "status": "candidate_only",
        "source_website": "https://example.it/",
        "description": "Produzione di tubi in acciaio.",
        "evidence": [
            {"url": "https://example.it/chi-siamo", "snippet": "Produzione di tubi in acciaio.", "title": "Chi siamo"},
        ],
    }
    payload.update(updates)
    return payload


def test_private_candidate_description_contains_source_and_no_auto_approval():
    batch = evidence_batch(_outcome(), "2026-11-15T20:00:00Z")
    assert len(batch) == 1
    assert batch[0]["field_key"] == "description"
    assert batch[0]["evidence_url"] == "https://example.it/chi-siamo"
    assert batch[0]["extractor_version"] == "net-intel1-b-description-v1"
    assert "review_status" not in batch
    assert "products" not in str(batch)


def test_candidate_requires_https_and_same_domain():
    assert evidence_batch(_outcome(evidence=[
        {"url": "http://example.it/", "snippet": "steel"},
        {"url": "https://unrelated.it/", "snippet": "steel"},
    ]), "2026-11-15T20:00:00Z") == []


def test_no_evidence_from_unqualified_site():
    assert evidence_batch(_outcome(status="insufficient_steel_evidence"), "2026-11-15T20:00:00Z") == []
    assert evidence_batch(_outcome(description=""), "2026-11-15T20:00:00Z") == []
    assert evidence_batch(_outcome(evidence=[]), "2026-11-15T20:00:00Z") == []


def test_evidence_is_bounded():
    batch = evidence_batch(_outcome(description="a" * 5000, evidence=[
        {"url": "https://example.it/", "snippet": "b" * 5000},
    ]), "2026-11-15T20:00:00Z")
    assert len(batch[0]["field_value"]) == 600
    assert len(batch[0]["evidence_excerpt"]) == 1200
