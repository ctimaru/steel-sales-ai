from __future__ import annotations

import os

from fastapi.testclient import TestClient

os.environ["WORKER_STORAGE_MODE"] = "memory"

import app.main as main  # noqa: E402

client = TestClient(main.app)


def test_latest_price_requires_owner_id() -> None:
    response = client.post(
        "/v1/ai/latest-price",
        json={"grade": "P265GH", "outer_diameter_mm": 406.4, "thickness_mm": 6.3},
    )
    assert response.status_code == 422


def test_latest_price_forwards_verified_owner_scope(monkeypatch) -> None:
    captured: dict[str, object] = {}

    async def fake_latest_price(**kwargs):
        captured.update(kwargs)
        return {
            "id": 2,
            "grade": "P265GH",
            "price_value": 68.38,
            "price_unit": "M",
            "currency": "EUR",
        }

    monkeypatch.setattr(main, "latest_price", fake_latest_price)
    response = client.post(
        "/v1/ai/latest-price",
        json={
            "owner_id": "f45fab6e-3da8-41aa-8711-fc1b337a7dde",
            "grade": "P265GH",
            "outer_diameter_mm": 406.4,
            "thickness_mm": 6.3,
        },
    )

    assert response.status_code == 200
    assert response.json()["found"] is True
    assert str(captured["owner_id"]) == "f45fab6e-3da8-41aa-8711-fc1b337a7dde"
    assert captured["grade"] == "P265GH"
    assert captured["outer_diameter_mm"] == 406.4
    assert captured["thickness_mm"] == 6.3
