from __future__ import annotations

import re
from typing import Any

from .extractor_v31 import (
    DIMENSIONS_RE,
    LABELED_QUANTITY_RE,
    LENGTH_RE,
    PRICE_RE,
    PRICE_SUFFIX_RE,
    QUANTITY_RE,
    _availability,
    _document_text,
    _quantity_unit,
    _role,
    number,
    scalar,
)

GRADE_RE_V4 = re.compile(
    r"\b(?:P\d{3}(?:GH|TR[12]|NH)?|S\d{3}(?:(?:JR|J0|J2|K2)H?)?|L\d{3}(?:N|M|Q)?)\b",
    re.IGNORECASE,
)
STANDARD_RE_V4 = re.compile(
    r"\b(?:EN\s*\d{4,5}(?:[-:]\d+)?(?:\s*[A-Z]\d+)?|API\s*5L)\b",
    re.IGNORECASE,
)
PACK_QUANTITY_RE_V4 = re.compile(
    rf"\b(?P<value>{NUMBER})\s*(?P<unit>pacc(?:o|hi))\b",
    re.IGNORECASE,
)
BARE_LENGTH_RE_V4 = re.compile(
    rf"\b(?:a|l(?:unghezza)?\.?)[\s:=]*(?P<value>{NUMBER})\b",
    re.IGNORECASE,
)

HIGH_CONFIDENCE = 0.90
MEDIUM_CONFIDENCE = 0.75


def _issue(code: str, severity: str, field: str, message: str) -> dict[str, str]:
    return {
        "code": code,
        "severity": severity,
        "field": field,
        "message": message,
    }


def _dimension_fields(match: re.Match[str]) -> tuple[dict[str, int | float], str]:
    first = number(match.group("a"))
    second = number(match.group("b"))
    third = number(match.group("c")) if match.group("c") else None

    if third is None:
        return (
            {
                "outer_diameter_mm": scalar(first),
                "thickness_mm": scalar(second),
            },
            "round_od_thickness",
        )

    # Three-value tube dimensions are ambiguous in raw commercial text:
    #   406.4 x 6.3 x 12000 -> round OD x wall x length
    #   300 x 100 x 5      -> rectangular width x height x wall
    # A physically plausible section wall must be smaller than half the
    # smallest side. Zero is kept as section geometry so validation can route
    # the source to review instead of silently reinterpreting it as round.
    section_like = third <= 0 or third < min(first, second) / 2
    if section_like:
        family = "square" if abs(first - second) < 0.001 else "rectangular"
        return (
            {
                "width_mm": scalar(first),
                "height_mm": scalar(second),
                "thickness_mm": scalar(third),
            },
            f"{family}_width_height_thickness",
        )

    return (
        {
            "outer_diameter_mm": scalar(first),
            "thickness_mm": scalar(second),
            "length_mm": scalar(third),
        },
        "round_od_thickness_length",
    )


def _validate(row: dict[str, Any], has_dimensions: bool) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    od = row.get("outer_diameter_mm")
    width = row.get("width_mm")
    height = row.get("height_mm")
    thickness = row.get("thickness_mm")

    if not has_dimensions:
        issues.append(
            _issue(
                "missing_product_geometry",
                "warning",
                "dimensions",
                "No tube geometry was extracted from the source line.",
            )
        )

    if od is not None and od <= 0:
        issues.append(
            _issue(
                "dimension_non_positive",
                "error",
                "outer_diameter_mm",
                "Outer diameter must be greater than zero.",
            )
        )

    for field_name, value in (("width_mm", width), ("height_mm", height)):
        if value is not None and value <= 0:
            issues.append(
                _issue(
                    "dimension_non_positive",
                    "error",
                    field_name,
                    "Section dimensions must be greater than zero.",
                )
            )

    if thickness is not None and thickness <= 0:
        issues.append(
            _issue(
                "invalid_wall_thickness",
                "error",
                "thickness_mm",
                "Wall thickness must be greater than zero.",
            )
        )
    elif thickness is not None and od is not None and od > 0 and thickness >= od / 2:
        issues.append(
            _issue(
                "invalid_wall_thickness_ratio",
                "error",
                "thickness_mm",
                "Wall thickness must be smaller than the tube radius.",
            )
        )
    elif (
        thickness is not None
        and width is not None
        and height is not None
        and width > 0
        and height > 0
        and thickness >= min(width, height) / 2
    ):
        issues.append(
            _issue(
                "invalid_wall_thickness_ratio",
                "error",
                "thickness_mm",
                "Wall thickness must be smaller than half the smallest section side.",
            )
        )

    for field_name, code in (
        ("length_mm", "invalid_length"),
        ("quantity", "invalid_quantity"),
        ("price_value", "invalid_price"),
    ):
        value = row.get(field_name)
        if value is not None and value <= 0:
            issues.append(
                _issue(
                    code,
                    "error",
                    field_name,
                    f"{field_name} must be greater than zero when present.",
                )
            )

    return issues


def _confidence(
    *,
    has_dimensions: bool,
    has_grade: bool,
    has_standard: bool,
    has_commercial_signal: bool,
    issues: list[dict[str, str]],
) -> tuple[float, str, dict[str, float]]:
    components = {
        "base": 0.55,
        "geometry": 0.25 if has_dimensions else 0.0,
        "grade": 0.10 if has_grade else 0.0,
        "standard": 0.05 if has_standard else 0.0,
        "commercial_context": 0.05 if has_commercial_signal else 0.0,
    }
    score = min(1.0, round(sum(components.values()), 4))

    if any(issue["severity"] == "error" for issue in issues):
        score = min(score, 0.35)

    band = "high" if score >= HIGH_CONFIDENCE else "medium" if score >= MEDIUM_CONFIDENCE else "low"
    return score, band, components


def _validation_status(issues: list[dict[str, str]]) -> str:
    if any(issue["severity"] == "error" for issue in issues):
        return "invalid"
    if issues:
        return "review_required"
    return "valid"


def _cohesive_lines(text: str) -> list[str]:
    lines = [" ".join(raw_line.split()).strip() for raw_line in text.splitlines()]
    lines = [line for line in lines if line]
    cohesive: list[str] = []
    consumed: set[int] = set()

    for index, line in enumerate(lines):
        if index in consumed:
            continue
        if not DIMENSIONS_RE.search(line):
            cohesive.append(line)
            continue

        parts = [line]
        for offset in (1, 2):
            follower_index = index + offset
            if follower_index >= len(lines):
                break
            follower = lines[follower_index]
            if DIMENSIONS_RE.search(follower):
                break
            continuation_signal = any(
                (
                    GRADE_RE_V4.search(follower),
                    STANDARD_RE_V4.search(follower),
                    PACK_QUANTITY_RE_V4.search(follower),
                    LABELED_QUANTITY_RE.search(follower),
                    QUANTITY_RE.search(follower),
                )
            )
            if not continuation_signal:
                break
            parts.append(follower)
            consumed.add(follower_index)

        cohesive.append(" | ".join(parts))

    return cohesive


def extract_observations(text: str, source_filename: str) -> list[dict[str, Any]]:
    observations: list[dict[str, Any]] = []
    for line in _cohesive_lines(text):
        dimensions = DIMENSIONS_RE.search(line)
        grade_match = GRADE_RE_V4.search(line)
        standard_match = STANDARD_RE_V4.search(line)
        price_match = PRICE_RE.search(line) or PRICE_SUFFIX_RE.search(line)
        labeled_quantity_match = LABELED_QUANTITY_RE.search(line)
        pack_quantity_match = PACK_QUANTITY_RE_V4.search(line)
        quantity_match = labeled_quantity_match or pack_quantity_match or QUANTITY_RE.search(line)
        length_match = LENGTH_RE.search(line)
        bare_length_match = BARE_LENGTH_RE_V4.search(line)

        if not any((dimensions, grade_match, standard_match, price_match, quantity_match)):
            continue

        row: dict[str, Any] = {
            "source_filename": source_filename,
            "source_text": line,
            "item_role": _role(line, price_match is not None),
            "grade": grade_match.group(0).upper() if grade_match else None,
            "standard": standard_match.group(0).upper() if standard_match else None,
            "availability_status": _availability(line),
        }

        dimension_interpretation: str | None = None
        if dimensions:
            fields, dimension_interpretation = _dimension_fields(dimensions)
            row.update(fields)

        quantity_consumes_length = bool(
            labeled_quantity_match
            and length_match
            and labeled_quantity_match.start() <= length_match.start()
            and length_match.end() <= labeled_quantity_match.end()
        )
        if length_match and "length_mm" not in row and not quantity_consumes_length:
            length = number(length_match.group("value"))
            row["length_mm"] = scalar(
                length * 1000
                if length_match.group("unit").lower() in ("m", "mt") and length < 100
                else length
            )
        elif bare_length_match and "length_mm" not in row:
            bare_length = number(bare_length_match.group("value"))
            if 1000 <= bare_length <= 30000:
                row["length_mm"] = scalar(bare_length)

        if quantity_match:
            row["quantity"] = scalar(number(quantity_match.group("value")))
            if pack_quantity_match and quantity_match is pack_quantity_match:
                row["quantity_unit"] = "PACCHI"
            else:
                row["quantity_unit"] = _quantity_unit(quantity_match.group("unit"))

        if price_match:
            row["price_value"] = scalar(number(price_match.group("value")))
            unit = (price_match.group("unit") or "m").lower()
            row["price_unit"] = "M" if unit in ("m", "mt") else unit.upper()
            row["currency"] = "EUR"

        issues = _validate(row, dimensions is not None)
        score, band, components = _confidence(
            has_dimensions=dimensions is not None,
            has_grade=grade_match is not None,
            has_standard=standard_match is not None,
            has_commercial_signal=any(
                (
                    price_match is not None,
                    quantity_match is not None,
                    row.get("availability_status") is not None,
                )
            ),
            issues=issues,
        )

        if score < HIGH_CONFIDENCE and not any(issue["severity"] == "error" for issue in issues):
            issues.append(
                _issue(
                    "low_confidence",
                    "warning",
                    "confidence",
                    f"Parser confidence {score:.2f} is below the automatic acceptance threshold {HIGH_CONFIDENCE:.2f}.",
                )
            )

        validation_status = _validation_status(issues)
        row["confidence"] = score
        row["metadata"] = {
            "parser_contract_version": "v4",
            "dimension_interpretation": dimension_interpretation,
            "confidence": {
                "score": score,
                "band": band,
                "components": components,
                "automatic_acceptance_threshold": HIGH_CONFIDENCE,
            },
            "validation": {
                "status": validation_status,
                "issues": issues,
            },
            "flags": list(dict.fromkeys(issue["code"] for issue in issues)),
        }
        observations.append(row)

    return observations


def parse_document(filename: str, payload: bytes) -> list[dict[str, Any]]:
    return extract_observations(_document_text(filename, payload), filename)
