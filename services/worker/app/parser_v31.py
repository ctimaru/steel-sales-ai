from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath


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


class ParserV31Adapter:
    """Boundary for the validated parser v3.1 pipeline.

    The existing v3.1 run is the source of truth for extraction behavior.
    This adapter keeps upload orchestration separate from extraction and is
    intentionally explicit about the next integration seam for the parser
    package.
    """

    parser_version = "v3.1"

    def classify(self, extension: str) -> str:
        return {
            ".zip": "email_archive",
            ".eml": "email_message",
            ".pdf": "pdf_document",
            ".xls": "spreadsheet",
            ".xlsx": "spreadsheet",
        }[extension]

    def prepare(self, item: ParserInput) -> ParserResult:
        if not PurePosixPath(item.filename).suffix:
            raise ValueError("Parser input must have a file extension.")
        return ParserResult(
            parser_version=self.parser_version,
            input_kind=self.classify(item.extension),
            status="staged",
            storage_path=item.storage_path,
        )
