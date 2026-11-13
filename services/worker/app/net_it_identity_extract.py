"""NET-IT-AUTO2 v4: find a company's own ragione sociale on its official pages.

Italian companies print their legal identity in the footer, contact or legal
pages ("Mattiolo S.r.l. - P.IVA 01234567890"). The crawler's first guess is
often a brand, a page title or the domain itself, so the reviewer looks for a
company name WITH an admitted legal form on the company's own pages and uses
it when it clearly belongs to that website (shares its name with the domain or
with the first guess). Web-agency credits ("realizzato da X S.r.l.") are
ignored. Pure functions, no I/O: the reviewer passes the page texts.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from html import unescape

_FORM = re.compile(
    r"(?<![A-Za-z0-9])"
    r"(S\.?\s?r\.?\s?l\.?(?:\s?s\.?(?![A-Za-z]))?|S\.?\s?p\.?\s?A\.?|"
    r"S\.?\s?n\.?\s?c\.?|S\.?\s?a\.?\s?s\.?)"
    r"(?![A-Za-z0-9])",
    re.I,
)
# Text that tells us the name is the site's own legal identity.
_IDENTITY_CUES = re.compile(
    r"p\.?\s?iva|partita\s+iva|\bvat\b|codice\s+fiscale|c\.\s?f\.|sede\s+legale|"
    r"capitale\s+sociale|ragione\s+sociale|\br\.?\s?e\.?\s?a\.?\b|©|copyright",
    re.I,
)
# Text that tells us the name is somebody else (site builder, host...).
_CREDIT_CUES = re.compile(
    r"realizzat|powered|design|sviluppat|web\s*agency|credits?|hosting|"
    r"\bby\b|a\s+cura\s+di|partner|cliente|clienti|fornitor",
    re.I,
)
_VAT_AFTER = re.compile(
    r"(?:p\.?\s?iva|partita\s+iva|\bvat(?:\s+(?:no|number|id))?|c\.\s?f\.\s*(?:e|/)\s*p\.?\s?iva)"
    r"\s*[:.\-]?\s*(?:IT)?\s*(\d{11})(?!\d)",
    re.I,
)
_STOP_CHARS = "|•·©®™:;\"«»()[]{}<>\n\r\t"
_CONNECTORS = {"&", "e", "di", "de", "del", "della", "dei", "degli", "c.", "&c.", "f.lli", "fratelli"}
_LEADING_NOISE = {"copyright", "tutti", "i", "diritti", "riservati", "all", "rights", "reserved",
                  "la", "il", "lo", "società", "societa", "azienda", "ditta", "ragione", "sociale"}
_GENERIC = {
    "carpenteria", "carpenterie", "metallica", "metalliche", "metallici", "costruzioni",
    "acciai", "acciaio", "lavorazioni", "lavorazione", "lamiere", "lamiera", "officina",
    "officine", "industria", "industrie", "group", "gruppo", "italia", "italiana", "tubi",
    "metal", "metals", "steel", "impianti", "meccanica", "meccaniche", "sistemi", "service",
    "services", "servizi", "inox", "srl", "spa", "snc", "sas", "srls", "the", "and",
}


@dataclass(frozen=True)
class CompanyIdentity:
    legal_name: str
    vat_id: str | None
    score: int


def _compact(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", unescape(value).casefold())


def _domain_label(domain: str) -> str:
    host = domain.casefold().removeprefix("www.")
    parts = host.split(".")
    label = parts[0] if len(parts) > 1 else host
    return _compact(label)


def _tokens(value: str) -> list[str]:
    return [t for t in re.split(r"[^0-9a-zà-ÿ]+", unescape(value).casefold()) if len(t) >= 3]


def _related(core: str, domain: str, first_guess: str) -> bool:
    """The name belongs to this website: it shares a distinctive part with the
    domain or with the crawler's first guess."""
    label = _domain_label(domain)
    core_c = _compact(core)
    if len(core_c) >= 3 and label and (core_c in label or label in core_c):
        return True
    first = _compact(core.split()[0]) if core.split() else ""
    if len(first) >= 3 and first not in _GENERIC and first in label:
        return True   # acronym or brand as first word, e.g. "C.M.O." on cmosnc.it
    distinctive = [t for t in _tokens(core) if t not in _GENERIC]
    if any(_compact(t) in label for t in distinctive if len(_compact(t)) >= 3):
        return True
    guess = {t for t in _tokens(first_guess) if t not in _GENERIC}
    return bool(guess and set(distinctive) & guess)


def _name_before(text: str, form_start: int) -> tuple[str, int] | None:
    """Capitalised words right before the legal form (max 8), stopping at a
    lowercase word, punctuation or a dash separator."""
    window = text[max(0, form_start - 120):form_start]
    for ch in _STOP_CHARS:
        cut = window.rfind(ch)
        if cut >= 0:
            window = window[cut + 1:]
    for sep in (" - ", " – ", " — ", " | "):
        cut = window.rfind(sep)
        if cut >= 0:
            window = window[cut + len(sep):]
    words = window.split()
    picked: list[str] = []
    for word in reversed(words):
        bare = word.strip(",.")
        low = word.casefold()
        if not bare:
            break
        if low in _CONNECTORS or bare[0].isupper() or bare[0].isdigit() or bare.isupper():
            picked.append(word)
            if len(picked) >= 8:
                break
            continue
        break
    picked.reverse()
    while picked and (picked[0].casefold() in _CONNECTORS
                      or picked[0].casefold().strip(",.") in _LEADING_NOISE
                      or picked[0].strip(",.").isdigit()):
        picked.pop(0)
    while picked and picked[-1].casefold() in {"&", "e", "di"}:
        picked.pop()
    if not picked:
        return None
    core = " ".join(picked).strip(" ,-–")
    if not re.search(r"[A-Za-zÀ-ÿ]", core) or len(core) > 200:
        return None
    start = text.rfind(picked[0], max(0, form_start - 200), form_start)
    return core, max(0, start)


def find_company_identity(page_texts: list[str], domain: str,
                          first_guess: str) -> CompanyIdentity | None:
    """Best company name (with S.r.l./S.r.l.s./S.p.A./S.n.c./S.a.s.) printed on
    the site's own pages that belongs to this domain, or None."""
    totals: dict[str, CompanyIdentity] = {}
    for raw in page_texts:
        text = " ".join(unescape(raw or "").split())
        for match in _FORM.finditer(text):
            found = _name_before(text, match.start())
            if not found:
                continue
            core, core_start = found
            if _CREDIT_CUES.search(text[max(0, core_start - 40):core_start]):
                continue
            if not _related(core, domain, first_guess):
                continue
            context = text[max(0, core_start - 150):match.end() + 150]
            score = 1 + (3 if _IDENTITY_CUES.search(context) else 0)
            vat = _VAT_AFTER.search(text[match.end():match.end() + 200])
            name = f"{core} {match.group(1).strip()}"
            key = _compact(name)
            previous = totals.get(key)
            if previous:
                totals[key] = CompanyIdentity(previous.legal_name, previous.vat_id or
                                              (vat.group(1) if vat else None),
                                              previous.score + score)
            else:
                totals[key] = CompanyIdentity(name, vat.group(1) if vat else None, score)
    if not totals:
        return None
    best = max(totals.values(), key=lambda i: (i.score, len(i.legal_name)))
    return best
