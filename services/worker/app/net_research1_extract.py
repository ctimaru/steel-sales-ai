"""NET-RESEARCH1: turn an AI reading of a company's official website into a
checked «Profilo in breve».

The model only proposes. Everything it proposes is checked here against the
text actually fetched from the company's own pages:
* the summary must be written in our own words (no long copied passages) and
  carry no e-mail, link or phone number;
* every label (activity, product, sector, market) must be supported by words
  that appear on the site; certifications must be standard codes printed there;
* every number (founded year, employees, revenue, plants) needs a sentence
  quoted verbatim from one page, the number must be in that sentence, and the
  sentence must say what the number is. Revenue is read from the quote itself,
  never from the model, and only when the company states it (founder decision).
Employees and revenue are stored as bands (founder decision, 26 nov 2026).
"""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import date

EMPLOYEE_BANDS = ((9, "1-9"), (49, "10-49"), (249, "50-249"), (999, "250-999"))
REVENUE_BANDS = ((2e6, "lt2m"), (10e6, "2-10m"), (50e6, "10-50m"), (250e6, "50-250m"))
LIST_LIMITS = {"activities": 12, "products": 20, "sectors": 12, "markets": 12}
CONTACT_NOISE = re.compile(
    r"[\w.+-]+@[\w-]+\.[\w.-]+|https?://\S+|www\.\S+|\+?\d[\d\s./-]{7,}\d")
CERT_RE = re.compile(
    r"^(?:UNI\s+)?(?:EN\s+)?(?:ISO\s+)?(?:EN\s+)?(\d{3,5})(?:[-:](\d{1,2}))?$|^(IATF\s*16949|PED|SOA|AD\s*2000)$",
    re.I)
EMPLOYEE_CUE = re.compile(r"dipendent|addett|collaborator|lavorator|persone|employees|staff|people", re.I)
REVENUE_CUE = re.compile(r"fatturat|ricavi|giro d.affari|turnover|revenue|sales of", re.I)
FOUNDED_CUE = re.compile(r"fondat|nasc|nata|nato|dal\s|since|founded|established|storia|anno", re.I)
PLANT_CUE = re.compile(r"stabiliment|sedi produttive|unit[aà] produttiv|siti produttiv|plants?\b|factor", re.I)
REVENUE_AMOUNT = re.compile(
    r"(\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?)\s*"
    r"(?:(miliardi|miliardo|mld|billion|bn|milioni|milione|mln|mio|million|m)(?![a-z]))?\.?\s*(?:di\s+)?(?:€|euro|eur\b)?",
    re.I)


def _plain(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c)).casefold()
    return re.sub(r"\s+", " ", re.sub(r"[^\w%€]+", " ", text)).strip()


def clean_page_text(text: str, limit: int = 3500) -> str:
    """Page text sent to the model: no e-mails, links or phone numbers."""
    return re.sub(r"\s+", " ", CONTACT_NOISE.sub(" ", text or "")).strip()[:limit]


def parse_model_json(content: str) -> dict:
    content = re.sub(r"<think>.*?</think>", "", content or "", flags=re.S | re.I)
    match = re.search(r"\{.*\}", content, re.S)
    if not match:
        return {}
    try:
        value = json.loads(match.group(0))
    except ValueError:
        return {}
    return value if isinstance(value, dict) else {}


def _copied_share(summary: str, corpus_plain: str, size: int = 8) -> float:
    words = _plain(summary).split()
    shingles = [" ".join(words[i:i + size]) for i in range(max(0, len(words) - size + 1))]
    if not shingles:
        return 0.0
    return sum(1 for s in shingles if s in corpus_plain) / len(shingles)


def _supported(label: str, corpus_plain: str) -> bool:
    tokens = [t for t in _plain(label).split() if len(t) >= 4]
    if not tokens:
        return False
    # tolerate singular/plural endings on longer words
    found = sum(1 for t in tokens if (t[:-1] if len(t) >= 6 else t) in corpus_plain)
    return found >= max(1, round(len(tokens) * 0.6))


def _labels(raw: object, limit: int, corpus_plain: str) -> list[str]:
    out: list[str] = []
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, str):
            continue
        label = re.sub(r"\s+", " ", item).strip(" .;:-")
        if not 2 <= len(label) <= 80 or re.search(r"[@/<>]|https?:|www\.", label):
            continue
        if _supported(label, corpus_plain) and label.casefold() not in {x.casefold() for x in out}:
            out.append(label[:1].upper() + label[1:])
        if len(out) >= limit:
            break
    return out


def _certifications(raw: object, corpus_plain: str) -> list[str]:
    out: list[str] = []
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, str):
            continue
        value = re.sub(r"\s+", " ", item).strip().upper()
        match = CERT_RE.match(value)
        if not match:
            continue
        code = match.group(1)
        if code and code not in corpus_plain.replace(" ", ""):
            continue
        if not code and _plain(match.group(3)).replace(" ", "") not in corpus_plain.replace(" ", ""):
            continue
        if value not in out:
            out.append(value)
        if len(out) >= 12:
            break
    return out


def _quoted(fact: object, pages: list[tuple[str, str]], cue: re.Pattern) -> tuple[str, str] | None:
    """(quote, url) if the model's quote is on one page verbatim and has the cue."""
    if not isinstance(fact, dict) or not isinstance(fact.get("quote"), str):
        return None
    quote = re.sub(r"\s+", " ", fact["quote"]).strip()
    if not 8 <= len(quote) <= 400 or not cue.search(quote):
        return None
    needle = _plain(quote)
    for url, text in pages:
        if needle and needle in _plain(text):
            return quote, url
    return None


def _number(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        digits = re.sub(r"[^\d]", "", value)
        return float(digits) if digits else None
    return None


def _in_quote(number: float, quote: str) -> bool:
    plain = re.sub(r"(?<=\d)[.\s](?=\d{3}\b)", "", quote)
    return re.search(rf"(?<![\d.,]){int(number)}(?![\d])", plain) is not None


def revenue_from_quote(quote: str) -> float | None:
    """Euro amount stated in a revenue sentence, or None if not explicit."""
    best = None
    for match in REVENUE_AMOUNT.finditer(quote):
        raw, unit = match.group(1), (match.group(2) or "").casefold()
        before = quote[max(0, match.start() - 4):match.start()]
        if not unit and "€" not in match.group(0) + before and "euro" not in match.group(0).casefold():
            continue
        if re.fullmatch(r"(19|20)\d\d", raw) and not unit:
            continue  # a year, not an amount
        if re.search(r"\d[.\s]\d{3}", raw):
            amount = float(re.sub(r"[.\s]", "", raw))
        else:
            amount = float(raw.replace(",", "."))
        if unit in ("miliardi", "miliardo", "mld", "billion", "bn"):
            amount *= 1e9
        elif unit in ("milioni", "milione", "mln", "mio", "million", "m"):
            amount *= 1e6
        if amount >= 1e5:
            best = amount if best is None else max(best, amount)
    return best


def band(value: float, bands: tuple, top: str) -> str:
    for limit, label in bands:
        if value <= limit if bands is EMPLOYEE_BANDS else value < limit:
            return label
    return top


def validate_profile(raw: dict, pages: list[tuple[str, str]], *, today: date | None = None) -> dict:
    """Checked profile ready for net_research1_record, plus 'outcome'."""
    today = today or date.today()
    corpus_plain = _plain(" ".join(text for _, text in pages))
    profile: dict = {"facts": {}}

    summary = raw.get("summary") if isinstance(raw.get("summary"), str) else ""
    summary = re.sub(r"\s+", " ", summary).strip()
    if (80 <= len(summary) <= 900 and not CONTACT_NOISE.search(summary)
            and _copied_share(summary, corpus_plain) <= 0.3):
        profile["summary"] = summary

    for key, limit in LIST_LIMITS.items():
        profile[key] = _labels(raw.get(key), limit, corpus_plain)
    profile["certifications"] = _certifications(raw.get("certifications"), corpus_plain)

    founded = raw.get("founded_year")
    hit = _quoted(founded, pages, FOUNDED_CUE)
    year = _number(founded.get("value")) if isinstance(founded, dict) else None
    if hit and year and 1800 <= year <= today.year and str(int(year)) in hit[0]:
        profile["founded_year"] = int(year)
        profile["facts"]["founded_year"] = {"quote": hit[0], "url": hit[1]}

    employees = raw.get("employees")
    hit = _quoted(employees, pages, EMPLOYEE_CUE)
    count = _number(employees.get("value")) if isinstance(employees, dict) else None
    if hit and count and 1 <= count <= 500000 and _in_quote(count, hit[0]):
        profile["employees_band"] = band(count, EMPLOYEE_BANDS, "1000+")
        profile["facts"]["employees"] = {"quote": hit[0], "url": hit[1]}

    revenue = raw.get("revenue")
    hit = _quoted(revenue, pages, REVENUE_CUE)
    amount = revenue_from_quote(hit[0]) if hit else None
    if hit and amount:
        profile["revenue_band"] = band(amount, REVENUE_BANDS, "gt250m")
        years = [int(y) for y in re.findall(r"\b(20\d\d|19\d\d)\b", hit[0]) if 1990 <= int(y) <= today.year]
        profile["revenue_year"] = max(years) if years else None
        profile["facts"]["revenue"] = {"quote": hit[0], "url": hit[1]}

    plants = raw.get("plants")
    hit = _quoted(plants, pages, PLANT_CUE)
    n_plants = _number(plants.get("value")) if isinstance(plants, dict) else None
    if hit and n_plants and 1 <= n_plants <= 200 and _in_quote(n_plants, hit[0]):
        profile["plants_count"] = int(n_plants)
        profile["facts"]["plants"] = {"quote": hit[0], "url": hit[1]}

    has_content = bool(profile.get("summary") or any(profile[k] for k in LIST_LIMITS)
                       or profile["certifications"])
    profile["outcome"] = "researched" if has_content else "no_content"
    return profile
