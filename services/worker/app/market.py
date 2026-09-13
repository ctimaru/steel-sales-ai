from __future__ import annotations

import csv
import io
import os
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

import httpx


EUROSTAT_SOURCE_KEY = "eurostat_it_c242_ppi_domestic"
ECB_SOURCE_KEY = "ecb_eurusd_monthly"
MARKET_CACHE_HOURS = 12
HTTP_TIMEOUT_SECONDS = 25


class MarketConfigurationError(RuntimeError):
    pass


class MarketDataError(RuntimeError):
    pass


def _configuration() -> tuple[str, str]:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_role_key:
        raise MarketConfigurationError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for market data."
        )
    return supabase_url, service_role_key


def _decimal(value: object) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _period_date(value: str) -> date:
    if len(value) >= 7 and value[4] == "-":
        return date(int(value[:4]), int(value[5:7]), 1)
    raise MarketDataError(f"Unsupported monthly period: {value}")


def _category_positions(category: dict[str, Any]) -> list[tuple[str, int]]:
    index = category.get("index", {})
    if isinstance(index, dict):
        result: list[tuple[str, int]] = []
        for key, position in index.items():
            try:
                result.append((str(key), int(position)))
            except (TypeError, ValueError):
                continue
        return sorted(result, key=lambda item: item[1])
    if isinstance(index, list):
        return [(str(key), position) for position, key in enumerate(index)]
    return []


def _flat_jsonstat_position(
    *,
    dimension_ids: list[str],
    dimension_sizes: list[int],
    time_position: int,
) -> int:
    coordinates: list[int] = []
    for dimension_id, size in zip(dimension_ids, dimension_sizes, strict=True):
        if dimension_id == "time":
            coordinates.append(time_position)
        elif size == 1:
            coordinates.append(0)
        else:
            raise MarketDataError(
                f"Eurostat response was not fully filtered on dimension {dimension_id}."
            )

    flat = 0
    for coordinate, size in zip(coordinates, dimension_sizes, strict=True):
        flat = flat * size + coordinate
    return flat


def parse_eurostat_jsonstat(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse a filtered Eurostat JSON-stat 2 response into monthly observations."""

    dimension_ids = [str(value) for value in payload.get("id", [])]
    dimension_sizes = [int(value) for value in payload.get("size", [])]
    dimensions = payload.get("dimension", {})
    time_dimension = dimensions.get("time", {}) if isinstance(dimensions, dict) else {}
    time_category = time_dimension.get("category", {}) if isinstance(time_dimension, dict) else {}
    periods = _category_positions(time_category if isinstance(time_category, dict) else {})
    values = payload.get("value", {})
    statuses = payload.get("status", {})

    if "time" not in dimension_ids or not periods:
        raise MarketDataError("Eurostat response does not contain a usable time dimension.")
    if len(dimension_ids) != len(dimension_sizes):
        raise MarketDataError("Eurostat response has inconsistent dimensions.")

    observations: list[dict[str, Any]] = []
    for period_label, time_position in periods:
        flat_position = _flat_jsonstat_position(
            dimension_ids=dimension_ids,
            dimension_sizes=dimension_sizes,
            time_position=time_position,
        )
        raw_value: object | None
        if isinstance(values, list):
            raw_value = values[flat_position] if flat_position < len(values) else None
        elif isinstance(values, dict):
            raw_value = values.get(str(flat_position), values.get(flat_position))
        else:
            raw_value = None

        numeric_value = _decimal(raw_value)
        if numeric_value is None:
            continue

        status_value: object | None = None
        if isinstance(statuses, list):
            status_value = statuses[flat_position] if flat_position < len(statuses) else None
        elif isinstance(statuses, dict):
            status_value = statuses.get(str(flat_position), statuses.get(flat_position))

        observations.append(
            {
                "period": _period_date(period_label).isoformat(),
                "value": str(numeric_value),
                "unit": "I21",
                "metadata": {
                    "provider_updated": payload.get("updated"),
                    "status": status_value,
                    "period_label": period_label,
                },
            }
        )
    return observations


def parse_ecb_csv(content: str) -> list[dict[str, Any]]:
    """Parse ECB SDMX-CSV monthly observations."""

    reader = csv.DictReader(io.StringIO(content))
    observations: list[dict[str, Any]] = []
    for row in reader:
        period_label = (row.get("TIME_PERIOD") or "").strip()
        numeric_value = _decimal(row.get("OBS_VALUE"))
        if not period_label or numeric_value is None:
            continue
        observations.append(
            {
                "period": _period_date(period_label).isoformat(),
                "value": str(numeric_value),
                "unit": "USD_PER_EUR",
                "metadata": {
                    "period_label": period_label,
                    "obs_status": row.get("OBS_STATUS"),
                    "decimals": row.get("DECIMALS"),
                },
            }
        )
    return observations


class MarketRepository:
    def __init__(self) -> None:
        self.base_url, self.key = _configuration()
        self.headers = {
            "Authorization": f"Bearer {self.key}",
            "apikey": self.key,
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        prefer: str | None = None,
    ) -> Any:
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(
                method,
                f"{self.base_url}{path}",
                headers=headers,
                json=json,
            )
        if response.is_error:
            detail = response.text.strip()
            suffix = f" Response: {detail[:500]}" if detail else ""
            raise MarketDataError(
                f"Supabase market persistence failed with HTTP {response.status_code}.{suffix}"
            )
        if not response.content:
            return None
        return response.json()

    async def sources(self) -> list[dict[str, Any]]:
        rows = await self._request(
            "GET",
            "/rest/v1/market_sources?is_active=eq.true&select=*&order=key.asc",
        )
        return rows if isinstance(rows, list) else []

    async def observations(self, source_id: str, limit: int = 60) -> list[dict[str, Any]]:
        rows = await self._request(
            "GET",
            "/rest/v1/market_observations"
            f"?source_id=eq.{source_id}&select=period,value,unit,metadata,fetched_at"
            f"&order=period.desc&limit={max(1, min(limit, 240))}",
        )
        result = rows if isinstance(rows, list) else []
        result.reverse()
        return result

    async def create_sync_run(self, source_id: str) -> str:
        rows = await self._request(
            "POST",
            "/rest/v1/market_sync_runs",
            json={"source_id": source_id, "status": "running"},
            prefer="return=representation",
        )
        if not isinstance(rows, list) or not rows:
            raise MarketDataError("Could not create market sync run.")
        return str(rows[0]["id"])

    async def finish_sync_run(
        self,
        run_id: str,
        *,
        status: str,
        observation_count: int,
        error: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        await self._request(
            "PATCH",
            f"/rest/v1/market_sync_runs?id=eq.{run_id}",
            json={
                "status": status,
                "observation_count": observation_count,
                "error": error,
                "metadata": metadata or {},
                "completed_at": datetime.now(UTC).isoformat(),
            },
            prefer="return=minimal",
        )

    async def update_source(self, source_id: str, values: dict[str, Any]) -> None:
        await self._request(
            "PATCH",
            f"/rest/v1/market_sources?id=eq.{source_id}",
            json={**values, "updated_at": datetime.now(UTC).isoformat()},
            prefer="return=minimal",
        )

    async def upsert_observations(
        self,
        source_id: str,
        observations: list[dict[str, Any]],
    ) -> None:
        if not observations:
            return
        fetched_at = datetime.now(UTC).isoformat()
        rows = [
            {
                "source_id": source_id,
                "period": observation["period"],
                "value": observation["value"],
                "unit": observation["unit"],
                "metadata": observation.get("metadata") or {},
                "fetched_at": fetched_at,
            }
            for observation in observations
        ]
        await self._request(
            "POST",
            "/rest/v1/market_observations?on_conflict=source_id%2Cperiod",
            json=rows,
            prefer="resolution=merge-duplicates,return=minimal",
        )


async def _fetch_eurostat(source: dict[str, Any]) -> list[dict[str, Any]]:
    configuration = source.get("configuration") or {}
    filters = configuration.get("filters") or {}
    params = {
        "lang": "EN",
        "geo": str(filters.get("geo") or "IT"),
        "nace_r2": str(filters.get("nace_r2") or "C242"),
        "unit": str(filters.get("unit") or "I21"),
        "sinceTimePeriod": "2021-01",
    }
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        response = await client.get(
            str(source["source_url"]),
            params=params,
            headers={"User-Agent": "SteelSalesAI/0.1 MarketIntelligence"},
        )
    if response.is_error:
        raise MarketDataError(f"Eurostat returned HTTP {response.status_code}.")
    payload = response.json()
    if not isinstance(payload, dict):
        raise MarketDataError("Eurostat returned an invalid payload.")
    return parse_eurostat_jsonstat(payload)


async def _fetch_ecb(source: dict[str, Any]) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        response = await client.get(
            str(source["source_url"]),
            params={"startPeriod": "2021-01-01", "format": "csvdata"},
            headers={"Accept": "text/csv", "User-Agent": "SteelSalesAI/0.1 MarketIntelligence"},
        )
    if response.is_error:
        raise MarketDataError(f"ECB returned HTTP {response.status_code}.")
    return parse_ecb_csv(response.text)


async def fetch_source(source: dict[str, Any]) -> list[dict[str, Any]]:
    key = str(source.get("key") or "")
    if key == EUROSTAT_SOURCE_KEY:
        return await _fetch_eurostat(source)
    if key == ECB_SOURCE_KEY:
        return await _fetch_ecb(source)
    raise MarketDataError(f"Unsupported market source: {key}")


def _parse_timestamp(value: object) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def source_is_stale(source: dict[str, Any], now: datetime | None = None) -> bool:
    current = now or datetime.now(UTC)
    last_success = _parse_timestamp(source.get("last_success_at"))
    return last_success is None or current - last_success >= timedelta(hours=MARKET_CACHE_HOURS)


async def sync_source(repo: MarketRepository, source: dict[str, Any]) -> int:
    source_id = str(source["id"])
    attempted_at = datetime.now(UTC).isoformat()
    await repo.update_source(source_id, {"last_attempt_at": attempted_at})
    run_id = await repo.create_sync_run(source_id)
    try:
        observations = await fetch_source(source)
        if not observations:
            raise MarketDataError(f"{source.get('provider', 'Market source')} returned no observations.")
        await repo.upsert_observations(source_id, observations)
        completed_at = datetime.now(UTC).isoformat()
        await repo.update_source(
            source_id,
            {
                "last_success_at": completed_at,
                "last_error": None,
            },
        )
        await repo.finish_sync_run(
            run_id,
            status="success",
            observation_count=len(observations),
            metadata={"source_key": source.get("key")},
        )
        return len(observations)
    except (httpx.HTTPError, ValueError, KeyError, MarketDataError) as exc:
        message = str(exc)
        await repo.update_source(source_id, {"last_error": message})
        await repo.finish_sync_run(
            run_id,
            status="failed",
            observation_count=0,
            error=message,
            metadata={"source_key": source.get("key")},
        )
        raise MarketDataError(message) from exc


def _float_value(value: object) -> float | None:
    numeric = _decimal(value)
    return float(numeric) if numeric is not None else None


def _percent_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous in (None, 0):
        return None
    return round((current / previous - 1) * 100, 2)


def _one_year_before(period: date) -> date:
    return date(period.year - 1, period.month, 1)


def summarize_source(
    source: dict[str, Any],
    observations: list[dict[str, Any]],
    *,
    sync_error: str | None = None,
) -> dict[str, Any]:
    series = [
        {
            "period": row.get("period"),
            "value": _float_value(row.get("value")),
            "unit": row.get("unit"),
            "metadata": row.get("metadata") or {},
        }
        for row in observations
        if _float_value(row.get("value")) is not None
    ]
    latest = series[-1] if series else None
    previous = series[-2] if len(series) >= 2 else None
    year_ago = None
    if latest and latest.get("period"):
        try:
            latest_period = date.fromisoformat(str(latest["period"])[:10])
            target = _one_year_before(latest_period).isoformat()
            year_ago = next((row for row in series if str(row.get("period"))[:10] == target), None)
        except ValueError:
            year_ago = None

    configuration = source.get("configuration") or {}
    latest_value = latest.get("value") if latest else None
    return {
        "key": source.get("key"),
        "name": source.get("name"),
        "provider": source.get("provider"),
        "source_url": source.get("source_url"),
        "series_type": source.get("series_type"),
        "frequency": source.get("frequency"),
        "unit": source.get("unit"),
        "display_unit": configuration.get("display_unit") or source.get("unit"),
        "geography": source.get("geography"),
        "category": source.get("category"),
        "latest": latest,
        "change_mom_pct": _percent_change(
            latest_value,
            previous.get("value") if previous else None,
        ),
        "change_yoy_pct": _percent_change(
            latest_value,
            year_ago.get("value") if year_ago else None,
        ),
        "series": series,
        "observation_count": len(series),
        "last_attempt_at": source.get("last_attempt_at"),
        "last_success_at": source.get("last_success_at"),
        "last_error": source.get("last_error"),
        "sync_error": sync_error,
    }


async def get_market_overview(*, refresh: bool = True, force: bool = False) -> dict[str, Any]:
    repo = MarketRepository()
    sources = await repo.sources()
    refresh_errors: dict[str, str] = {}

    if refresh:
        for source in sources:
            if force or source_is_stale(source):
                try:
                    await sync_source(repo, source)
                except MarketDataError as exc:
                    refresh_errors[str(source.get("key"))] = str(exc)
        sources = await repo.sources()

    source_payloads: list[dict[str, Any]] = []
    for source in sources:
        rows = await repo.observations(str(source["id"]), limit=60)
        source_payloads.append(
            summarize_source(
                source,
                rows,
                sync_error=refresh_errors.get(str(source.get("key"))),
            )
        )

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "cache_hours": MARKET_CACHE_HOURS,
        "sources": source_payloads,
    }
