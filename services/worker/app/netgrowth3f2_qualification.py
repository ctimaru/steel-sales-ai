"""Evidence-only industrial company audit. Never attest supplier eligibility or stock."""
from typing import Any
from urllib.parse import urlsplit


def _is_first_party(url: str, domain: str) -> bool:
    try:
        x = urlsplit(url)
        return (x.scheme == "https" and not x.username and not x.password
                and x.port is None and not x.fragment
                and (x.hostname or "").removeprefix("www.").lower() == domain.lower())
    except (ValueError, TypeError):
        return False


def qualify(record: dict[str, Any], required: dict[str, str]) -> dict[str, Any]:
    domain = record.get("domain", "")
    if (record.get("review_state") != "research_candidate"
            or not _is_first_party(record.get("source_url", ""), domain)):
        return {"domain": domain, "status": "hold", "matched": {},
                "unknown": sorted(required), "rfq_allowed": False}
    claims = [c for c in record.get("claims", [])
              if c.get("review_state") == "candidate_first_party"
              and c.get("type") in {"product", "process", "material", "standard", "grade", "shape", "dimension"}
              and _is_first_party(c.get("source_url", ""), domain)]
    matched, unknown = {}, []
    for key, value in required.items():
        if key == "role":
            url = record["source_url"] if record.get("role") == value else None
        else:
            url = next((c["source_url"] for c in claims
                        if c["type"] == key and c.get("value", "").casefold().strip() == str(value).casefold().strip()), None)
        if url:
            matched[key] = url
        else:
            unknown.append(key)
    return {"domain": domain, "status": "evidence_only_not_verified",
            "matched": matched, "unknown": sorted(unknown),
            "full_spec_documented": not unknown, "supplier_verified": False,
            "stock_confirmed": False, "rfq_allowed": False}
