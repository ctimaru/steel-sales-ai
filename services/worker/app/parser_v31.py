from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Any

from .extractor_v31 import parse_document


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


class ParserV31Adapter:
    """Validated line-scoped commercial extraction parser."""

    parser_version = "v3.1"

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
        return ParserResult(
            parser_version=self.parser_version,
            input_kind=self.classify(item.extension),
            status="extracted",
            storage_path=item.storage_path,
            observations=observations,
        )
