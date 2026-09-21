from uuid import UUID

import pytest

from app.evidence import EvidenceError, EvidenceService


ACTOR_ID = UUID("00000000-0000-0000-0000-000000000001")
ORG_ID = "00000000-0000-0000-0000-0000000000aa"
JOB_ID = "00000000-0000-0000-0000-0000000000bb"


def configure(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key-not-a-real-secret")


@pytest.mark.asyncio
async def test_original_evidence_requires_matching_tenant_lineage(monkeypatch) -> None:
    configure(monkeypatch)
    service = EvidenceService()

    async def fake_request(method, path, **kwargs):
        if path.startswith("/rest/v1/organization_memberships"):
            return [{"organization_id": ORG_ID, "user_id": str(ACTOR_ID), "role": "admin"}]
        if path.startswith("/rest/v1/commercial_observations"):
            assert f"organization_id=eq.{ORG_ID}" in path
            return [{
                "id": 1537,
                "organization_id": ORG_ID,
                "source_filename": "offer.eml",
                "source_extraction_id": 13,
            }]
        if path.startswith("/rest/v1/worker_staging_observations"):
            return [{"id": 13, "job_id": JOB_ID}]
        if path.startswith("/rest/v1/worker_jobs"):
            assert f"organization_id=eq.{ORG_ID}" in path
            return [{
                "id": JOB_ID,
                "organization_id": ORG_ID,
                "filename": "offer.eml",
                "storage_path": f"organizations/{ORG_ID}/imports/batch/item/offer.eml",
            }]
        raise AssertionError(path)

    class FakeStorage:
        def create_signed_url(self, path, expires_in, options):
            assert path.startswith(f"organizations/{ORG_ID}/")
            assert expires_in == 120
            assert options == {"download": True}
            return {"signed_url": "https://example.supabase.co/storage/signed/offer.eml"}

    monkeypatch.setattr(service.repo, "_request", fake_request)
    monkeypatch.setattr(service, "_storage_client", lambda: FakeStorage())

    result = await service.resolve(1537, ACTOR_ID)
    assert result["filename"] == "offer.eml"
    assert result["expires_in"] == 120
    assert result["signed_url"].startswith("https://")


@pytest.mark.asyncio
async def test_original_evidence_rejects_cross_tenant_storage_path(monkeypatch) -> None:
    configure(monkeypatch)
    service = EvidenceService()

    async def fake_request(method, path, **kwargs):
        if path.startswith("/rest/v1/organization_memberships"):
            return [{"organization_id": ORG_ID, "user_id": str(ACTOR_ID), "role": "viewer"}]
        if path.startswith("/rest/v1/commercial_observations"):
            return [{"id": 1537, "organization_id": ORG_ID, "source_filename": "offer.eml", "source_extraction_id": 13}]
        if path.startswith("/rest/v1/worker_staging_observations"):
            return [{"id": 13, "job_id": JOB_ID}]
        if path.startswith("/rest/v1/worker_jobs"):
            return [{
                "id": JOB_ID,
                "organization_id": ORG_ID,
                "filename": "offer.eml",
                "storage_path": "organizations/another-tenant/imports/batch/item/offer.eml",
            }]
        raise AssertionError(path)

    monkeypatch.setattr(service.repo, "_request", fake_request)

    with pytest.raises(EvidenceError, match="tenant validation"):
        await service.resolve(1537, ACTOR_ID)
