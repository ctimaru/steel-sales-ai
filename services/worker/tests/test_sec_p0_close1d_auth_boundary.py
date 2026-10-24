"""SEC-P0-CLOSE1D: prove internal Worker endpoint auth boundary with dummy tokens."""
from uuid import uuid4

from fastapi.testclient import TestClient
from app.main import app


def test_price_endpoint_rejects_wrong_or_absent_service_token(monkeypatch):
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "synthetic-ci-only-worker-token")
    payload = {"owner_id": str(uuid4())}
    with TestClient(app) as client:
        for bad in ("", "incorrect"):
            response = client.post("/v1/ai/latest-price", json=payload, headers={"x-worker-token": bad})
            assert response.status_code == 401
            assert "observation" not in response.json()


def test_price_endpoint_fails_closed_when_service_token_unconfigured(monkeypatch):
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN", raising=False)
    with TestClient(app) as client:
        response = client.post(
            "/v1/ai/latest-price",
            json={"owner_id": str(uuid4())},
            headers={"x-worker-token": "arbitrary"},
        )
        assert response.status_code == 503
        assert "observation" not in response.json()


def test_upload_rejects_wrong_service_token_before_storage(monkeypatch):
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "synthetic-ci-only-worker-token")
    with TestClient(app) as client:
        response = client.post(
            "/v1/uploads",
            files={"upload": ("sample.eml", b"From: a@example.invalid\\n\\nhi", "message/rfc822")},
            data={"owner_id": str(uuid4())},
            headers={"x-worker-token": "incorrect"},
        )
        assert response.status_code == 401
