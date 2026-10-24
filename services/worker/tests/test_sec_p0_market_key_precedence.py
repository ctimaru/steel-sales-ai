from app.market import _configuration, MarketConfigurationError
import pytest

def test_market_prefers_scoped_secret(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "synthetic")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "legacy")
    assert _configuration() == ("https://example.supabase.co", "synthetic")

def test_market_legacy_compatibility(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "legacy")
    assert _configuration() == ("https://example.supabase.co", "legacy")

def test_market_fails_without_credentials(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    with pytest.raises(MarketConfigurationError):
        _configuration()
