"""SEC-P0-CLOSE1C: fail-closed internal Worker API authentication tests."""
import pytest
from fastapi import HTTPException
from app.main import require_worker_token


def test_missing_worker_secret_rejects_requests(monkeypatch):
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN", raising=False)
    for supplied in (None, "arbitrary"):
        with pytest.raises(HTTPException) as exc:
            require_worker_token(supplied)
        assert exc.value.status_code == 503


def test_missing_or_wrong_token_rejected(monkeypatch):
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "synthetic-secret")
    for supplied in (None, "", "incorrect"):
        with pytest.raises(HTTPException) as exc:
            require_worker_token(supplied)
        assert exc.value.status_code == 401


def test_correct_token_accepted(monkeypatch):
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "synthetic-secret")
    assert require_worker_token("synthetic-secret") is None
