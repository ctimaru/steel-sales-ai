"""Feed a reviewed, immutable Overture audit via the existing worker RPC.

The source must be registered by a genuine Platform actor. The database must
enforce the special-source contract atomically. No local file is fetched from
a user-supplied URL; only an operator-configured audit artifact is read.
"""
from __future__ import annotations

import hashlib
import hmac
import os
from pathlib import Path

from .net_it_autofeed import MAX_LOT, SOURCE_URL, select_items

MAX_BYTES = 4 * 1024 * 1024
MAX_BATCHES = 8


async def _refill_audit(api, source: dict, prefix: str) -> dict:
    result = {"status": "not_configured", "received": 0, "staged": 0,
              "already_known": 0}
    if source.get("url") != SOURCE_URL:
        raise ValueError("wrong source")
    path = os.getenv(prefix + "AUDIT_PATH", "")
    digest = os.getenv(prefix + "AUDIT_SHA256", "")
    release = os.getenv(prefix + "RELEASE", "")
    audit_url = os.getenv(prefix + "AUDIT_URL", "")
    if not all((path, digest, release, audit_url)):
        return result
    try:
        with Path(path).open("rb") as audit:
            raw = audit.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES or not hmac.compare_digest(
            hashlib.sha256(raw).hexdigest(), digest.lower()
        ):
            raise ValueError("audit digest or size mismatch")
        lines = raw.decode("utf-8").splitlines()
        checkpoint = source.get("autofeed_checkpoint") or {}
        after = (checkpoint.get("after_domain", "")
                 if checkpoint.get("audit_url") == audit_url
                 and checkpoint.get("release") == release else "")
        limit = min(int(source["max_links"]), MAX_LOT)
        for _ in range(MAX_BATCHES):
            items = select_items(lines, release=release, audit_url=audit_url,
                                 after_domain=after, limit=limit)
            if not items:
                result["status"] = "audit_exhausted"
                return result
            response = await api.call("net_it_autofeed_stage", {
                "p_source_id": str(source["id"]), "p_items": items,
            })
            if (response.get("contract") != "net-it-autofeed-stage-v1"
                    or response.get("published") != 0):
                raise RuntimeError("unexpected atomic autofeed contract")
            result["status"] = str(response["status"])
            result["received"] += int(response.get("received", 0))
            result["staged"] += int(response.get("staged", 0))
            result["already_known"] += int(response.get("already_known", 0))
            if result["status"] != "ok" or result["staged"] > 0:
                return result
            after = items[-1]["domain"]
        result["status"] = "scan_budget_exhausted"
        return result
    except (OSError, UnicodeError, ValueError, KeyError):
        result["status"] = "invalid_audit"
        return result


async def refill_from_configured_audit(api, source: dict) -> dict:
    """Consume primary then optional successor audit, never reset a successor cursor.

    Only advance after the prior audit is exhausted, not on error/capacity hold.
    Both audit identities and file hashes remain independently pinned by the operator.
    """
    primary = "NET_IT_AUTOFEED_"
    successor = "NET_IT_AUTOFEED_NEXT_"
    keys = ("AUDIT_PATH", "AUDIT_SHA256", "RELEASE", "AUDIT_URL")
    configured = [os.getenv(successor + key, "") for key in keys]
    if not any(configured):
        return await _refill_audit(api, source, primary)
    if not all(configured) or configured[3] == os.getenv(primary + "AUDIT_URL", ""):
        return {"status": "invalid_audit", "received": 0, "staged": 0, "already_known": 0}
    checkpoint = source.get("autofeed_checkpoint") or {}
    if (checkpoint.get("audit_url") == configured[3]
            and checkpoint.get("release") == configured[2]):
        return await _refill_audit(api, source, successor)
    result = await _refill_audit(api, source, primary)
    if result["status"] != "audit_exhausted" or result["staged"]:
        return result
    following = await _refill_audit(api, source, successor)
    for field in ("received", "staged", "already_known"):
        following[field] += result[field]
    return following
