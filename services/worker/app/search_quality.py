"""COMM-UX1C.1 — deterministic and bounded multi-family search previews.

This module only reorders authorized Worker results. It never reads another
organization, resolves identities, or adds AI calls. Scores from the structured
SQL bridge and semantic RRF are NOT directly comparable as confidence values.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any

STRUCTURED_FAMILIES = ("rfq", "offer", "order", "delivery", "product", "company")
MAX_FAMILY_BACKFILLS = 2


def missing_preview_families(
    counts: dict[str, Any],
    current: list[dict[str, Any]],
    requested_types: list[str],
) -> list[str]:
    """Backfill only indexed structured families absent from the first page.

    Never include documents, which use a different tenant-scoped retrieval path.
    A maximum of two additional small SQL bridge calls keeps costs bounded.
    """
    eligible = set(requested_types) if requested_types else set(STRUCTURED_FAMILIES)
    seen = {str(row.get("result_type")) for row in current}
    missing: list[tuple[int, str]] = []
    for kind in STRUCTURED_FAMILIES:
        if kind not in eligible or kind in seen:
            continue
        raw = counts.get(kind, 0)
        count = int(raw) if isinstance(raw, (int, float)) and raw >= 0 else 0
        if count > 0:
            missing.append((count, kind))
    return [kind for _, kind in sorted(missing, key=lambda row: -row[0])[:MAX_FAMILY_BACKFILLS]]


def balanced_preview(rows: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    """Stable round-robin over result families; preserve ranking *within* each.

    The different source score scales must not make offers, documents or
    products disappear exclusively because another family fills the limit.
    We prioritize the highest original top match, then cycle each family.
    """
    if limit < 1:
        return []
    unique: set[tuple[str, str]] = set()
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        key = (str(row.get("result_type")), str(row.get("result_id")))
        if key in unique:
            continue
        unique.add(key)
        buckets[key[0]].append(row)

    def rank(row: dict[str, Any]) -> tuple[float, str, str]:
        try:
            score = float(row.get("score") or 0)
        except (ValueError, TypeError):
            score = 0
        # Every returned result retains its raw score, but cross-family scores
        # are never used as an end-user confidence percentage.
        return (score, str(row.get("event_at") or ""), str(row.get("result_id") or ""))

    for bucket in buckets.values():
        bucket.sort(key=rank, reverse=True)
    family_order = sorted(buckets, key=lambda kind: rank(buckets[kind][0]), reverse=True)

    output: list[dict[str, Any]] = []
    positions = {kind: 0 for kind in family_order}
    while len(output) < limit:
        appended = False
        for kind in family_order:
            index = positions[kind]
            if index >= len(buckets[kind]):
                continue
            output.append(buckets[kind][index])
            positions[kind] += 1
            appended = True
            if len(output) >= limit:
                break
        if not appended:
            break
    return output


def source_reference_available(row: dict[str, Any]) -> bool:
    """A locator exists, not proof that it resolves or is independently verified."""
    metadata = row.get("metadata")
    info = metadata if isinstance(metadata, dict) else {}
    return (
        isinstance(info.get("observation_id"), int) and info["observation_id"] > 0
    ) or bool(info.get("source_uri")) or bool(row.get("thread_id")) or bool(
        info.get("document_id")
    )
