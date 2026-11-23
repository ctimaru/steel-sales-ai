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
_STOP_CHARS = "|•·©®™:;\"«»()[]{}<>\n\r\t?!"
_CONNECTORS = {"&", "e", "di", "de", "del", "della", "dei", "degli", "c.", "&c.", "f.lli", "fratelli"}
_LEADING_NOISE = {"copyright", "tutti", "i", "diritti", "riservati", "all", "rights", "reserved",
                  "l'azienda", "l’azienda",
                  "la", "il", "lo", "società", "societa", "azienda", "ditta", "ragione", "sociale"}
# Navigation, cookie/privacy and contact words: a ragione sociale never
# contains them, so the name stops there (footers flatten menus and privacy
# notices into the same line as the company name).
_BOILERPLATE = {
    "home", "homepage", "contatti", "contattaci", "contatto", "contact", "contacts",
    "news", "notizie", "blog", "chi", "siamo", "certificazioni", "prodotti", "products",
    "gallery", "galleria", "privacy", "policy", "cookie", "cookies", "gdpr",
    "informativa", "titolare", "trattamento", "dati", "utenti", "utente", "invia",
    "inviare", "messaggio", "politica", "parita", "parità", "genere", "menu", "cerca",
    "search", "login", "riservata", "lavora", "dove", "mappa", "sito", "newsletter",
    "iscriviti", "seguici", "follow", "facebook", "instagram", "linkedin", "youtube",
    "whatsapp", "telefono", "tel", "fax", "email", "e-mail", "mail", "pec", "indirizzo",
    "sede", "legale", "operativa", "capitale", "sociale", "registro", "imprese", "rea",
    "iva", "p.iva", "codice", "fiscale", "regolamento", "copyright", "diritti",
    "riservati", "rights", "reserved", "accetta", "accetto", "rifiuta", "impostazioni",
    "chiudi", "leggi", "scopri", "richiedi", "preventivo", "catalogo", "download", "faq",
    "approfondisci", "continua", "rivista", "contrada", "via", "viale",
    "zona", "artigianale", "industriale", "abruzzo", "lombardia", "piemonte",
    "veneto", "lazio", "toscana", "puglia", "calabria", "campania", "sicilia",
    "sardegna",
    "careers", "english", "italiano",
    # buttons and widgets flattened into the footer line
    "info", "pulsante", "button", "clicca", "click", "vai", "torna", "top",
    "apri", "chiudi", "invia", "scarica", "visita", "seguici", "condividi",
}

# GROWTH8: use the same fail-closed quality signals as AUTO3.
# These phrases arise when a CMS concatenates buttons, place names and
# addresses into a plausible-looking company name with a legal suffix.
# Never auto-replace such a string without separate first-party identity proof.
_GROWTH8_NOISE = re.compile(
    r"(?i)(?:^(?:continua|leggere\s+di\s+pi[uù]|rivista|dal\s+(?:19|20)\d{2})\b|"
    r"\b(?:zona\s+artigianale|zona\s+industriale|contrada|c\.?\s*da|"
    r"via\s+[A-Za-zÀ-ÿ]{3,}|viale\s+[A-Za-zÀ-ÿ]{3,})\b|"
    r"^(?:abruzzo|piemonte|lombardia|veneto|lazio|puglia|calabria|"
    r"campania|toscana|sicilia|sardegna)\s+(?:la|il|lo|le|i|gli)\s+)"
)


def legal_name_is_clean(name: str) -> bool:
    """Reject flattened UI/addresses, not genuine standalone legal company names.

    This is a conservative quality check, not an identity or rights grant.
    A rejected name can be replaced only with separately corroborated
    first-party evidence. Existing AUTO3 corporate/person restrictions apply.
    """
    value = " ".join(unescape(name or "").split())
    # MASS11C: country breadcrumbs and CTA labels flattened into a footer
    # must not be mistaken for the first word of a legal entity.
    return bool(
        3 <= len(value) <= 255
        and not re.match(r"(?i)^(?:read\s+more\b|italy\s+|"
                         r"copyright\s+(?:19|20)\d{2}\b)", value)
        and not _GROWTH8_NOISE.search(value)
        and not is_civic_snc_address(value)
        and not re.search(r"(?i)\b(?:contattaci|chiama\s+ora|scarica|"
                          r"clicca|visualizza|leggere\s+di\s+pi[uù])\b", value)
        and not re.search(r"(?i)\b(?:www\.|https?://|\.(?:it|com|eu|net)\b)", value)
    )


# AUTO2 identity_supported is not permission to publish. It must never mark a
# guessed legal name as identity_supported when the AUTO3 SQL quality gate
# would reject the name (e.g. a copyright year, site menu or agency credit).
# This is deliberately conservative: finding a *new* identity still requires
# full first-party corroboration in the reviewer and the SQL gate stays intact.
_PUBLISHER_NAME_WORDS = re.compile(
    r"(?i)(?<![A-Za-zÀ-ÿ])(?:"
    r"home|homepage|contatti|contattaci|news|privacy|cookie|cookies|gdpr|"
    r"titolare|trattamento|informativa|copyright|messaggio|politica|"
    r"ditta|azienda|località|localita|scegli|preventivi|preventivo|"
    r"fornirvi|qualità|qualita|benvenuti|telefono|tel|fax|email|pec|"
    r"sede|menu|info|pulsante|button|clicca|click|scarica|download|"
    r"vai|torna|responsabile"
    r")(?![A-Za-zÀ-ÿ])"
)
_PUBLISHER_PREFIX = re.compile(
    r"(?i)^(?:continua|leggere\s+di\s+pi[uù]|rivista|dal\s+(?:19|20)\d{2}|"
    r"dom\s+chiuso|immagini|images|fotografie|gallery|galleria|foto|"
    r"visualizza|installazione\s+servizio\s+gru|"
    r"chiama\s+ora|call\s+now|richiedi\s+(?:un\s+)?preventivo)\b"
)


def publisher_legal_name_is_clean(name: str) -> bool:
    """Fail closed on AUTO3-rejected CMS/SEO-contaminated names.

    This is a *preflight* shape check, never a substitute for the SQL
    publisher's more extensive legal identity, provenance and dedup guards.
    In particular, the first-party site must independently substantiate any
    corrected name; this function neither repairs strings nor raises confidence.
    """
    value = " ".join(unescape(name or "").split())
    if not legal_name_is_clean(value):
        return False
    form = _FORM.search(value)
    if not form:
        return False
    if not re.match(r"^(?:[A-ZÀ-ÖØ-Þ]|[0-9][A-ZÀ-ÖØ-Þ])", value):
        return False
    if re.match(r"^(?:19|20)\d{2}(?:[^A-Za-z0-9]|$)", value):
        return False
    # Reject legal names with *preceding UI labels*, while preserving a
    # genuine one-word brand with that spelling followed by a legal form.
    # A clean name requires independent site-body evidence in AUTO2 anyway.
    leading = value[:form.start()].strip()
    if (len(leading.split()) >= 2 and re.match(
        r"(?i)^(?:whistleblowing|entra|da\s+wikipedia)\b", leading
    )):
        return False
    if _PUBLISHER_PREFIX.search(value) or _PUBLISHER_NAME_WORDS.search(value):
        return False
    if re.search(r"(?i)\b(?:powered\s+by|web\s+agency|hosting\s+by)\b", value):
        return False
    if re.search(r"(?i)(?:^|\s)(?:zona\s+artigianale|zona\s+industriale|"
                 r"contrada|c\.?\s*da|via\s+[A-Za-zÀ-ÿ]{3,}|"
                 r"viale\s+[A-Za-zÀ-ÿ]{3,})(?:\s|$)", value):
        return False
    if re.search(r"(?i)^(?:abruzzo|piemonte|lombardia|veneto|lazio|"
                 r"puglia|calabria|campania|toscana|sicilia|sardegna)"
                 r"\s+(?:la|il|lo|le|i|gli)\s+", value):
        return False
    if (re.search(r"[?!]", value)
            or re.search(r"\d{3,}[ ./-]+\d{3,}", value)
            or re.search(r"[A-Za-zÀ-ÿ]{4,}\.\s", value)
            # "DI" is a lawful part of Italian legal names (e.g. partnership
            # surnames); reject geographic prose instead of the connector.
            or re.search(r"(?i)\b(?:in\s+)?provincia\s+di\b", value)):
        return False
    # AUTO3's SQL function only accepts at most six words before the form.
    if len(value[:form.start()].strip().split()) > MAX_NAME_WORDS:
        return False
    # A CMS may combine a headline with the same brand displayed twice:
    # "2M Carpenteria Metallica Treviso 2M S.n.c.". This is NOT evidence
    # for a newly invented full legal name and must remain a recovery case.
    leading_words = re.findall(r"[0-9A-Za-zÀ-ÿ]+", value[:form.start()])
    if (len(leading_words) >= 4 and len(leading_words[0]) >= 2
            and leading_words[0].casefold() == leading_words[-1].casefold()):
        return False
    return True


def _structured_legal_names(pages: list[dict[str, object]], domain: str,
                            first_guess: str, texts: list[str]) -> list[str]:
    """Trust only same-domain Organization.legalName corroborated in BODY text."""
    from urllib.parse import urlsplit

    legal_names: list[str] = []
    for root in pages[:20]:
        if not isinstance(root, dict):
            continue
        queue = [root]
        for _ in range(20):  # prevent unbounded nested @graph traversal
            if not queue:
                break
            node = queue.pop(0)
            if not isinstance(node, dict):
                continue
            for key in ("@graph",):
                nested = node.get(key)
                if isinstance(nested, list):
                    queue.extend(x for x in nested[:15] if isinstance(x, dict))
                elif isinstance(nested, dict):
                    queue.append(nested)
            types = node.get("@type", [])
            types = [types] if isinstance(types, str) else types
            if not isinstance(types, list) or not any(
                str(kind).casefold().split("/")[-1] in
                {"organization", "corporation", "localbusiness"}
                for kind in types
            ):
                continue
            name = node.get("legalName")
            if not isinstance(name, str) or not legal_name_is_clean(name):
                continue
            name = " ".join(unescape(name).split())
            if not _FORM.search(name):
                continue
            root_url = node.get("url")
            if root_url:
                if not isinstance(root_url, str):
                    continue
                parsed = urlsplit(root_url)
                if parsed.scheme != "https" or not parsed.hostname or (
                        parsed.hostname.casefold().removeprefix("www.")
                        != domain.casefold().removeprefix("www.")):
                    continue
            core = _FORM.sub("", name).strip(" ,.-")
            if not _related(core, domain, first_guess):
                continue
            # JSON-LD alone may describe a partner; corroborate the exact legal
            # name in the text of the same company's own fetched pages.
            normalized = " ".join(name.casefold().split())
            if not any(normalized in " ".join(unescape(t).casefold().split())
                       for t in texts):
                continue
            legal_names.append(name)
    return legal_names


# "SNC" is also "senza numero civico" in Italian addresses. A street is
# never sufficient first-party evidence of a società in nome collettivo.
_STREET_ADDRESS_SNC = re.compile(
    r"^\s*(?:c\.?\s*da|contrada|via|viale|piazza|corso|strada|localit[àa])\b"
    r".{1,80}\bs\.?\s*n\.?\s*c\.?\s*$", re.I
)

def is_civic_snc_address(name: str) -> bool:
    return bool(_STREET_ADDRESS_SNC.search(name.strip()))

MAX_NAME_WORDS = 6
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
    # Dotted acronym leading the domain, e.g. "M.G." on mg-srl.it.
    if re.fullmatch(r"(?:[A-Za-z]\.){2,}", core.replace(" ", "")) and label.startswith(core_c):
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
        # A footer copyright year or time is not part of the company's name.
        # An embedded numeral within an independent brand is NOT rewritten.
        if re.fullmatch(r"(?:19|20)[0-9]{2}(?:[-/](?:19|20)[0-9]{2})?", bare):
            break
        # After at least one genuine business token, the prior navigation
        # token is a boundary. Never strip "Italy S.r.l." or "More S.r.l."
        # when that token is itself the ENTIRE independently evidenced brand.
        if picked and bare.casefold().strip(",'’.") in {
            "italy", "read", "more",
            # MASS11G: footer menu / compliance links flattened ahead of
            # the independently named business. Do not ban a standalone
            # genuine company called "Entra S.r.l." or "Whistleblowing S.r.l.".
            "whistleblowing", "entra", "wikipedia",
        }:
            break
        if bare.casefold().strip("'’") in _BOILERPLATE or "/" in bare or "@" in bare:
            break
        # "Utenti. Titolare ..." — a word closing a previous sentence.
        # A province code ending an address (e.g. "Caronia ME.") is a
        # sentence boundary, never a prefix of the following legal entity.
        if picked and re.fullmatch(r"[A-Z]{2}\.", word):
            break
        if (picked and word.endswith(".") and "." not in bare
                and len(bare) >= 5 and bare.isalpha()):
            break
        if (low in _CONNECTORS or bare[0].isupper() or bare[0].isdigit()
                or bare.isupper() or (not picked and bare[0].islower()
                and len(bare) >= 3 and bare.casefold() not in _BOILERPLATE)):
            picked.append(word)
            if len(picked) >= 8:
                break
            continue
        break
    picked.reverse()
    # Flattened calls to action: "CONTATTACI ORA VITAL SRL" names Vital,
    # not "ORA VITAL". Only trim ORA with an adjacent CTA, never a brand ORA.
    if len(picked) >= 2 and picked[0].casefold().strip(",.") == "ora":
        before_ora = text.rfind(picked[0], max(0, form_start - 120), form_start)
        if before_ora >= 0 and re.search(
                r"\b(?:contattaci|chiama|richiedi|contact)\s*$",
                text[max(0, before_ora - 50):before_ora], re.I):
            picked.pop(0)
    # Flattened CMS footers can prepend UI controls immediately before the
    # genuine legal entity. Do not mistake "Immagini Coltro Srl" or
    # "Dom Chiuso IN.BRO.FER S.R.L." for a corporate name. Only discard a
    # complete leading UI token sequence when a separate name remains.
    while len(picked) >= 2:
        head = picked[0].casefold().strip(",.")
        second = picked[1].casefold().strip(",.")
        if len(picked) >= 3 and head == "dom" and second == "chiuso":
            del picked[:2]
        elif head in {"credit", "credits"}:
            picked.pop(0)
        elif head in {"immagini", "images", "fotografie", "gallery",
                      "galleria", "foto", "visualizza"}:
            picked.pop(0)
        else:
            break
    while picked and (picked[0].casefold() in _CONNECTORS
                      or picked[0].casefold().strip(",.") in _LEADING_NOISE
                      or picked[0].strip(",.").isdigit()):
        picked.pop(0)
    while picked and picked[-1].casefold() in {"&", "e", "di"}:
        picked.pop()
    if not picked or len(picked) > MAX_NAME_WORDS:
        return None
    core = " ".join(picked).strip(" ,-–")
    if core.endswith(".") and not re.fullmatch(r"(?:[A-Z]\.){2,}", core):
        core = core[:-1]
    if core[:1].islower():
        core = core[0].upper() + core[1:]
    if not re.search(r"[A-Za-zÀ-ÿ]", core) or len(core) > 200:
        return None
    start = text.rfind(picked[0], max(0, form_start - 200), form_start)
    return core, max(0, start)


def find_company_identity(page_texts: list[str], domain: str,
                          first_guess: str,
                          structured_data: list[dict[str, object]] | None = None
                          ) -> CompanyIdentity | None:
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
            if is_civic_snc_address(f"{core} {match.group(1).strip()}"):
                continue
            credit_context = text[max(0, core_start - 40):core_start]
            # 'Credits' as a standalone navigation label is not the name.
            # 'Credits by Pixel ...' is still third-party agency attribution.
            if (_CREDIT_CUES.search(credit_context)
                    and not re.search(r"\bcredits?\s*$", credit_context, re.I)):
                continue
            if not _related(core, domain, first_guess):
                continue
            context = text[max(0, core_start - 150):match.end() + 150]
            score = 1 + (3 if _IDENTITY_CUES.search(context) else 0)
            vat = _VAT_AFTER.search(text[match.end():match.end() + 200])
            name = f"{core} {match.group(1).strip()}"
            if not legal_name_is_clean(name):
                continue
            key = _compact(name)
            previous = totals.get(key)
            if previous:
                totals[key] = CompanyIdentity(previous.legal_name, previous.vat_id or
                                              (vat.group(1) if vat else None),
                                              previous.score + score)
            else:
                totals[key] = CompanyIdentity(name, vat.group(1) if vat else None, score)
    # Explicit legalName from same-site JSON-LD outranks noisy text extraction,
    # but only when the official BODY also corroborates the same full name.
    for name in _structured_legal_names(structured_data or [], domain,
                                        first_guess, page_texts):
        key = _compact(name)
        previous = totals.get(key)
        totals[key] = CompanyIdentity(name, previous.vat_id if previous else None,
                                      (previous.score if previous else 0) + 8)
    if not totals:
        return None
    # Equal first-party evidence must not reward an accidentally longer
    # concatenation of a page heading and the actual corporate name.
    best = max(totals.values(), key=lambda i: (i.score, -len(i.legal_name)))
    return best
