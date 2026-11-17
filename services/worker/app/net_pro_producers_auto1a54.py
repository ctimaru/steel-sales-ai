"""AUTO1.A.5.4 — first-party technical-sheet *discovery* and HTML layout metrics.

Search-order hints and page layout labels are not technical evidence.
They cannot create exact tuple candidates, update leases, fetch PDFs, or
publish manufacturing capacity. Every URL still passes A3/A4 allowlisting
and every GET still passes the original DNS, robots, HTTPS and byte guards.
"""
from __future__ import annotations

import re

# Regexes deliberately target technical *navigation labels*, not data values.
TABLE_SHEET = re.compile(
    r"(?:tabell[ae][-/ _]?(?:dimensiona(?:l[ei])|misure|spessori)|"
    r"(?:dimension(?:al|s)?|size|section|wall[-_/ ]?thickness)[-_/ ]?(?:tables?|charts?)|"
    r"(?:tables?|charts?)[-_/ ]?(?:dimension(?:al|s)?|size|wall[-_/ ]?thickness)|"
    r"(?:scheda|schede)[-_/ ]?tecnic[aohe]|"
    r"technical[-_/ ]?(?:data|details?|specifications?|sheets?)|"
    r"datasheets?|specifiche[-_/ ]?tecniche)", re.I,
)
NORM = re.compile(r"(?:\bEN[-_/ ]?10(?:219|210)\b|\bEN10219\b|\bEN10210\b)", re.I)
SECTION = re.compile(
    r"(?:\b(?:RHS|SHS|CHS)\b|hollow[-_/ ]?sections?|"
    r"(?:tubi|tubes?|pipes?)[-_/ ]?struttural[ie]|structural[-_/ ]?(?:tubes?|pipes?|sections?))",
    re.I,
)
DIMENSION = re.compile(
    r"(?:dimension(?:al|s)?|spessori|thickness|misure|size[-_/ ]?range)", re.I,
)
LOW_RELEVANCE = re.compile(
    r"(?:elastomer|adhesiv|adesiv|composit|paladex|paladrain|"
    r"drainag|drenan|joints?|giunzion|creep)", re.I,
)
CORPORATE_SEGMENT = re.compile(
    r"(?:^|/)(?:azienda|chi-siamo|company|about-us|our-story|"
    r"careers?|lavora-con-noi|projects?|progetti|gallery|portfolio)(?:/|$)", re.I,
)
PDF_WRAPPER_SEGMENT = re.compile(r"(?:^|/)(?:download|downloads|allegati)(?:/|$)", re.I)

LAYOUT_CATEGORIES = frozenset({
    "technical_html_rows", "nontechnical_html_table",
    "pdf_links_no_html_table", "no_html_table_or_pdf_link",
})


def technical_sheet_hint(slug_and_label: str) -> bool:
    """Whether a navigation label explicitly suggests a dimensional HTML sheet."""
    return bool(TABLE_SHEET.search(slug_and_label) or NORM.search(slug_and_label))


def link_priority_bonus(url_path: str, label: str) -> int:
    """Bounded ranking only. Never influence HTTP rights or proof thresholds."""
    joined = url_path.replace("-", " ").replace("_", " ") + " " + label
    score = (
        17 * bool(TABLE_SHEET.search(joined))
        + 10 * bool(NORM.search(joined))
        + 6 * bool(SECTION.search(joined))
        + 2 * bool(DIMENSION.search(joined))
        - 19 * bool(LOW_RELEVANCE.search(joined))
        - 13 * bool(CORPORATE_SEGMENT.search(url_path))
        - 4 * bool(PDF_WRAPPER_SEGMENT.search(url_path))
    )
    return max(-40, min(40, score))


def classify_html_layout(diagnostic: dict, fingerprint: dict) -> str:
    """Describes detected HTML layout only, no claims or source excerpts."""
    if (not isinstance(diagnostic, dict)
            or diagnostic.get("contract") != "netproducers-auto1a5-diagnostic-v1"
            or not isinstance(fingerprint, dict)
            or fingerprint.get("contract") != "netproducers-auto1a53-row-fingerprint-v1"):
        raise ValueError("Missing source-local HTML diagnostic inputs")
    technical_rows = fingerprint.get("technical_rows")
    table_rows = diagnostic.get("table_rows")
    pdf_links = diagnostic.get("pdf_links")
    if (type(technical_rows) is not int or type(table_rows) is not int
            or type(pdf_links) is not int or technical_rows < 0 or table_rows < 0
            or pdf_links < 0 or technical_rows > table_rows):
        raise ValueError("Inconsistent A5.4 observed HTML layout counts")
    if technical_rows:
        return "technical_html_rows"
    if table_rows:
        return "nontechnical_html_table"
    if pdf_links:
        return "pdf_links_no_html_table"
    return "no_html_table_or_pdf_link"
