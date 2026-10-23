"""SEC-P0 regression: safe key cutover after Railway credential incident.

Only synthetic dummy keys; never connect to production or log a credential.
"""
import pytest

from app.repository import WorkerRepository
from app.supabase_credentials import (
    SupabaseCredentialError,
    get_supabase_admin_key,
    supabase_admin_headers,
)


def test_new_secret_key_overrides_legacy_without_leaking_to_bearer(monkeypatch):
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_new_dummy_test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "legacy-dummy-key")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    assert get_supabase_admin_key() == "sb_secret_new_dummy_test"
    repo = WorkerRepository()
    assert repo.headers["apikey"] == "sb_secret_new_dummy_test"
    assert "Authorization" not in repo.headers
    assert repo.headers["Content-Type"] == "application/json"


def test_legacy_auth_is_unchanged_until_explicit_cutover(monkeypatch):
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "legacy-dummy-key")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    assert get_supabase_admin_key() == "legacy-dummy-key"
    assert supabase_admin_headers("legacy-dummy-key") == {
        "apikey": "legacy-dummy-key",
        "Authorization": "Bearer legacy-dummy-key",
    }
    repo = WorkerRepository()
    assert repo.headers["Authorization"] == "Bearer legacy-dummy-key"


def test_public_key_rejected_for_privileged_backend(monkeypatch):
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_publishable_NOT_SECRET")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "legacy-dummy-key")
    with pytest.raises(SupabaseCredentialError, match="Publishable/anon"):
        get_supabase_admin_key()
    with pytest.raises(SupabaseCredentialError):
        supabase_admin_headers("sb_publishable_NOT_SECRET")


def test_missing_key_error_never_includes_values(monkeypatch):
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    with pytest.raises(SupabaseCredentialError, match="required") as error:
        get_supabase_admin_key()
    assert "sb_secret_" not in str(error.value)
    assert "legacy" not in str(error.value)


def test_new_key_works_when_placed_in_original_env_slot(monkeypatch):
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_migrated_dummy_test")
    assert supabase_admin_headers(get_supabase_admin_key()) == {
        "apikey": "sb_secret_migrated_dummy_test",
    }
