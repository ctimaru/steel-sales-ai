"""NET-PRODUCERS-FILTERS2 · passo 3: short technical facts from official PDFs.

Founder decisions (18 and 23 Nov 2026): technical facts observed on a
producer's own official sources are published at once as «da confermare dal
produttore»; the producer can confirm or remove each one. This covers
standards, steel grades, processes and section shapes read from public
first-party PDF catalogues. Only SHORT facts: never tables, never PDF copies.

This module is a pure function over already-extracted page lines (the bounded,
isolated reader of B3.E). Rules, deliberately conservative:
  * closed vocabularies only (a code that is not on the list is ignored);
  * a page counts only when it is about products (tube/profile/steel words, or
    at least two different kinds of facts on the page); index, contents and
    certificate pages are skipped;
  * certifications and execution standards (ISO 9001, EN 1090, EN 10204…)
    are not product standards and are never returned;
  * no association between values: a grade is never tied to a size, a shape
    or a standard from another line;
  * one fact per (kind, value) per document, with the first page where it
    appears, so the source link can open on that page.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata

MAX_FACTS_PER_DOCUMENT = 40
MAX_LINE = 400

# ---------------------------------------------------------------- standards
# Product standards for steel tubes, hollow sections and long/flat products.
_EN_PRODUCT = {
    "10025", "10028", "10088", "10149", "10208", "10210", "10216", "10217",
    "10219", "10220", "10224", "10225", "10255", "10296", "10297", "10305",
    "10312", "10357", "10358", "10216", "10083", "10084", "10087", "10277",
}
_STANDARD_PATTERNS = [
    # EN 10219-1, UNI EN 10255, EN10305-3
    (re.compile(r"\b(?:UNI\s+|DIN\s+)?EN\s?(10\d{3})(?:\s?[-‐–]\s?(\d))?\b"), "EN"),
    (re.compile(r"\bASTM\s?(A\s?\d{2,4})\b"), "ASTM"),
    (re.compile(r"\bAPI\s?(5(?:L|CT))\b"), "API"),
    (re.compile(r"\bDIN\s?(2391|2393|2394|2395|2448|2458|1626|1629|1630|17175|17457|17458)\b"), "DIN"),
    (re.compile(r"\bISO\s?(3183|1127|4200|10799|11960)\b"), "ISO"),
    (re.compile(r"\bUNI\s?(7287|7288|8863|10255|5462|6363)\b"), "UNI"),
]
_ASTM_ALLOWED = {
    "A53", "A106", "A179", "A192", "A210", "A213", "A249", "A252", "A269",
    "A312", "A333", "A335", "A500", "A501", "A513", "A519", "A554", "A790",
}

# ---------------------------------------------------------------- grades
_GRADE_PATTERNS = [
    # Structural and hollow-section grades: S235JRH, S355J2H, S355 J2H, S460MH …
    re.compile(r"\bS\s?(235|275|355|420|460)\s?(JRH|J0H|J2H|K2H|NH|NLH|MH|MLH|JR|J0|J2|K2|N|NL|M|ML)\b"),
    # Precision / mechanical tubes: E235, E355, E195 (+C, +N, +SR …)
    re.compile(r"\bE(155|195|235|275|355|410|470)(?:\s?\+\s?(?:C|LC|SR|A|N|AR))?(?![\w.,])"),
    # Pressure tubes: P235GH, P265TR1, P355NH …
    re.compile(r"\bP\s?(195|235|265|355)\s?(TR1|TR2|GH|NH|NL1|NL2|N)\b"),
    # Line pipe
    re.compile(r"\bL\s?(245|290|360|415|450|485)\s?(NE|ME|N|M|Q)?\b"),
    # Creep-resisting
    re.compile(r"\b(16Mo3|13CrMo4-5|10CrMo9-10|X10CrMoVNb9-1)\b", re.I),
    # Stainless: AISI 304L, 316L … and material numbers 1.4301 …
    re.compile(r"\bAISI\s?(201|202|301|304L?|309S?|310S?|316L?|316Ti|321|409|410|420|430|439|441|444|904L)\b", re.I),
    re.compile(r"\b(1\.4(?:003|016|301|306|307|401|404|435|462|509|510|512|521|541|571|828|841|845))\b"),
]

# ---------------------------------------------------------------- processes
# (pattern, value as written in a short, neutral form)
_PROCESSES = [
    (re.compile(r"\bsenza\s+saldatura\b|\bseamless\b", re.I), "Senza saldatura"),
    (re.compile(r"\b(?:ERW|HFI|HFW)\b|\balta\s+frequenza\b|\bhigh[-\s]frequency\b", re.I),
     "Saldatura ad alta frequenza"),
    (re.compile(r"\bsaldat[aiue]\s+(?:al\s+)?laser\b|\blaser[-\s]welded\b", re.I), "Saldatura laser"),
    (re.compile(r"\bsaldat[aiue]\s+TIG\b|\bTIG[-\s]welded\b", re.I), "Saldatura TIG"),
    (re.compile(r"\bsaldatura\s+longitudinale\b|\blongitudinal(?:ly)?\s+welded\b", re.I), "Saldatura longitudinale"),
    (re.compile(r"\btubi\s+saldati\b|\bwelded\s+(?:steel\s+)?(?:tubes|pipes)\b", re.I), "Tubi saldati"),
    (re.compile(r"\btrafilat[aiue]\s+a\s+freddo\b|\bcold[-\s]drawn\b", re.I), "Trafilati a freddo"),
    (re.compile(r"\bformat[aiue]\s+a\s+freddo\b|\bcold[-\s]formed\b", re.I), "Formati a freddo"),
    (re.compile(r"\bfinit[aiue]\s+a\s+caldo\b|\bhot[-\s]finished\b", re.I), "Finiti a caldo"),
    (re.compile(r"\blaminat[aiue]\s+a\s+caldo\b|\bhot[-\s]rolled\b", re.I), "Laminati a caldo"),
]

# ---------------------------------------------------------------- shapes
_SHAPES = [
    (re.compile(r"\btub[io]\s+(?:tond[io]|circolar[ei])\b|\bcircular\s+hollow\b|\bCHS\b", re.I), "Tondo"),
    (re.compile(r"\btub[io]\s+quadr(?:i|o|ati|ato)\b|\bsquare\s+hollow\b|\bSHS\b", re.I), "Quadro"),
    (re.compile(r"\btub[io]\s+rettangolar[ei]\b|\brectangular\s+hollow\b|\bRHS\b", re.I), "Rettangolare"),
    (re.compile(r"\btub[io]\s+oval[ei]\b|\boval\s+(?:tubes|hollow)\b", re.I), "Ovale"),
]

# ---------------------------------------------------------------- page context
_PRODUCT_WORDS = re.compile(
    r"\b(tub[io]|tubolar[ei]|profil[io]|profilat[io]|travi|lamier[ae]|barre|acciai[o]?|inox|"
    r"tubes?|pipes?|hollow\s+sections?|steel)\b", re.I)
_SKIP_PAGE = re.compile(
    r"\b(indice|sommario|contents|table\s+of\s+contents|certificat[oie]|certification|"
    r"condizioni\s+generali|privacy|terms\s+and\s+conditions)\b", re.I)
_TOC_LINE = re.compile(r"\.{4,}\s*\d{1,3}\s*$")
_NOT_PRODUCT_STANDARD = re.compile(
    r"\b(?:ISO|EN)\s?(?:ISO\s?)?(9001|14001|45001|50001|3834|1090|10204|17025|9606|15614)\b", re.I)


def _clean(line: str) -> str:
    line = unicodedata.normalize("NFKC", line).replace(" ", " ")
    return re.sub(r"\s+", " ", line).strip()


def _standards(line: str) -> list[str]:
    out: list[str] = []
    for pattern, family in _STANDARD_PATTERNS:
        for match in pattern.finditer(line):
            if family == "EN":
                number = match.group(1)
                if number not in _EN_PRODUCT:
                    continue
                part = match.group(2)
                out.append("EN " + number + ("-" + part if part else ""))
            elif family == "ASTM":
                code = match.group(1).replace(" ", "").upper()
                if code in _ASTM_ALLOWED:
                    out.append("ASTM " + code)
            elif family == "API":
                out.append("API " + match.group(1).upper())
            else:
                out.append(family + " " + match.group(1))
    return out


def _grades(line: str) -> list[str]:
    out: list[str] = []
    for pattern in _GRADE_PATTERNS:
        for match in pattern.finditer(line):
            text = match.group(0)
            if text.upper().startswith("AISI"):
                out.append("AISI " + match.group(1).upper().replace("TI", "Ti"))
                continue
            compact = re.sub(r"\s+", "", text)
            # «L360» alone is too ambiguous (lengths, labels): keep line-pipe grades only with a suffix.
            if re.fullmatch(r"L\d{3}", compact):
                continue
            out.append(compact)
    return out


def _vocab(line: str, table) -> list[str]:
    return [value for pattern, value in table if pattern.search(line)]


def extract_pdf_short_facts(pages: list[dict]) -> dict:
    """Pages: [{"page": int, "lines": [str, …]}] → short facts with page locators.

    Returns {"facts": [{kind, value, page, line_sha256}], "pages_used": int,
    "pages_skipped": int, "truncated": bool}.
    """
    facts: list[dict] = []
    seen: set[tuple[str, str]] = set()
    used = skipped = 0
    truncated = False
    for page in pages:
        number = page.get("page")
        lines = [_clean(l) for l in page.get("lines", []) if isinstance(l, str)]
        lines = [l for l in lines if l and len(l) <= MAX_LINE]
        text = " ".join(lines)
        if type(number) is not int or not lines or _SKIP_PAGE.search(text[:600]):
            skipped += 1
            continue
        page_facts: list[tuple[str, str, str]] = []
        for line in lines:
            if _TOC_LINE.search(line) or _NOT_PRODUCT_STANDARD.search(line) and not _standards(line):
                continue
            for value in _standards(line):
                page_facts.append(("technical_standard", value, line))
            for value in _grades(line):
                page_facts.append(("steel_grade", value, line))
            for value in _vocab(line, _PROCESSES):
                page_facts.append(("manufacturing_process", value, line))
            for value in _vocab(line, _SHAPES):
                page_facts.append(("section_shape", value, line))
        kinds = {kind for kind, _, _ in page_facts}
        # A page counts if it is about products, or carries at least two kinds of facts.
        if not page_facts or (not _PRODUCT_WORDS.search(text) and len(kinds) < 2):
            skipped += 1
            continue
        used += 1
        for kind, value, line in page_facts:
            key = (kind, value.lower())
            if key in seen:
                continue
            if len(facts) >= MAX_FACTS_PER_DOCUMENT:
                truncated = True
                break
            seen.add(key)
            facts.append({
                "kind": kind, "value": value, "page": number,
                "line_sha256": hashlib.sha256(line.encode("utf-8")).hexdigest(),
            })
    return {"facts": facts, "pages_used": used, "pages_skipped": skipped, "truncated": truncated}


# ---------------------------------------------------------------- queue runner
MODES = ("review", "publish")


def _read_pages(source_url: str, domain: str) -> list[dict]:
    """Bounded first-party download + isolated text windows (same guards as B3.E)."""
    from .net_pro_producers_catalog_b1 import CatalogueRejected
    from .net_pro_producers_catalog_discovery import _robots_allows
    from .net_pro_producers_pdf_public_facts_b3e import _is_official_pdf_url, bounded_official_pdf
    from .net_pro_producers_pdf_windows_b3e import read_pdf_fact_window, MAX_TOTAL_PAGES

    if not _is_official_pdf_url(source_url, domain):
        raise CatalogueRejected("F2 source is not an official PDF URL")
    if not _robots_allows(source_url, domain, {}):
        raise CatalogueRejected("F2 robots unavailable or denied")
    content = bounded_official_pdf(source_url, domain)
    pages: list[dict] = []
    total = None
    next_page = 1
    while total is None or next_page <= total:
        window = read_pdf_fact_window(content, start_page=next_page)
        total = window["total_pages"] if total is None else total
        if total != window["total_pages"] or not window["pages"] or window["pages"][0]["page"] != next_page:
            raise CatalogueRejected("F2 inconsistent PDF window")
        pages.extend({"page": p["page"], "lines": p["lines"]} for p in window["pages"])
        next_page += len(window["pages"])
        if next_page > MAX_TOTAL_PAGES + 1:
            raise CatalogueRejected("F2 PDF page bound exceeded")
    return pages


def run_f2_claims_queue(db, *, mode: str, limit: int = 1, read_pages=_read_pages) -> dict:
    """Drain the dedicated queue. 'review' never writes facts: it only reports them
    (short values + page) for the sample check. 'publish' stages them."""
    from .net_pro_producers_catalog_b1 import CatalogueRejected

    if mode not in MODES or type(limit) is not int or not 1 <= limit <= 3:
        raise ValueError("F2 mode must be review|publish and limit 1-3")

    def rpc(operation, payload):
        result = db.rpc("netproducers3_pdf_claims", {"p_operation": operation, "p_payload": payload}).execute().data
        if (not isinstance(result, dict) or result.get("contract") != "netproducers3-pdf-claims-v1"
                or result.get("operation") != operation):
            raise CatalogueRejected("F2 queue RPC contract failure")
        return result

    seeded = rpc("seed", {"limit": 40})
    claimed = rpc("claim", {"limit": limit, "mode": mode})
    items = claimed.get("items")
    if not isinstance(items, list) or len(items) > limit or claimed.get("count") != len(items):
        raise CatalogueRejected("F2 unexpected lease")
    report = {"contract": "netproducers3-f2-worker-v1", "mode": mode, "seeded": seeded.get("added", 0),
              "leased": len(items), "inspected": 0, "complete": 0, "blocked": 0, "retry": 0,
              "candidates": 0, "published": 0, "review": []}
    for item in items:
        if (not isinstance(item, dict) or not item.get("company_id") or not item.get("lease_token")
                or item.get("source_status") != "official_link_observed" or item.get("rights_status") != "link_only"):
            raise CatalogueRejected("F2 invalid trusted lease")
        base = {"company_id": item["company_id"], "source_url": item["source_url"], "lease_token": item["lease_token"]}
        published = 0
        try:
            pages = read_pages(item["source_url"], item["canonical_domain"])
            facts = extract_pdf_short_facts(pages)["facts"]
            if mode == "review":
                status = "inspected"
                report["review"].append({
                    "company_id": item["company_id"], "source_url": item["source_url"],
                    "facts": [{"kind": f["kind"], "value": f["value"], "page": f["page"]} for f in facts],
                })
            else:
                if facts:
                    staged = rpc("stage", {**base, "facts": [
                        {"kind": f["kind"], "value": f["value"], "page": f["page"]} for f in facts]})
                    published = int(staged.get("added", 0))
                status = "complete"
            info = {"candidates": len(facts), "published": published}
            report["candidates"] += len(facts)
            report["published"] += published
        except CatalogueRejected:
            status, info = "blocked", {"error_code": "source_rejected"}
        except Exception:
            status, info = "retry", {"error_code": "extractor_or_stage_error"}
        rpc("complete", {**base, "status": status, **info})
        report[status] += 1
    return report
