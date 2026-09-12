from __future__ import annotations

import asyncio
from uuid import UUID

import app.queries as queries


class FakeResponse:
    status_code = 200
    is_error = False

    def __init__(self, rows: list[dict[str, object]]) -> None:
        self._rows = rows

    def json(self) -> list[dict[str, object]]:
        return self._rows


class FakeAsyncClient:
    def __init__(self, captured: dict[str, object], rows: list[dict[str, object]]) -> None:
        self.captured = captured
        self.rows = rows

    async def __aenter__(self) -> "FakeAsyncClient":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def post(self, url: str, *, json: dict[str, object], headers: dict[str, str]) -> FakeResponse:
        self.captured["url"] = url
        self.captured["json"] = json
        self.captured["headers"] = headers
        return FakeResponse(self.rows)


def test_latest_price_calls_owner_scoped_rpc(monkeypatch) -> None:
    owner_id = UUID("f45fab6e-3da8-41aa-8711-fc1b337a7dde")
    captured: dict[str, object] = {}
    rows = [
        {
            "id": 2,
            "grade": "P265GH",
            "price_value": 68.38,
            "price_unit": "M",
            "currency": "EUR",
            "commercial_at": "2026-09-12T15:24:20.090286+00:00",
        }
    ]

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
    monkeypatch.setattr(
        queries.httpx,
        "AsyncClient",
        lambda timeout: FakeAsyncClient(captured, rows),
    )

    result = asyncio.run(
        queries.latest_price(
            owner_id=owner_id,
            grade="P265GH",
            outer_diameter_mm=406.4,
            thickness_mm=6.3,
        )
    )

    assert result == rows[0]
    assert captured["url"] == (
        "https://example.supabase.co/rest/v1/rpc/latest_offered_price_for_owner"
    )
    payload = captured["json"]
    assert isinstance(payload, dict)
    assert payload["target_owner_id"] == str(owner_id)
    assert payload["target_grade"] == "P265GH"
    assert payload["target_outer_diameter_mm"] == 406.4
    assert payload["target_thickness_mm"] == 6.3
    assert payload["target_width_mm"] is None
    assert payload["target_height_mm"] is None


def test_latest_price_returns_none_when_rpc_has_no_rows(monkeypatch) -> None:
    captured: dict[str, object] = {}
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
    monkeypatch.setattr(
        queries.httpx,
        "AsyncClient",
        lambda timeout: FakeAsyncClient(captured, []),
    )

    result = asyncio.run(
        queries.latest_price(
            owner_id=UUID("00000000-0000-0000-0000-000000000001"),
            grade="NO_MATCH",
        )
    )

    assert result is None
