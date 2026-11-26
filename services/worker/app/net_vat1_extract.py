"""NET-VAT1: the company's own P.IVA, read from its official pages.

Italian companies must print their partita IVA on their website (DPR 633/72,
art. 35), usually in the footer, on Contatti, Note legali or Privacy. This
module only reads text already fetched from the company-owned domain and
returns at most one P.IVA. It is deliberately conservative:

* the 11 digits must follow a VAT cue (P.IVA, Partita IVA, VAT, C.F./P.IVA);
* the Italian check digit must be valid;
* a P.IVA printed in a web agency / hosting credit is ignored;
* two different valid P.IVA on the same site are only resolved when exactly
  one of them is printed next to the company's own legal name; otherwise the
  result is "ambiguous" and nothing is recorded.
No personal data: sole traders are never published in the Network.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from html import unescape

VAT_CUE = re.compile(
    r"(?:p\.?\s?iva|partita\s+iva|part\.\s?iva|\bvat(?:\s+(?:no\.?|number|id|code))?"
    r"|c\.\s?f\.\s*(?:e|/|-)\s*p\.?\s?iva|cod(?:ice)?\.?\s+fisc(?:ale)?\.?\s*(?:e|/|-)\s*p\.?\s?iva)"
    r"[\s:.\-–#n°º]{0,6}(?:IT\s?)?(\d{11})(?!\d)",
    re.I,
)
# Text before a P.IVA that says it belongs to someone else (site builder...).
CREDIT_CUE = re.compile(
    r"realizzat|powered|web\s*agency|agenzia|design(?:ed)?\s+by|sviluppat|credits?|"
    r"hosting|a\s+cura\s+di|seo\s+by|made\s+by|sito\s+web\s+(?:di|by)",
    re.I,
)
LEGAL_FORM = re.compile(
    r"\b(?:s\.?\s?r\.?\s?l\.?(?:\s?s\.?)?|s\.?\s?p\.?\s?a\.?|s\.?\s?n\.?\s?c\.?|s\.?\s?a\.?\s?s\.?)(?![a-z0-9])",
    re.I,
)


def it_vat_ok(vat: str) -> bool:
    """Italian partita IVA check digit (same rule as the database)."""
    if not re.fullmatch(r"\d{11}", vat or "") or vat == "00000000000":
        return False
    total = 0
    for index, char in enumerate(vat[:10], start=1):
        digit = int(char)
        if index % 2 == 0:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
    return (10 - total % 10) % 10 == int(vat[10])


def _name_core(legal_name: str) -> str:
    value = LEGAL_FORM.sub(" ", unescape(legal_name or "").casefold())
    value = re.sub(r"[^a-z0-9à-ÿ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _flat(text: str) -> str:
    return re.sub(r"[^a-z0-9à-ÿ]+", " ", text.casefold())


@dataclass(frozen=True)
class VatFinding:
    outcome: str  # "found" | "not_found" | "ambiguous"
    vat_id: str | None = None
    page_index: int | None = None


def find_firstparty_vat(page_texts: list[str], legal_name: str = "") -> VatFinding:
    """Return the company's own P.IVA from its official pages, or why not."""
    core = _name_core(legal_name)
    seen: dict[str, dict[str, int | bool]] = {}
    for page_index, raw in enumerate(page_texts):
        text = " ".join(unescape(raw or "").split())
        for match in VAT_CUE.finditer(text):
            vat = match.group(1)
            if not it_vat_ok(vat):
                continue
            before = text[max(0, match.start() - 80):match.start()]
            if CREDIT_CUE.search(before):
                continue
            near_name = bool(core) and len(core) >= 3 and core in _flat(
                text[max(0, match.start() - 200):match.end() + 60])
            entry = seen.setdefault(vat, {"count": 0, "near_name": False, "page": page_index})
            entry["count"] = int(entry["count"]) + 1
            entry["near_name"] = bool(entry["near_name"]) or near_name
    if not seen:
        return VatFinding("not_found")
    if len(seen) == 1:
        vat, entry = next(iter(seen.items()))
        return VatFinding("found", vat, int(entry["page"]))
    named = [vat for vat, entry in seen.items() if entry["near_name"]]
    if len(named) == 1:
        return VatFinding("found", named[0], int(seen[named[0]]["page"]))
    return VatFinding("ambiguous")


_NAME_STOPWORDS = {
    "srl", "srls", "spa", "snc", "sas", "societa", "società", "a", "r", "l", "s", "p", "di", "de",
    "del", "della", "dei", "e", "ed", "and", "c", "co", "in", "liquidazione", "unipersonale",
    "socio", "unico", "con", "per", "group", "gruppo", "italia", "italy", "the",
}


def _name_tokens(value: str) -> set[str]:
    value = unescape(value or "").casefold().replace("f.lli", "fratelli").replace("flli", "fratelli")
    value = LEGAL_FORM.sub(" ", value)
    return {t for t in re.split(r"[^a-z0-9à-ÿ]+", value) if len(t) >= 3 and t not in _NAME_STOPWORDS}


def vies_name_match(legal_name: str, registered_name: str | None) -> str:
    """'match' | 'mismatch' | 'unknown' between our legal name and VIES's.

    Only a clear disagreement is 'mismatch': VIES gives a name and it shares
    no meaningful word with ours (nor contains it once spaces are removed).
    """
    registered = (registered_name or "").strip()
    if not registered or registered.strip("- ") == "":
        return "unknown"
    ours, theirs = _name_tokens(legal_name), _name_tokens(registered)
    if not ours or not theirs:
        return "unknown"
    if ours & theirs:
        return "match"
    compact = lambda v: re.sub(r"[^a-z0-9]+", "", LEGAL_FORM.sub(" ", unescape(v).casefold()))
    a, b = compact(legal_name), compact(registered)
    if len(a) >= 4 and len(b) >= 4 and (a in b or b in a):
        return "match"
    return "mismatch"
