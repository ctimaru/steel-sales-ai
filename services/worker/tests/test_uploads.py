import os
from io import BytesIO
from uuid import UUID

from fastapi.testclient import TestClient

os.environ["WORKER_STORAGE_MODE"] = "memory"

from app.extractor_v31 import extract_observations  # noqa: E402
from app.main import MAX_UPLOAD_BYTES, app, jobs  # noqa: E402
from app.repository import normalize_observation  # noqa: E402

client = TestClient(app)


def setup_function() -> None:
    jobs.clear()


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_upload_accepts_supported_documents() -> None:
    for filename in ("archive.zip", "message.eml", "offer.pdf", "prices.xlsx"):
        response = client.post(
            "/v1/uploads",
            files={"upload": (filename, BytesIO(b"document"), "application/octet-stream")},
        )
        assert response.status_code == 202
        payload = response.json()
        assert payload["filename"] == filename
        assert payload["status"] == "queued"


def test_upload_rejects_unsupported_extension() -> None:
    response = client.post(
        "/v1/uploads",
        files={"upload": ("image.png", BytesIO(b"data"), "image/png")},
    )
    assert response.status_code == 415


def test_upload_rejects_oversized_file() -> None:
    response = client.post(
        "/v1/uploads",
        files={"upload": ("large.pdf", BytesIO(b"x" * (MAX_UPLOAD_BYTES + 1)), "application/pdf")},
    )
    assert response.status_code == 413


def test_job_status_can_be_read() -> None:
    eml = b"Subject: Offer\\n\\nOffro 406,4x6,3x12000 S235JR EUR 61,50/mt"
    created = client.post(
        "/v1/uploads",
        files={"upload": ("offer.eml", BytesIO(eml), "message/rfc822")},
    )
    job_id = created.json()["job_id"]

    response = client.get(f"/v1/jobs/{job_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    assert response.json()["storage_path"].startswith("memory://")
    assert response.json()["result"]["parser_version"] == "v3.1"
    assert response.json()["result"]["extraction_count"] == 1


def test_unknown_job_returns_404() -> None:
    response = client.get("/v1/jobs/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_internal_token_is_enforced_when_configured(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "test-token")
    response = client.get("/v1/jobs/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 401
    response = client.get(
        "/v1/jobs/00000000-0000-0000-0000-000000000000",
        headers={"x-worker-token": "test-token"},
    )
    assert response.status_code == 404
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN")


def test_parser_is_line_scoped_and_preserves_roles() -> None:
    text = """
    Richiesta: 220x220x8 S355J2H 12.000 mm 55 ton
    Offro 406,4x6,3x12000 P265GH EN 10224 €68,38/mt
    Non abbiamo 323,9x7,1x12000 L275 disponibile
    """
    rows = extract_observations(text, "offer.eml")
    assert rows[0]["item_role"] == "requested"
    assert rows[0]["width_mm"] == 220
    assert rows[0]["height_mm"] == 220
    assert rows[0]["thickness_mm"] == 8
    assert rows[0]["quantity"] == 55
    assert rows[1]["item_role"] == "offered"
    assert rows[1]["outer_diameter_mm"] == 406.4
    assert rows[1]["price_value"] == 68.38
    assert rows[1]["price_unit"] == "M"
    assert rows[1]["standard"] == "EN 10224"
    assert rows[2]["availability_status"] == "unavailable"
    assert rows[2]["grade"] == "L275"


def test_parser_does_not_leak_grade_between_lines() -> None:
    rows = extract_observations(
        "Offro 406x6,3x12000 P265GH\nRichiesta 323,9x7,1x12000",
        "offer.eml",
    )
    assert rows[0]["grade"] == "P265GH"
    assert rows[1]["grade"] is None


def test_staging_rows_have_stable_bulk_insert_shape() -> None:
    job_id = UUID("00000000-0000-0000-0000-000000000001")
    first = normalize_observation(
        job_id,
        {"source_filename": "test.eml", "item_role": "requested", "grade": "P265GH"},
    )
    second = normalize_observation(
        job_id,
        {
            "source_filename": "test.eml",
            "item_role": "offered",
            "price_value": 68.38,
            "price_unit": "M",
            "currency": "EUR",
        },
    )

    assert first.keys() == second.keys()
    assert first["price_value"] is None
    assert second["grade"] is None
