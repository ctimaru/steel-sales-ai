"""Synthetic Worker authentication fixture; never use production credentials."""
import pytest


@pytest.fixture(autouse=True)
def _synthetic_worker_token(monkeypatch):
    # Keep existing endpoint tests exercising business behavior under a configured
    # internal Worker token. Fail-closed tests override/remove this value explicitly.
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "synthetic-ci-only-worker-token")
