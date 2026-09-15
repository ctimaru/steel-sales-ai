from __future__ import annotations

import asyncio
import hmac
import json
import os
import re
import sys
from contextvars import ContextVar, Token
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from time import perf_counter
from typing import Any
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, FastAPI, Header, HTTPException, Request

TRACE_HEADER = "X-Trace-ID"
CONTRACT = "p0.9-v1"
MAX_ERROR_LENGTH = 500

_trace_id: ContextVar[UUID | None] = ContextVar("steel_sales_ai_trace_id", default=None)
_span_id: ContextVar[UUID | None] = ContextVar("steel_sales_ai_span_id", default=None)
_pending_tasks: set[asyncio.Task[None]] = set()

_SECRET_PATTERNS = (
    re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._~+/=-]+"),
    re.compile(r"(?i)((?:api[_-]?key|token|secret|password)\s*[=:]\s*)[^\s,;]+"),
)

router = APIRouter(prefix="/v1/ops", tags=["operations"])


def parse_trace_id(value: str | None) -> UUID:
    if value:
        try:
            return UUID(value.strip())
        except (ValueError, AttributeError):
            pass
    return uuid4()


def get_trace_id() -> UUID:
    trace_id = _trace_id.get()
    if trace_id is None:
        trace_id = uuid4()
        _trace_id.set(trace_id)
    return trace_id


def get_span_id() -> UUID | None:
    return _span_id.get()


def bind_trace(trace_id: UUID, span_id: UUID | None = None) -> tuple[Token[UUID | None], Token[UUID | None]]:
    return _trace_id.set(trace_id), _span_id.set(span_id or uuid4())


def reset_trace(tokens: tuple[Token[UUID | None], Token[UUID | None]]) -> None:
    trace_token, span_token = tokens
    _span_id.reset(span_token)
    _trace_id.reset(trace_token)


def sanitize_error(value: object | None) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split())
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub(r"\1[REDACTED]", text)
    return text[:MAX_ERROR_LENGTH] or None


def _uuid_or_none(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(UUID(value))
    except (ValueError, AttributeError):
        return None


def _environment() -> str:
    return (
        os.getenv("RAILWAY_ENVIRONMENT_NAME")
        or os.getenv("VERCEL_ENV")
        or os.getenv("APP_ENV")
        or "production"
    )[:80]


def _structured_log(event: dict[str, Any]) -> None:
    level = "error" if event.get("status") == "error" else "info"
    payload = {
        "schema": "steel_sales_ai.observability.v1",
        "timestamp": datetime.now(UTC).isoformat(),
        "level": level,
        **event,
    }
    sys.stdout.write(json.dumps(payload, default=str, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def _supabase_config() -> tuple[str, str] | None:
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base_url or not key:
        return None
    return base_url, key


async def _persist_event(event: dict[str, Any]) -> None:
    config = _supabase_config()
    if config is None or os.getenv("OBSERVABILITY_PERSIST", "true").lower() in {"0", "false", "no"}:
        return
    base_url, key = config
    headers = {
        "Authorization": f"Bearer {key}",
        "apikey": key,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.post(
                f"{base_url}/rest/v1/observability_events",
                headers=headers,
                json=event,
            )
        if response.is_error:
            raise RuntimeError(f"HTTP {response.status_code}")
    except Exception as exc:  # observability must never break the product path
        _structured_log(
            {
                "service": "worker",
                "environment": _environment(),
                "event_type": "system",
                "operation": "observability.persist",
                "status": "error",
                "trace_id": str(event.get("trace_id") or get_trace_id()),
                "span_id": str(uuid4()),
                "parent_span_id": str(event.get("span_id")) if event.get("span_id") else None,
                "error_class": type(exc).__name__,
                "error_message": sanitize_error(exc),
                "metadata": {"persisted": False},
            }
        )


def queue_event(event: dict[str, Any]) -> None:
    _structured_log(event)
    if _supabase_config() is None:
        return
    try:
        task = asyncio.create_task(_persist_event(event))
    except RuntimeError:
        return
    _pending_tasks.add(task)
    task.add_done_callback(_pending_tasks.discard)


async def flush_pending_events() -> None:
    if _pending_tasks:
        await asyncio.gather(*tuple(_pending_tasks), return_exceptions=True)


def _base_event(
    *,
    event_type: str,
    operation: str,
    status: str,
    duration_ms: float | None = None,
    trace_id: UUID | None = None,
    parent_span_id: UUID | None = None,
    owner_id: UUID | str | None = None,
    organization_id: UUID | str | None = None,
    job_id: UUID | str | None = None,
    error: BaseException | str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    trace = trace_id or get_trace_id()
    return {
        "service": "worker",
        "environment": _environment(),
        "trace_id": str(trace),
        "span_id": str(uuid4()),
        "parent_span_id": str(parent_span_id or get_span_id()) if (parent_span_id or get_span_id()) else None,
        "event_type": event_type,
        "operation": operation[:160],
        "status": status,
        "duration_ms": round(duration_ms, 3) if duration_ms is not None else None,
        "organization_id": str(organization_id) if organization_id else None,
        "owner_id": str(owner_id) if owner_id else None,
        "job_id": str(job_id) if job_id else None,
        "error_class": type(error).__name__ if isinstance(error, BaseException) else ("Error" if error else None),
        "error_message": sanitize_error(error),
        "metadata": metadata or {},
    }


def record_provider_event(
    *,
    operation: str,
    provider: str,
    model: str,
    status: str,
    duration_ms: float,
    usage_quantity: int | float | Decimal | None,
    usage_unit: str | None,
    estimated_cost_usd: Decimal | float | None = None,
    error: BaseException | str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    event = _base_event(
        event_type="provider",
        operation=operation,
        status=status,
        duration_ms=duration_ms,
        error=error,
        metadata=metadata,
    )
    event.update(
        {
            "provider": provider[:120],
            "model": model[:200],
            "usage_quantity": float(usage_quantity) if usage_quantity is not None else None,
            "usage_unit": usage_unit,
            "estimated_cost_usd": float(estimated_cost_usd) if estimated_cost_usd is not None else None,
        }
    )
    queue_event(event)


def estimate_hf_embedding_cost(input_chars: int) -> Decimal | None:
    """Price observed embedding input only when an explicit rate is configured.

    Hugging Face inference pricing varies by provider/model/compute. P0.9 therefore
    never guesses a price. Operators may set HF_EMBEDDING_COST_PER_1M_CHARS_USD
    when they have an applicable accounting rate; otherwise cost remains null.
    """

    raw = os.getenv("HF_EMBEDDING_COST_PER_1M_CHARS_USD", "").strip()
    if not raw:
        return None
    try:
        rate = Decimal(raw)
    except InvalidOperation:
        return None
    if rate < 0:
        return None
    return (Decimal(input_chars) / Decimal(1_000_000)) * rate


def _require_ops_token(x_worker_token: str | None) -> None:
    expected = os.getenv("WORKER_INTERNAL_TOKEN", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Worker internal token is not configured.")
    supplied = x_worker_token or ""
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid worker token.")


async def _supabase_request(method: str, path: str, *, json_body: Any = None) -> Any:
    config = _supabase_config()
    if config is None:
        raise HTTPException(status_code=503, detail="Observability persistence is not configured.")
    base_url, key = config
    headers = {
        "Authorization": f"Bearer {key}",
        "apikey": key,
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.request(
                method,
                f"{base_url}{path}",
                headers=headers,
                json=json_body,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Observability backend unavailable.") from exc
    if response.is_error:
        raise HTTPException(status_code=503, detail=f"Observability backend returned HTTP {response.status_code}.")
    if not response.content:
        return None
    return response.json()


@router.get("/observability")
async def observability_health(
    window_minutes: int = 60,
    x_worker_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_ops_token(x_worker_token)
    if window_minutes < 5 or window_minutes > 10080:
        raise HTTPException(status_code=400, detail="window_minutes must be between 5 and 10080.")
    result = await _supabase_request(
        "POST",
        "/rest/v1/rpc/observability_health",
        json_body={"p_window_minutes": window_minutes},
    )
    if not isinstance(result, dict):
        raise HTTPException(status_code=503, detail="Observability health returned an invalid payload.")
    return result


@router.get("/traces/{trace_id}")
async def trace_events(
    trace_id: UUID,
    x_worker_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_ops_token(x_worker_token)
    fields = (
        "id,occurred_at,service,environment,trace_id,span_id,parent_span_id,"
        "event_type,operation,status,duration_ms,http_status,job_id,provider,model,"
        "usage_quantity,usage_unit,estimated_cost_usd,error_class,error_message,metadata"
    )
    rows = await _supabase_request(
        "GET",
        f"/rest/v1/observability_events?trace_id=eq.{trace_id}&select={fields}&order=occurred_at.asc&limit=200",
    )
    if not isinstance(rows, list):
        raise HTTPException(status_code=503, detail="Trace lookup returned an invalid payload.")
    return {"trace_id": str(trace_id), "count": len(rows), "events": rows}


def install_observability(app: FastAPI) -> None:
    excluded_paths = {"/health", "/v1/ops/observability"}

    @app.middleware("http")
    async def application_observability(request: Request, call_next):  # type: ignore[no-untyped-def]
        trace_id = parse_trace_id(request.headers.get(TRACE_HEADER))
        root_span = uuid4()
        tokens = bind_trace(trace_id, root_span)
        started = perf_counter()
        response = None
        try:
            response = await call_next(request)
            duration_ms = (perf_counter() - started) * 1000
            response.headers[TRACE_HEADER] = str(trace_id)
            if request.url.path not in excluded_paths and not request.url.path.startswith("/v1/ops/traces/"):
                route = request.scope.get("route")
                route_path = getattr(route, "path", request.url.path)
                status_code = int(response.status_code)
                event_status = "error" if status_code >= 500 else "client_error" if status_code >= 400 else "ok"
                owner_id = _uuid_or_none(request.headers.get("x-owner-id"))
                event = _base_event(
                    event_type="request",
                    operation=f"{request.method} {route_path}",
                    status=event_status,
                    duration_ms=duration_ms,
                    trace_id=trace_id,
                    parent_span_id=None,
                    owner_id=owner_id,
                    metadata={"method": request.method, "route": route_path},
                )
                event["parent_span_id"] = None
                event["span_id"] = str(root_span)
                event["http_status"] = status_code
                queue_event(event)
            return response
        except Exception as exc:
            duration_ms = (perf_counter() - started) * 1000
            if request.url.path not in excluded_paths:
                route = request.scope.get("route")
                route_path = getattr(route, "path", request.url.path)
                event = _base_event(
                    event_type="request",
                    operation=f"{request.method} {route_path}",
                    status="error",
                    duration_ms=duration_ms,
                    trace_id=trace_id,
                    parent_span_id=None,
                    error=exc,
                    metadata={"method": request.method, "route": route_path},
                )
                event["parent_span_id"] = None
                event["span_id"] = str(root_span)
                event["http_status"] = 500
                queue_event(event)
            raise
        finally:
            reset_trace(tokens)

    app.add_event_handler("shutdown", flush_pending_events)
