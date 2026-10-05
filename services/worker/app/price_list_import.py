from __future__ import annotations

import hashlib
import json
import os
import re
from collections import Counter
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from io import BytesIO
from pathlib import Path
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile, status
from pypdf import PdfReader

from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository

PARSER_VERSION = "pl1.4-padana-ptc-v1"
MAX_PRICE_LIST_PDF_BYTES = 25 * 1024 * 1024
ROW_RE = re.compile(
    r"^(?P<label>.+?)\s+"
    r"(?P<thickness>\d+(?:[.,]\d+)?)\s+"
    r"(?P<base>\d+(?:[.,]\d+)?)\s+"
    r"(?P<extra>\d+(?:[.,]\d+)?)"
    r"(?:\s+(?P<note>.*))?$"
)
ROUND_LABEL_RE = re.compile(
    r"^Ø\s*(?P<diameter>\d+(?:[.,]\d+)?)x(?P<thickness>\d+(?:[.,]\d+)?)$",
    re.IGNORECASE,
)
RECT_LABEL_RE = re.compile(
    r"^(?P<a>\d+(?:[.,]\d+)?)x(?P<b>\d+(?:[.,]\d+)?)x(?P<thickness>\d+(?:[.,]\d+)?)$",
    re.IGNORECASE,
)
SPECIAL_DIMENSION_RE = re.compile(
    r"^(?P<kind>Ovale|Semiovale|Triangolare)\s+"
    r"(?P<a>\d+(?:[.,]\d+)?)x(?P<b>\d+(?:[.,]\d+)?)x(?P<thickness>\d+(?:[.,]\d+)?)$",
    re.IGNORECASE,
)
SPECIAL_CODE_RE = re.compile(
    r"^Codice\s+(?P<code>.+?)\s*\(sp\.\s*(?P<thickness>\d+(?:[.,]\d+)?)\)$",
    re.IGNORECASE,
)

router = APIRouter(prefix="/v1/price-lists/import", tags=["price-list-import"])


@dataclass(frozen=True)
class ParsedRow:
    row_type: str
    page_number: int
    source_row_index: int
    section_key: str | None
    raw_text: str
    normalized_data: dict[str, Any]
    validation_status: str
    validation_codes: list[str]
    source_locator: dict[str, Any]

    def as_staging_row(self, import_run_id: UUID) -> dict[str, Any]:
        signature_payload = json.dumps(
            {
                "row_type": self.row_type,
                "page": self.page_number,
                "row": self.source_row_index,
                "section_key": self.section_key,
                "raw_text": self.raw_text,
                "normalized_data": self.normalized_data,
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        return {
            "import_run_id": str(import_run_id),
            "row_type": self.row_type,
            "page_number": self.page_number,
            "source_row_index": self.source_row_index,
            "section_key": self.section_key,
            "raw_text": self.raw_text,
            "row_signature": hashlib.sha256(signature_payload.encode("utf-8")).hexdigest(),
            "normalized_data": self.normalized_data,
            "validation_status": self.validation_status,
            "validation_codes": self.validation_codes,
            "source_locator": self.source_locator,
        }


@dataclass(frozen=True)
class ImportResult:
    adapter_key: str
    parser_version: str
    content_checksum: str
    document: dict[str, Any]
    rows: list[ParsedRow]
    anomalies: list[dict[str, Any]]
    summary: dict[str, Any]

    def preview(self, sample_limit: int = 20) -> dict[str, Any]:
        items = [row for row in self.rows if row.row_type == "item"]
        rules = [row for row in self.rows if row.row_type == "rule"]
        return {
            "adapter_key": self.adapter_key,
            "parser_version": self.parser_version,
            "content_checksum": self.content_checksum,
            "document": self.document,
            "summary": self.summary,
            "anomalies": self.anomalies,
            "rules": [row.normalized_data for row in rules],
            "sample_rows": [
                {
                    "page_number": row.page_number,
                    "source_row_index": row.source_row_index,
                    "section_key": row.section_key,
                    "raw_text": row.raw_text,
                    "validation_status": row.validation_status,
                    "validation_codes": row.validation_codes,
                    "normalized_data": row.normalized_data,
                }
                for row in items[:sample_limit]
            ],
        }


def _decimal(raw: str) -> Decimal:
    return Decimal(raw.replace(",", ".").strip())


def _decimal_string(value: Decimal) -> str:
    return format(value, "f")


def _slug(value: str) -> str:
    normalized = value.casefold()
    normalized = normalized.replace("Ø", "d")
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    return normalized.strip("-") or "unknown"


def _normalize_standard(raw: str) -> str:
    compact = re.sub(r"\s+", "", raw.upper())
    if compact.startswith("EN10219-2"):
        return "EN10219-2"
    if compact.startswith("EN10219"):
        return "EN10219"
    if compact.startswith("EN10305-3"):
        return "EN10305-3"
    return raw.strip()


def _weight_standard_key(standard_code: str | None) -> str | None:
    if not standard_code:
        return None
    if standard_code.startswith("EN10219"):
        return "EN10219"
    return standard_code


def _extract_standards(text: str) -> list[str]:
    matches = re.findall(r"EN\s*10219(?:-2)?|EN\s*10305-3", text, flags=re.IGNORECASE)
    result: list[str] = []
    for raw in matches:
        standard = _normalize_standard(raw)
        if standard not in result:
            result.append(standard)
    return result


def _finish_from_text(text: str) -> tuple[str | None, str | None]:
    folded = text.casefold()
    if "sendzimir" in folded or "zincat" in folded or "pre-galva" in folded:
        return "Zincata Sendzimir", "sendzimir"
    if "decapat" in folded or "pickled" in folded or "p&o" in folded:
        return "Decapata (P&O)", "pickled_oiled"
    if "finitura nera" in folded or "neri" in folded or "self color" in folded:
        return "Nera", "self_color"
    return None, None


def _shape_from_header(header: str) -> str:
    folded = header.casefold()
    if "tondi" in folded:
        return "circular"
    if "quadri" in folded:
        return "square"
    if "rettangolari" in folded:
        return "rectangular"
    return "other"


def _grade_from_lines(lines: list[str]) -> str | None:
    for line in lines:
        match = re.search(r"QUALITA\s+([^/|]+)", line, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def _row_note_override(note: str) -> tuple[str | None, str | None]:
    if not note:
        return None, None
    standard_match = re.search(r"EN\s*10219-2", note, flags=re.IGNORECASE)
    grade_match = re.search(r"\b(DX51D)\b", note, flags=re.IGNORECASE)
    return (
        _normalize_standard(standard_match.group(0)) if standard_match else None,
        grade_match.group(1).upper() if grade_match else None,
    )


def _special_row_context(label: str, note: str) -> dict[str, Any]:
    finish_raw, finish_code = _finish_from_text(note)
    lower_label = label.casefold()

    if lower_label.startswith("codice"):
        shape_detail = "special_profile_code"
        if finish_code == "self_color":
            standard_raw = "EN10219"
            standard_code = "EN10219"
            grade_raw = "S235JRH"
            grade_code = "S235JRH"
        elif finish_code == "pickled_oiled":
            standard_raw = None
            standard_code = None
            grade_raw = "S235JR"
            grade_code = "S235JR"
        else:
            standard_raw = None
            standard_code = None
            grade_raw = "DX51D"
            grade_code = "DX51D"
    elif lower_label.startswith("ovale"):
        shape_detail = "oval"
        standard_raw = None
        standard_code = None
        if finish_code == "sendzimir":
            grade_raw = "DX51D / E220+DX51D"
            grade_code = None
        else:
            grade_raw = "S235"
            grade_code = "S235"
    elif lower_label.startswith("semiovale"):
        shape_detail = "semioval"
        standard_raw = None
        standard_code = None
        grade_raw = "S235JR"
        grade_code = "S235JR"
    else:
        shape_detail = "triangular"
        standard_raw = None
        standard_code = None
        grade_raw = "S235JR"
        grade_code = "S235JR"

    return {
        "shape_code": "other",
        "shape_detail": shape_detail,
        "standard_raw": standard_raw,
        "standard_code": standard_code,
        "weight_standard_key": _weight_standard_key(standard_code),
        "grade_raw": grade_raw,
        "grade_code": grade_code,
        "finish_raw": finish_raw,
        "finish_code": finish_code,
    }


def _page_context(page_text: str) -> dict[str, Any]:
    lines = [line.strip() for line in page_text.splitlines() if line.strip()]
    header = next((line for line in lines if "Euro/Mtr Ex-Work" in line), "")
    grade_lines = [
        line
        for line in lines
        if ("QUALITA" in line.upper() or "GRADE" in line.upper())
        and "Dimensione" not in line
    ]
    standards = _extract_standards(header)
    standard_code = standards[0] if len(standards) == 1 else None
    finish_raw, finish_code = _finish_from_text(header)
    grade_raw = _grade_from_lines(grade_lines)
    return {
        "raw_heading": header,
        "grade_lines": grade_lines,
        "shape_code": _shape_from_header(header),
        "shape_detail": None,
        "standards": standards,
        "standard_raw": " + ".join(standards) if standards else None,
        "standard_code": standard_code,
        "weight_standard_key": _weight_standard_key(standard_code),
        "grade_raw": grade_raw,
        "grade_code": grade_raw,
        "finish_raw": finish_raw,
        "finish_code": finish_code,
        "currency_code": "EUR",
        "price_unit": "per_m",
        "delivery_term_raw": "Ex-Work" if "Ex-Work" in header else None,
    }


def _geometry_from_label(
    label: str,
    trailing_thickness: Decimal,
    default_shape: str,
) -> tuple[dict[str, Any], list[str]]:
    codes: list[str] = []
    item: dict[str, Any] = {
        "dimension_label_raw": label,
        "outer_diameter_mm": None,
        "width_mm": None,
        "height_mm": None,
        "thickness_mm": _decimal_string(trailing_thickness),
        "geometry_candidate_key": None,
        "shape_detail": None,
    }

    match = ROUND_LABEL_RE.match(label)
    if match:
        diameter = _decimal(match.group("diameter"))
        label_thickness = _decimal(match.group("thickness"))
        if label_thickness != trailing_thickness:
            codes.append("THICKNESS_COLUMN_MISMATCH")
        item["outer_diameter_mm"] = _decimal_string(diameter)
        item["geometry_candidate_key"] = (
            f"round|od={_decimal_string(diameter.normalize())}|"
            f"t={_decimal_string(trailing_thickness.normalize())}"
        )
        return item, codes

    match = RECT_LABEL_RE.match(label)
    if match:
        a = _decimal(match.group("a"))
        b = _decimal(match.group("b"))
        label_thickness = _decimal(match.group("thickness"))
        if label_thickness != trailing_thickness:
            codes.append("THICKNESS_COLUMN_MISMATCH")
        high = max(a, b)
        low = min(a, b)
        shape = "square" if a == b else "rect"
        item["width_mm"] = _decimal_string(high)
        item["height_mm"] = _decimal_string(low)
        item["geometry_candidate_key"] = (
            f"{shape}|{_decimal_string(high.normalize())}x{_decimal_string(low.normalize())}|"
            f"t={_decimal_string(trailing_thickness.normalize())}"
        )
        if default_shape in ("square", "rectangular"):
            expected = "square" if default_shape == "square" else "rect"
            if shape != expected:
                codes.append("SHAPE_HEADER_ROW_MISMATCH")
        return item, codes

    match = SPECIAL_DIMENSION_RE.match(label)
    if match:
        a = _decimal(match.group("a"))
        b = _decimal(match.group("b"))
        label_thickness = _decimal(match.group("thickness"))
        if label_thickness != trailing_thickness:
            codes.append("THICKNESS_COLUMN_MISMATCH")
        kind = match.group("kind").casefold()
        item["width_mm"] = _decimal_string(max(a, b))
        item["height_mm"] = _decimal_string(min(a, b))
        item["shape_detail"] = kind
        item["geometry_candidate_key"] = (
            f"other|{kind}|{_decimal_string(max(a,b).normalize())}x"
            f"{_decimal_string(min(a,b).normalize())}|"
            f"t={_decimal_string(trailing_thickness.normalize())}"
        )
        return item, codes

    match = SPECIAL_CODE_RE.match(label)
    if match:
        label_thickness = _decimal(match.group("thickness"))
        if label_thickness != trailing_thickness:
            codes.append("THICKNESS_COLUMN_MISMATCH")
        item["shape_detail"] = "special_profile_code"
        return item, codes

    codes.append("UNPARSED_DIMENSION_LABEL")
    return item, codes


def _looks_like_price_row(line: str) -> bool:
    return bool(
        re.search(
            r"\d+(?:[.,]\d+)?\s+\d+(?:[.,]\d+)?\s+\d+(?:[.,]\d+)?(?:\s+.*)?$",
            line,
        )
        and not re.match(r"^\d+\s*/\s*\d+$", line)
    )


def _parse_price_line(line: str) -> tuple[str, Decimal, Decimal, Decimal, str] | None:
    match = ROW_RE.match(line)
    if not match:
        return None
    label = match.group("label").strip()
    if label.startswith(("Dimensione", "PTC ")):
        return None
    try:
        thickness = _decimal(match.group("thickness"))
        base = _decimal(match.group("base"))
        extra = _decimal(match.group("extra"))
    except InvalidOperation:
        return None
    if base < 0 or extra < 0 or thickness <= 0:
        return None
    return label, thickness, base, extra, (match.group("note") or "").strip()


def _section_key(context: dict[str, Any]) -> str:
    standard = context.get("standard_code") or context.get("standard_raw") or "unresolved-standard"
    grade = context.get("grade_code") or context.get("grade_raw") or "unresolved-grade"
    finish = context.get("finish_code") or "unresolved-finish"
    shape = context.get("shape_detail") or context.get("shape_code") or "other"
    return "|".join((_slug(shape), _slug(finish), _slug(grade), _slug(standard)))


def _validation_status(codes: list[str]) -> str:
    error_codes = {"UNPARSED_DIMENSION_LABEL", "THICKNESS_COLUMN_MISMATCH", "SHAPE_HEADER_ROW_MISMATCH"}
    if any(code in error_codes for code in codes):
        return "error"
    if codes:
        return "review"
    return "valid"


def _rule_rows(cover_text: str) -> list[ParsedRow]:
    rules: list[ParsedRow] = []
    if "extra fisso non soggetto a sconto" in cover_text.casefold():
        rules.append(
            ParsedRow(
                row_type="rule",
                page_number=1,
                source_row_index=1,
                section_key=None,
                raw_text="Base discounted; fixed extra not discounted.",
                normalized_data={
                    "rule_type": "commercial_discount",
                    "scope": "version",
                    "calculation_order": 10,
                    "rule_payload": {
                        "formula": "discounted_base_plus_fixed_extra",
                        "discount_applies_to": ["base"],
                        "non_discountable_components": ["fixed_extra"],
                    },
                },
                validation_status="valid",
                validation_codes=[],
                source_locator={"kind": "pdf", "page": 1, "rule": "commercial_discount"},
            )
        )

    logistics = re.search(
        r"12\s+EUR/T(?:onn|n).*?3\s+pacchi.*?6\s+metri.*?2\s+pacchi.*?12\s+metri",
        cover_text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if logistics:
        rules.append(
            ParsedRow(
                row_type="rule",
                page_number=1,
                source_row_index=2,
                section_key=None,
                raw_text="12 EUR/Tn logistics efficiency discount with bundle/length thresholds.",
                normalized_data={
                    "rule_type": "logistics_discount",
                    "scope": "version",
                    "calculation_order": 80,
                    "rule_payload": {
                        "effect": {"operation": "subtract", "amount": "12", "currency": "EUR", "unit": "per_t"},
                        "condition": {
                            "any": [
                                {"bar_length_m": "6", "minimum_bundles_per_item": 3},
                                {"bar_length_m": "12", "minimum_bundles_per_item": 2},
                            ],
                            "single_shipment": True,
                        },
                        "requires_bundle_master_data": True,
                    },
                },
                validation_status="review",
                validation_codes=["BUNDLE_MASTER_DATA_REQUIRED"],
                source_locator={"kind": "pdf", "page": 1, "rule": "logistics_discount"},
            )
        )

    if "melted and poured" in cover_text.casefold():
        rules.append(
            ParsedRow(
                row_type="rule",
                page_number=1,
                source_row_index=3,
                section_key=None,
                raw_text="Melted and Poured certificate extra: commercially agreed by volume.",
                normalized_data={
                    "rule_type": "other",
                    "scope": "version",
                    "calculation_order": 90,
                    "rule_payload": {
                        "kind": "melted_and_poured_certificate_extra",
                        "amount": None,
                        "manual_commercial_agreement_required": True,
                    },
                },
                validation_status="review",
                validation_codes=["NON_DETERMINISTIC_RULE"],
                source_locator={"kind": "pdf", "page": 1, "rule": "melted_and_poured_extra"},
            )
        )
    return rules


def parse_padana_page_texts(
    page_texts: list[str],
    *,
    content_checksum: str,
) -> ImportResult:
    if not page_texts:
        raise ValueError("Price-list PDF contains no pages.")

    cover_text = page_texts[0]
    version_match = re.search(r"\bPTC\s+\d+/\d{4}\b", cover_text)
    date_match = re.search(r"\b(\d{2}/\d{2}/\d{4})\b", cover_text)
    revision_match = re.search(r"\bDC\s+8\.2_01\s+rev\.\d+\b", cover_text, flags=re.IGNORECASE)

    if not version_match:
        raise ValueError("Padana PTC adapter could not identify the manufacturer version code.")

    cover_delivery_term = "FCA" if re.search(r"Euro/Mtr\s+FCA", cover_text, re.IGNORECASE) else None
    document = {
        "manufacturer": "Padana Tubi e Profilati Acciaio S.p.A.",
        "manufacturer_version_code": version_match.group(0),
        "manufacturer_revision_code": revision_match.group(0) if revision_match else None,
        "source_date": date_match.group(1) if date_match else None,
        "currency_code": "EUR",
        "price_unit": "per_m",
        "cover_delivery_term_raw": cover_delivery_term,
        "page_count": len(page_texts),
    }

    rows: list[ParsedRow] = _rule_rows(cover_text)
    row_codes_counter: Counter[str] = Counter()
    shape_counter: Counter[str] = Counter()
    section_keys: set[str] = set()
    page_delivery_terms: set[str] = set()

    for page_number, page_text in enumerate(page_texts[1:], start=2):
        context = _page_context(page_text)
        if context.get("delivery_term_raw"):
            page_delivery_terms.add(str(context["delivery_term_raw"]))

        source_row_index = 0
        for raw_line in page_text.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            parsed = _parse_price_line(line)
            if not parsed:
                continue

            source_row_index += 1
            label, thickness, base, extra, note = parsed
            row_context = dict(context)
            validation_codes: list[str] = []

            if page_number >= 35 or label.casefold().startswith(
                ("codice", "ovale", "semiovale", "triangolare")
            ):
                row_context.update(_special_row_context(label, note))
                if row_context.get("standard_code") is None:
                    validation_codes.append("MISSING_STANDARD")
                if label.casefold().startswith("ovale") and row_context.get("grade_code") is None:
                    validation_codes.append("SOURCE_GRADE_LABEL_CONFLICT")
            else:
                standard_override, grade_override = _row_note_override(note)
                if standard_override:
                    row_context["standard_raw"] = standard_override
                    row_context["standard_code"] = standard_override
                    row_context["weight_standard_key"] = _weight_standard_key(standard_override)
                elif len(row_context.get("standards") or []) > 1:
                    validation_codes.append("AMBIGUOUS_STANDARD")

                if grade_override:
                    row_context["grade_raw"] = grade_override
                    row_context["grade_code"] = grade_override

            geometry, geometry_codes = _geometry_from_label(
                label,
                thickness,
                str(row_context.get("shape_code") or "other"),
            )
            validation_codes.extend(geometry_codes)

            section_key = _section_key(row_context)
            section_keys.add(section_key)
            shape_counter[str(row_context.get("shape_detail") or row_context.get("shape_code") or "other")] += 1

            item_key = geometry.get("geometry_candidate_key") or _slug(label)
            normalized_data = {
                "section": {
                    "section_key": section_key,
                    "raw_heading": row_context.get("raw_heading") or "Special profiles / mixed source section",
                    "shape_code": row_context.get("shape_code") or "other",
                    "shape_detail": row_context.get("shape_detail"),
                    "standard_raw": row_context.get("standard_raw"),
                    "standard_code": row_context.get("standard_code"),
                    "weight_standard_key": row_context.get("weight_standard_key"),
                    "grade_raw": row_context.get("grade_raw"),
                    "grade_code": row_context.get("grade_code"),
                    "finish_raw": row_context.get("finish_raw"),
                    "finish_code": row_context.get("finish_code"),
                    "currency_code": "EUR",
                    "price_unit": "per_m",
                    "delivery_term_raw": row_context.get("delivery_term_raw"),
                },
                "item": {
                    "item_key": item_key,
                    **geometry,
                    "note_raw": note or None,
                },
                "components": [
                    {
                        "component_type": "base",
                        "source_label": "Base €/Mtr",
                        "amount": _decimal_string(base),
                        "currency_code": "EUR",
                        "price_unit": "per_m",
                        "operation": "add",
                        "discountable": True,
                        "calculation_order": 10,
                    },
                    {
                        "component_type": "fixed_extra",
                        "source_label": "Extra €/Mtr",
                        "amount": _decimal_string(extra),
                        "currency_code": "EUR",
                        "price_unit": "per_m",
                        "operation": "add",
                        "discountable": False,
                        "calculation_order": 20,
                    },
                ],
            }
            validation_codes = sorted(set(validation_codes))
            row_codes_counter.update(validation_codes)
            rows.append(
                ParsedRow(
                    row_type="item",
                    page_number=page_number,
                    source_row_index=source_row_index,
                    section_key=section_key,
                    raw_text=line,
                    normalized_data=normalized_data,
                    validation_status=_validation_status(validation_codes),
                    validation_codes=validation_codes,
                    source_locator={
                        "kind": "pdf",
                        "page": page_number,
                        "row": source_row_index,
                    },
                )
            )

    items = [row for row in rows if row.row_type == "item"]
    rules = [row for row in rows if row.row_type == "rule"]
    if not items:
        raise ValueError("Padana PTC adapter extracted zero price rows.")

    anomalies: list[dict[str, Any]] = []
    if cover_delivery_term and page_delivery_terms and cover_delivery_term not in page_delivery_terms:
        anomalies.append(
            {
                "severity": "warning",
                "code": "DELIVERY_TERM_CONFLICT",
                "message": "Cover and price-table pages use different delivery-term labels.",
                "evidence": {
                    "cover": cover_delivery_term,
                    "page_terms": sorted(page_delivery_terms),
                },
            }
        )

    for code, count in sorted(row_codes_counter.items()):
        severity = "error" if code in {
            "UNPARSED_DIMENSION_LABEL",
            "THICKNESS_COLUMN_MISMATCH",
            "SHAPE_HEADER_ROW_MISMATCH",
        } else "review"
        anomalies.append(
            {
                "severity": severity,
                "code": code,
                "message": f"{count} extracted item row(s) carry validation code {code}.",
                "evidence": {"row_count": count},
            }
        )

    for rule in rules:
        for code in rule.validation_codes:
            anomalies.append(
                {
                    "severity": "review",
                    "code": code,
                    "message": f"Extracted pricing rule requires review: {code}.",
                    "evidence": {"rule": rule.normalized_data.get("rule_type")},
                }
            )

    valid_count = sum(row.validation_status == "valid" for row in items)
    review_count = sum(row.validation_status == "review" for row in items)
    error_count = sum(row.validation_status == "error" for row in items)

    summary = {
        "page_count": len(page_texts),
        "extracted_item_count": len(items),
        "extracted_rule_count": len(rules),
        "valid_item_count": valid_count,
        "review_item_count": review_count,
        "error_item_count": error_count,
        "section_count": len(section_keys),
        "anomaly_count": len(anomalies),
        "shape_counts": dict(sorted(shape_counter.items())),
        "validation_code_counts": dict(sorted(row_codes_counter.items())),
    }

    return ImportResult(
        adapter_key="padana_ptc",
        parser_version=PARSER_VERSION,
        content_checksum=content_checksum,
        document=document,
        rows=rows,
        anomalies=anomalies,
        summary=summary,
    )


def parse_price_list_pdf(payload: bytes, *, adapter_key: str = "padana_ptc") -> ImportResult:
    if adapter_key != "padana_ptc":
        raise ValueError(f"Unsupported price-list adapter: {adapter_key}")
    checksum = hashlib.sha256(payload).hexdigest()
    reader = PdfReader(BytesIO(payload))
    if reader.is_encrypted:
        raise ValueError("Encrypted price-list PDFs are not supported.")
    page_texts = [page.extract_text() or "" for page in reader.pages]
    if sum(len(text.strip()) for text in page_texts) < 100:
        raise ValueError("PDF text extraction returned too little text; OCR/manual intake is required.")
    return parse_padana_page_texts(page_texts, content_checksum=checksum)


def _require_worker_token(x_worker_token: str | None) -> None:
    expected = os.getenv("WORKER_INTERNAL_TOKEN")
    if expected and x_worker_token != expected:
        raise HTTPException(status_code=401, detail="Invalid worker token.")


async def _read_pdf(upload: UploadFile) -> bytes:
    filename = Path(upload.filename or "").name
    if not filename or Path(filename).suffix.casefold() != ".pdf":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Price-list import accepts PDF files only.",
        )
    content = bytearray()
    while chunk := await upload.read(1024 * 1024):
        content.extend(chunk)
        if len(content) > MAX_PRICE_LIST_PDF_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Price-list PDF exceeds the 25 MB limit.",
            )
    return bytes(content)


@router.post("/preview")
async def preview_price_list_import(
    upload: Annotated[UploadFile, File(...)],
    adapter_key: Annotated[str, Form()] = "padana_ptc",
    sample_limit: Annotated[int, Form()] = 20,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    _require_worker_token(x_worker_token)
    if sample_limit < 0 or sample_limit > 100:
        raise HTTPException(status_code=422, detail="sample_limit must be between 0 and 100.")
    content = await _read_pdf(upload)
    try:
        result = parse_price_list_pdf(content, adapter_key=adapter_key)
    except (ValueError, InvalidOperation) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return result.preview(sample_limit=sample_limit)


@router.post("/stage")
async def stage_price_list_import(
    upload: Annotated[UploadFile, File(...)],
    price_list_version_id: Annotated[UUID, Form()],
    source_document_id: Annotated[UUID, Form()],
    actor_id: Annotated[UUID | None, Form()] = None,
    adapter_key: Annotated[str, Form()] = "padana_ptc",
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    _require_worker_token(x_worker_token)
    content = await _read_pdf(upload)
    filename = Path(upload.filename or "").name
    try:
        result = parse_price_list_pdf(content, adapter_key=adapter_key)
        repo = WorkerRepository()
        run = await repo.create_price_list_import_run(
            price_list_version_id=price_list_version_id,
            source_document_id=source_document_id,
            adapter_key=result.adapter_key,
            parser_version=result.parser_version,
            filename=filename,
            content_checksum=result.content_checksum,
            created_by=actor_id,
        )
        run_id = UUID(str(run["id"]))
        await repo.update_price_list_import_run(run_id, {"status": "extracting"})

        rows = [row.as_staging_row(run_id) for row in result.rows]
        await repo.insert_price_list_import_rows(rows)

        anomalies = [
            {
                "import_run_id": str(run_id),
                "severity": anomaly["severity"],
                "code": anomaly["code"],
                "message": anomaly["message"],
                "evidence": anomaly.get("evidence") or {},
            }
            for anomaly in result.anomalies
        ]
        await repo.insert_price_list_import_anomalies(anomalies)

        await repo.update_price_list_import_run(
            run_id,
            {
                "status": "staged",
                "page_count": result.summary["page_count"],
                "extracted_item_count": result.summary["extracted_item_count"],
                "extracted_rule_count": result.summary["extracted_rule_count"],
                "valid_item_count": result.summary["valid_item_count"],
                "review_item_count": result.summary["review_item_count"],
                "error_item_count": result.summary["error_item_count"],
                "anomaly_count": result.summary["anomaly_count"],
                "summary": result.summary,
            },
        )
        await repo.update_price_list_import_run(run_id, {"status": "review_ready"})
        return {
            "run_id": str(run_id),
            "status": "review_ready",
            "adapter_key": result.adapter_key,
            "parser_version": result.parser_version,
            "content_checksum": result.content_checksum,
            "document": result.document,
            "summary": result.summary,
        }
    except (RepositoryConfigurationError, RepositoryError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (ValueError, InvalidOperation) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
