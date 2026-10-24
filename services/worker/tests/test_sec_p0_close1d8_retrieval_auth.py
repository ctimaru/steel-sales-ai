"""SEC-P0-CLOSE1D.8: global search and retrieval share fail-closed authorization."""
import pytest
from fastapi import HTTPException
from app.retrieval_api import require_worker_token


def test_global_search_guard_rejects_missing_server_token(monkeypatch):
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN", raising=False)
    for supplied in (None, "arbitrary"):
        with pytest.raises(HTTPException) as exc:
            require_worker_token(supplied)
        assert exc.value.status_code == 503


def test_global_search_guard_rejects_missing_or_bad_client_token(monkeypatch):
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "synthetic-ci-only-worker-token")
    for supplied in (None, "", "wrong-token"):
        with pytest.raises(HTTPException) as exc:
            require_worker_token(supplied)
        assert exc.value.status_code == 401


def test_global_search_guard_accepts_matching_token(monkeypatch):
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "synthetic-ci-only-worker-token")
    assert require_worker_token("synthetic-ci-only-worker-token") is None
