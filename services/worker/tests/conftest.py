"""Synthetic service credentials in Worker endpoint tests; never use real secrets."""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _synthetic_worker_token(monkeypatch):
    token = "synthetic-ci-only-worker-token"
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", token)
    original = TestClient.request

    def request_with_test_token(self, method, url, **kwargs):
        headers = dict(kwargs.pop("headers", None) or {})
        headers.setdefault("x-worker-token", token)
        return original(self, method, url, headers=headers, **kwargs)

    monkeypatch.setattr(TestClient, "request", request_with_test_token)
