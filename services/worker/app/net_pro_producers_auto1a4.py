"""AUTO1.A.4: conservative second-level discovery and source-local evidence extraction.

Pure functions: no network, database writes, or publicly asserted capacity.
A technical tuple is a *candidate*, never proof of present manufacturability.
Only exact specifications in the same HTML table row can be returned.
"""
from __future__ import annotations

from html.parser import HTMLParser
import re
from urllib.parse import urljoin, urlsplit, urlunsplit

MAX_LINKS = 6
MAX_ROWS = 120
STANDARD = re.compile(r"\bEN\s*[- ]?\s*(10219|10210)(?:[- ]?[12])?\b", re.I)
GRADE = re.compile(r"\bS(?:235|275|355|420|460)(?:JR|J0|J2|M|ML|N|NL)?H\b", re.I)
SHAPE = re.compile(r"\b(CHS|SHS|RHS)\b", re.I)
DIM_RHS = re.compile(r"(?<!\d)(\d{2,4}(?:[.,]\d+)?)\s*[x×]\s*(\d{2,4}(?:[.,]\d+)?)\s*[x×]\s*(\d{1,2}(?:[.,]\d+)?)(?!\d)", re.I)
DIM_CHS = re.compile(r"(?:Ø|OD\s*[:=]?)\s*(\d{2,4}(?:[.,]\d+)?)\s*[x×]\s*(\d{1,2}(?:[.,]\d+)?)(?!\d)", re.I)
DETAIL = re.compile(r"(?:scheda[-_/ ]?tecnica|dettagli[oi]?|technical[-_/ ]?(?:data|details?|specifications?)|"
                    r"datasheet|product[-_/ ]?details?|specifiche[-_/ ]?tecniche|"
                    r"tub[io]|pipes?|hollow[-_/ ]?sections?|profil[io]|rhs|shs|chs)", re.I)
SKIP = re.compile(r"(?:privacy|cookie|login|contact|contatt|about|blog|news|cart|checkout)", re.I)
NON_HTML = re.compile(r"\.(?:pdf|docx?|xlsx?|zip|csv|jpg|png|webp|svg)(?:$|[?#])", re.I)
# Only skip unmistakeable corporate/nontechnical path *segments*, not pages
# containing a relevant product word. Never delete any already indexed URL.
NONTECHNICAL_PATH = re.compile(
    r"(?:^|/)(?:sostenibilita(?:-[0-9]+)?|sustainability|"
    r"lavora-con-noi|posizioni-aperte|careers?|jobs?|job-openings|"
    r"privacy-policy|cookie-policy|criteri-ambientali-minimi)(?:/|$)", re.I)
TECHNICAL_PRIORITY = re.compile(
    r"(?:10219|10210|technical[- /_]?(?:data|details?|specifications?)|"
    r"scheda[- /_]?tecnica|specifiche[- /_]?tecniche|dimensional|"
    r"dimensions?|datasheet|grades?|norm[ae]|standards?)", re.I)
SECTION_PRIORITY = re.compile(
    r"(?:\bRHS\b|\bSHS\b|\bCHS\b|hollow[- /_]?sections?|"
    r"tubi[- /_]?strutturali|structural[- /_]?(?:tubes?|pipes?|sections?))", re.I)
LOW_PRIORITY = re.compile(
    r"(?:drenant|drainage|paladex|paladrain|creep|"
    r"rigidita[- /_]?anulare|sistemi[- /_]?di[- /_]?giunzione)", re.I)
# Rank explicit *HTML* dimensional tables first, but preserve broad discovery
# and the existing cap of six. This does not fetch linked PDFs or imply proof.
DIMENSIONAL_TABLE_PRIORITY = re.compile(
    r"(?:tabelle?[- /_]?(?:dimensiona(?:li|le)|misure|spessori)|"
    r"(?:dimensional|dimension|size|section)[- /_]?(?:tables?|charts?)|"
    r"(?:tables?|charts?)[- /_]?(?:dimensional|dimension|sizes?)|"
    r"(?:wall[- /_]?thickness|spessori)[- /_]?(?:tables?|charts?))", re.I)
NONSTRUCTURAL_PRIORITY = re.compile(
    r"(?:elastomer|elastomer[oi]|adesiv[oi]|adhesives?|"
    r"composit[ei]|paladex|drainage|drenagg|giunzione)", re.I)


class _Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.href = None
        self.label = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.label = []

    def handle_data(self, data):
        if self.href is not None and len(self.label) < 10:
            self.label.append(data[:80])

    def handle_endtag(self, tag):
        if tag == "a" and isinstance(self.href, str):
            self.links.append((self.href, " ".join(self.label)[:120]))
            self.href = None


def discover_detail_links(html: str, parent_url: str, official_host: str, parent_sha256: str) -> list[dict]:
    """Depth-2 URL candidates tied to the actual parent SHA; caller enforces robots/DNS."""
    if not re.fullmatch(r"[0-9a-f]{64}", parent_sha256):
        return []
    root = urlsplit(parent_url)
    if root.scheme != "https" or root.hostname != official_host:
        return []
    canonical_host = official_host.removeprefix("www.")
    allowed_hosts = {canonical_host, "www." + canonical_host}
    parser = _Links()
    parser.feed(html[:512_000])
    unique = {}
    for href, label in parser.links[:1000]:
        try:
            raw = urlsplit(urljoin(parent_url, href))
            if (raw.scheme != "https" or raw.hostname not in allowed_hosts
                    or raw.username or raw.password or raw.port not in (None, 443)
                    or not raw.path or raw.path == "/" or len(raw.path) > 800
                    or not re.fullmatch(r"/[A-Za-z0-9._~/%-]+", raw.path)
                    or NON_HTML.search(raw.path)):
                continue
            url = urlunsplit(("https", official_host, raw.path, "", ""))
            if url == urlunsplit(("https", official_host, root.path, "", "")):
                continue
            if SKIP.search(raw.path) or NONTECHNICAL_PATH.search(raw.path):
                continue
            relevance = raw.path.replace("-", " ").replace("_", " ") + " " + label
            if not DETAIL.search(relevance):
                continue
            # Prioritization changes *which links to visit first* only. It does
            # not change A4 same-row proof, URL trust, source SHA or permissions.
            score = (8 * bool(TECHNICAL_PRIORITY.search(relevance))
                     + 12 * bool(DIMENSIONAL_TABLE_PRIORITY.search(relevance))
                     + 5 * bool(SECTION_PRIORITY.search(relevance))
                     - 5 * bool(LOW_PRIORITY.search(relevance))
                     - 6 * bool(NONSTRUCTURAL_PRIORITY.search(relevance)))
            if url not in unique or score > unique[url][0]:
                unique[url] = (score, {
                    "url": url, "parent_url": parent_url,
                    "parent_sha256": parent_sha256, "depth": 2,
                })
        except (ValueError, TypeError):
            continue
    return [item for _, (score, item) in sorted(
        unique.items(), key=lambda pair: (-pair[1][0], pair[0])
    )[:MAX_LINKS]]


class _Rows(HTMLParser):
    """Keep only text within individual tr/td cells; no joining adjacent rows."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.row = None
        self.cell = None
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self.skip += 1
        if self.skip:
            return
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []

    def handle_data(self, data):
        if not self.skip and self.cell is not None:
            self.cell.append(data[:200])

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript") and self.skip:
            self.skip -= 1
            return
        if tag in ("td", "th") and self.cell is not None and self.row is not None:
            self.row.append(" ".join(" ".join(self.cell).split())[:250])
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row and len(self.rows) < MAX_ROWS:
                self.rows.append(self.row)
            self.row = None


def extract_exact_row_candidates(html: str, source_url: str, source_sha256: str) -> list[dict]:
    """Strict baseline: all attributes must occur together in the *same row*.

    No ranges, inherited page headings, generic 'suitable for', multiple
    grades/standards, or mixed row associations. The persisted verifier must
    independently validate page identity, hashes, rights and freshness.
    """
    if not re.fullmatch(r"[0-9a-f]{64}", source_sha256):
        return []
    rows = _Rows()
    rows.feed(html[:512_000])
    candidates = []
    seen = set()
    for row_index, cells in enumerate(rows.rows):
        line = " | ".join(cells)
        if not 10 <= len(line) <= 240:
            continue  # Only store a short, self-contained source locator.
        norms = set(x.group(0).upper().replace(" ", "").replace("-", "") for x in STANDARD.finditer(line))
        grades = set(x.group(0).upper() for x in GRADE.finditer(line))
        shapes = set(x.group(0).upper() for x in SHAPE.finditer(line))
        if len(norms) != 1 or len(grades) != 1 or len(shapes) != 1:
            continue
        if re.search(r"\b(?:not|non|excluded|escluso|not available|unavailable)\b", line, re.I):
            continue
        shape = next(iter(shapes))
        dims = DIM_CHS.findall(line) if shape == "CHS" else DIM_RHS.findall(line)
        if len(dims) != 1:
            continue
        numbers = tuple(float(x.replace(",", ".")) for x in dims[0])
        if any(x <= 0 for x in numbers):
            continue
        if shape == "SHS" and numbers[0] != numbers[1]:
            continue
        if shape == "RHS" and numbers[0] == numbers[1]:
            continue
        key = (next(iter(norms)), next(iter(grades)), shape, numbers)
        if key in seen:
            continue
        seen.add(key)
        candidates.append({
            "standard": key[0], "grade": key[1], "shape": shape,
            "dimensions_mm": list(numbers), "source_url": source_url,
            "source_sha256": source_sha256, "locator": f"table_row:{row_index + 1}",
            "evidence_status": "pending_verification",
            "source_row_excerpt": line,
            "interpretation": "same_row_explicit_candidate",
        })
        if len(candidates) >= 20:
            break
    return candidates
