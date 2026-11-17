"""AUTO1.A.5.6 — diagnostic-only HTML change classification, no claim promotion.

A5.5 observed changed full-body SHA on 6/8 first-level pages. An unchanged
observed-row fingerprint can narrow investigation but NEVER authenticates new
source content, proves technical completeness, or bypasses old/new SHA checks.
"""
from __future__ import annotations

import hashlib
import re

from .net_pro_producers_auto1a53 import (
    MAX_HTML_BYTES, TECHNICAL_FINGERPRINT_CONTRACT, fingerprint_technical_rows,
)

HEX = re.compile(r"^[0-9a-f]{64}$")


def diagnose_first_level_change(saved: dict, latest_html: bytes) -> dict:
    """Compare a previously recorded SHA-bound fingerprint with new HTML.

    The caller must have lawfully fetched the same first-party URL under all
    original robots, DNS, HTTPS, redirect and size guards. This function has no
    fetching, database writes, output URLs, source text or status promotion.
    """
    if not isinstance(saved, dict) or not isinstance(latest_html, bytes):
        raise ValueError("Invalid A5.6 source inputs")
    if len(latest_html) == 0 or len(latest_html) > MAX_HTML_BYTES:
        raise ValueError("A5.6 page outside bounded HTML size")
    old_sha = saved.get("source_sha256")
    old_fingerprint = saved.get("fingerprint")
    if not isinstance(old_sha, str) or not HEX.fullmatch(old_sha):
        raise ValueError("Missing original full-byte source SHA")
    if not isinstance(old_fingerprint, dict):
        raise ValueError("Missing previous source-local fingerprint")
    if old_fingerprint.get("contract") != TECHNICAL_FINGERPRINT_CONTRACT:
        raise ValueError("Unknown technical-row fingerprint contract")
    if saved.get("fingerprint_source_sha256") != old_sha:
        raise ValueError("Fingerprint not bound to original full-page SHA")
    old_technical_sha = old_fingerprint.get("technical_sha256")
    old_rows = old_fingerprint.get("technical_rows")
    if (type(old_rows) is not int or not 0 <= old_rows <= 120
            or (old_rows == 0 and old_technical_sha is not None)
            or (old_rows > 0 and (not isinstance(old_technical_sha, str)
                                 or not HEX.fullmatch(old_technical_sha)))):
        raise ValueError("Invalid previous row fingerprint")
    latest_sha = hashlib.sha256(latest_html).hexdigest()
    if latest_sha == old_sha:
        return {
            "contract": "netproducers-auto1a56-change-diagnostic-v1",
            "classification": "unchanged_full_bytes",
            "body_changed": False,
            "technical_rows_comparable": False,
            "db_writes": 0, "published_claims": 0,
        }
    try:
        new_html = latest_html.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        classification = "not_comparable_encoding"
    else:
        current = fingerprint_technical_rows(new_html)
        new_rows = current["technical_rows"]
        new_sha = current["technical_sha256"]
        if old_rows == 0 or new_rows == 0:
            classification = "no_comparable_rows"
        elif old_technical_sha == new_sha:
            classification = "same_observed_rows"
        else:
            classification = "changed_observed_rows"
    return {
        "contract": "netproducers-auto1a56-change-diagnostic-v1",
        "classification": classification,
        "body_changed": True,
        "technical_rows_comparable": classification in (
            "same_observed_rows", "changed_observed_rows"),
        "db_writes": 0, "published_claims": 0,
    }
