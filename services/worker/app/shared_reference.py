from __future__ import annotations

from copy import deepcopy
from typing import Any

from .repository import WorkerRepository


_REFERENCE_RPC = "/rest/v1/rpc/p1_resolve_shared_steel_reference"


def _number(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _product_family(record: dict[str, Any]) -> str | None:
    explicit = record.get("product_type") or record.get("product_family")
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip()
    if _number(record.get("outer_diameter_mm")) is not None:
        return "round_tube"
    width = _number(record.get("width_mm"))
    height = _number(record.get("height_mm"))
    if width is not None and height is not None:
        return "square_tube" if width == height else "rectangular_tube"
    return None


def reference_signature(record: dict[str, Any]) -> tuple[object, ...]:
    return (
        (record.get("standard") or "").strip() if isinstance(record.get("standard"), str) else record.get("standard"),
        (record.get("grade") or "").strip() if isinstance(record.get("grade"), str) else record.get("grade"),
        _product_family(record),
        _number(record.get("outer_diameter_mm")),
        _number(record.get("width_mm")),
        _number(record.get("height_mm")),
        _number(record.get("thickness_mm")),
    )


async def resolve_shared_reference(
    repo: WorkerRepository,
    record: dict[str, Any],
) -> dict[str, Any]:
    standard, grade, product_family, od, width, height, thickness = reference_signature(record)
    result = await repo._request(
        "POST",
        _REFERENCE_RPC,
        json={
            "p_standard": standard or None,
            "p_grade": grade or None,
            "p_product_family": product_family,
            "p_outer_diameter_mm": od,
            "p_width_mm": width,
            "p_height_mm": height,
            "p_thickness_mm": thickness,
        },
    )
    if not isinstance(result, dict):
        raise RuntimeError("Shared steel reference resolver returned an invalid payload.")
    return result


async def enrich_records_with_shared_reference(
    repo: WorkerRepository,
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    cache: dict[tuple[object, ...], dict[str, Any]] = {}
    enriched: list[dict[str, Any]] = []
    for source in records:
        row = deepcopy(source)
        signature = reference_signature(row)
        resolution = cache.get(signature)
        if resolution is None:
            resolution = await resolve_shared_reference(repo, row)
            cache[signature] = resolution
        metadata = dict(row.get("metadata") or {})
        metadata["shared_reference"] = resolution
        row["metadata"] = metadata
        enriched.append(row)
    return enriched


async def validate_parser_observations_with_shared_reference(
    repo: WorkerRepository,
    observations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    enriched = await enrich_records_with_shared_reference(repo, observations)
    for row in enriched:
        metadata = dict(row.get("metadata") or {})
        resolution = metadata.get("shared_reference") or {}
        status = resolution.get("resolution_status")
        validation = dict(metadata.get("validation") or {})
        issues = list(validation.get("issues") or [])
        flags = list(metadata.get("flags") or [])

        issue_code: str | None = None
        severity = "warning"
        message: str | None = None
        if status in {"standard_not_found", "grade_not_found", "geometry_not_found"}:
            issue_code = f"reference_{status}"
            message = "Parsed steel attributes are not present in the current Shared Steel Knowledge catalog."
        elif status in {"standard_grade_not_applicable", "standard_dimension_not_applicable"}:
            issue_code = f"reference_{status}"
            severity = "error"
            message = "Parsed steel attributes conflict with current standard applicability evidence."
        elif status == "matched_canonical_missing":
            issue_code = "reference_canonical_weight_missing"
            message = "Reference identity matched, but no canonical commercial weight is available."

        if issue_code and issue_code not in flags:
            issues.append(
                {
                    "code": issue_code,
                    "severity": severity,
                    "field": "shared_reference",
                    "message": message,
                }
            )
            flags.append(issue_code)
            validation["issues"] = issues
            if severity == "error":
                validation["status"] = "invalid"
            elif validation.get("status") == "valid":
                validation["status"] = "review_required"

        metadata["validation"] = validation
        metadata["flags"] = flags
        row["metadata"] = metadata
    return enriched
