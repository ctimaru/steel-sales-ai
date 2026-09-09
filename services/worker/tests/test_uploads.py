from io import BytesIO

from fastapi.testclient import TestClient

from app.main import MAX_UPLOAD_BYTES, app, jobs

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
    created = client.post(
        "/v1/uploads",
        files={"upload": ("offer.pdf", BytesIO(b"data"), "application/pdf")},
    )
    job_id = created.json()["job_id"]

    response = client.get(f"/v1/jobs/{job_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "queued"


def test_unknown_job_returns_404() -> None:
    response = client.get("/v1/jobs/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
