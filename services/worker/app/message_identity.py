from __future__ import annotations

from datetime import UTC
from email import policy
from email.parser import BytesParser
from email.utils import getaddresses, parsedate_to_datetime
from pathlib import PurePosixPath
from typing import Any


def _addresses(values: list[str]) -> list[str]:
    emails: list[str] = []
    for _, address in getaddresses(values):
        normalized = address.strip().lower()
        if normalized and normalized not in emails:
            emails.append(normalized)
    return emails


def extract_message_identity(filename: str, payload: bytes) -> dict[str, Any] | None:
    if PurePosixPath(filename).suffix.lower() != ".eml":
        return None

    message = BytesParser(policy=policy.default).parsebytes(payload)
    sender = _addresses(message.get_all("from", []))
    recipients = _addresses(
        message.get_all("to", [])
        + message.get_all("cc", [])
        + message.get_all("bcc", [])
    )

    sent_at = None
    raw_date = str(message.get("date") or "").strip()
    if raw_date:
        try:
            parsed = parsedate_to_datetime(raw_date)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=UTC)
            sent_at = parsed.astimezone(UTC).isoformat()
        except (TypeError, ValueError, OverflowError):
            sent_at = None

    source_message_id = str(message.get("message-id") or "").strip() or None
    source_thread_id = None
    for header in ("x-conversation-id", "x-gm-thrid", "thread-index"):
        value = str(message.get(header) or "").strip()
        if value:
            source_thread_id = value
            break

    return {
        "source_message_id": source_message_id,
        "source_thread_id": source_thread_id,
        "sender_email": sender[0] if sender else None,
        "recipient_emails": recipients,
        "sent_at": sent_at,
        "email_subject": str(message.get("subject") or "").strip() or None,
    }
