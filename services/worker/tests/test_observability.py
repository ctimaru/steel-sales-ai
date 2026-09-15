from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.observability as observability


def test_trace_id_accepts_valid_uuid_and_replaces_invalid_value() -> None:
    trace_id = uuid4()
    assert observability.parse_trace_id(str(trace_id)) == trace_id
    replacement = observability.parse_trace_id("not-a-uuid")
    assert isinstance(replacement, UUID)
    assert replacement != trace_id


def test_error_sanitizer_redacts_common_secret_shapes() -> None:
    message = observability.sanitize_error(
        "upstream failed Bearer abc.def.ghi token=very-secret password:another-secret"
    )
    assert message is not None
    assert "abc.def.ghi" not in message
    assert "very-secret" not in message
    assert "another-secret" not in message
    assert message.count("[REDACTED]") == 3


def test_hf_cost_is_null_until_an_explicit_rate_exists(monkeypatch) -> None:
    monkeypatch.delenv("HF_EMBEDDING_COST_PER_1M_CHARS_USD", raising=False)
    assert observability.estimate_hf_embedding_cost(500) is None

    monkeypatch.setenv("HF_EMBEDDING_COST_PER_1M_CHARS_USD", "2")
    assert observability.estimate_hf_embedding_cost(500) == Decimal("0.001")

    monkeypatch.setenv("HF_EMBEDDING_COST_PER_1M_CHARS_USD", "not-a-number")
    assert observability.estimate_hf_embedding_cost(500) is None


def test_request_middleware_propagates_trace_and_emits_structured_event(monkeypatch) -> None:
    emitted = []
    monkeypatch.setattr(observability, "queue_event", emitted.append)

    app = FastAPI()

    @app.get("/probe")
    async def probe():
        return {"ok": True}

    observability.install_observability(app)
    trace_id = uuid4()

    with TestClient(app) as client:
        response = client.get("/probe", headers={observability.TRACE_HEADER: str(trace_id)})

    assert response.status_code == 200
    assert response.headers[observability.TRACE_HEADER] == str(trace_id)
    assert len(emitted) == 1
    event = emitted[0]
    assert event["event_type"] == "request"
    assert event["operation"] == "GET /probe"
    assert event["status"] == "ok"
    assert event["http_status"] == 200
    assert event["trace_id"] == str(trace_id)
    assert event["duration_ms"] >= 0
    assert "body" not in event


def test_request_middleware_records_unhandled_failure_without_payload(monkeypatch) -> None:
    emitted = []
    monkeypatch.setattr(observability, "queue_event", emitted.append)

    app = FastAPI()

    @app.get("/boom")
    async def boom():
        raise RuntimeError("failure token=do-not-store")

    observability.install_observability(app)

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/boom")

    assert response.status_code == 500
    assert len(emitted) == 1
    event = emitted[0]
    assert event["event_type"] == "request"
    assert event["status"] == "error"
    assert event["http_status"] == 500
    assert "do-not-store" not in event["error_message"]
    assert "[REDACTED]" in event["error_message"]
    assert event["metadata"] == {"method": "GET", "route": "/boom"}
