from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Any

from .extractor_v4 import parse_document
from .message_identity import extract_message_identity


@dataclass(frozen=True)
class ParserInput:
    filename: str
    extension: str
    size_bytes: int
    storage_path: str


@dataclass(frozen=True)
class ParserResult:
    parser_version: str
    input_kind: str
    status: str
    storage_path: str
    observations: list[dict[str, Any]]
    validation_summary: dict[str, int]
    message_identity: dict[str, Any] | None


class ParserV4Adapter:
    """Validated steel-tube extraction parser with explicit confidence and issue taxonomy."""

    parser_version = "v4"

    def classify(self, extension: str) -> str:
        return {
            ".zip": "email_archive",
            ".eml": "email_message",
            ".pdf": "pdf_document",
            ".xls": "spreadsheet",
            ".xlsx": "spreadsheet",
        }[extension]

    def prepare(self, item: ParserInput, payload: bytes) -> ParserResult:
        if not PurePosixPath(item.filename).suffix:
            raise ValueError("Parser input must have a file extension.")

        observations = parse_document(item.filename, payload)
        summary = {"valid": 0, "review_required": 0, "invalid": 0}
        for observation in observations:
            metadata = observation.get("metadata") or {}
            validation = metadata.get("validation") or {}
            status = validation.get("status", "review_required")
            summary[status] = summary.get(status, 0) + 1

        return ParserResult(
            parser_version=self.parser_version,
            input_kind=self.classify(item.extension),
            status="extracted",
            storage_path=item.storage_path,
            observations=observations,
            validation_summary=summary,
            message_identity=extract_message_identity(item.filename, payload),
        )
