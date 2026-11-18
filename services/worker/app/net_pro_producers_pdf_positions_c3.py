"""Bounded PDF text geometry input for C3 candidate extraction.

The visitor captures actual page-local text origins (not layout whitespace).
Coordinates are *candidate evidence only*: a PDF origin does not establish
column widths or a manufacturer SKU. No network, file paths or DB writes.
"""
from __future__ import annotations

import json
import math
import subprocess
import sys

from .net_pro_producers_catalog_b1 import CatalogueRejected

CHILD = r"""
import io,json,resource,sys,math
resource.setrlimit(resource.RLIMIT_AS,(512*1024*1024,512*1024*1024))
resource.setrlimit(resource.RLIMIT_CPU,(5,5))
content=sys.stdin.buffer.read(8*1024*1024+1)
if not content.startswith(b'%PDF-') or len(content)>8*1024*1024: raise ValueError('invalid_pdf')
from pypdf import PdfReader
reader=PdfReader(io.BytesIO(content),strict=True)
if reader.is_encrypted or not 1 <= len(reader.pages) <= 15: raise ValueError('invalid_pages')
pages=[]
for page_number,page in enumerate(reader.pages,1):
    spans=[]
    def visitor(text,cm,tm,font_dict,font_size):
        if not text or len(spans)>=3000:return
        if len(text)>120:return
        # PDF text matrix applies text-origin; transformation complexity is
        # deliberately not interpreted as verified physical table geometry.
        x,y=tm[4],tm[5]
        if not all(isinstance(v,(float,int)) and math.isfinite(v) for v in (x,y,font_size)):return
        if not (0<=x<=10000 and 0<=y<=10000 and 0<float(font_size)<=150):return
        stripped=' '.join(text.strip().split())
        if stripped and len(stripped)<=80:
            spans.append({'x':round(x,3),'y':round(y,3),'size':round(float(font_size),3),'text':stripped})
    if '/Contents' in page:page.extract_text(visitor_text=visitor)
    if len(spans)>2500:raise ValueError('too_many_spans')
    pages.append({'page':page_number,'spans':spans})
sys.stdout.write(json.dumps({'pages':pages},ensure_ascii=True))
"""


def read_pdf_text_origins(content: bytes) -> list[dict]:
    """Return bounded raw positions for later independently verified layout.

    Never treat fragment widths inferred from fontsize as exact cell borders.
    """
    if not isinstance(content, bytes) or not 0 < len(content) <= 8 * 1024 * 1024:
        raise CatalogueRejected("C3 PDF size rejected")
    if not content.startswith(b"%PDF-"):
        raise CatalogueRejected("C3 invalid PDF signature")
    try:
        completed = subprocess.run(
            [sys.executable, "-I", "-c", CHILD], input=content,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            check=False, timeout=9,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise CatalogueRejected("C3 isolated position extractor unavailable") from exc
    if completed.returncode or len(completed.stdout) > 600_000:
        raise CatalogueRejected("C3 isolated position extractor rejected PDF")
    try:
        result = json.loads(completed.stdout)
    except (ValueError, UnicodeDecodeError) as exc:
        raise CatalogueRejected("C3 invalid position extraction") from exc
    pages = result.get("pages") if isinstance(result, dict) else None
    if not isinstance(pages, list) or not 1 <= len(pages) <= 15:
        raise CatalogueRejected("C3 invalid page list")
    for num, page in enumerate(pages, 1):
        if not isinstance(page, dict) or page.get("page") != num:
            raise CatalogueRejected("C3 invalid position page")
        spans = page.get("spans")
        if not isinstance(spans, list) or len(spans) > 2500:
            raise CatalogueRejected("C3 position span limit")
        for span in spans:
            if not isinstance(span, dict) or not isinstance(span.get("text"), str):
                raise CatalogueRejected("C3 invalid text span")
            if not 0 < len(span["text"]) <= 80:
                raise CatalogueRejected("C3 invalid span length")
            for key in ("x", "y", "size"):
                value = span.get(key)
                if type(value) not in (int, float) or not math.isfinite(value):
                    raise CatalogueRejected("C3 invalid coordinate")
                if not 0 <= value <= 10000:
                    raise CatalogueRejected("C3 position outside bounds")
    return pages


def position_diagnostics(pages: list[dict]) -> dict:
    """Compact geometry metrics only: no raw text persistence or claims."""
    total = sum(len(page["spans"]) for page in pages)
    return {
        "contract": "netproducers-c3-position-observation-v1",
        "pages": len(pages),
        "text_spans": total,
        "has_positioned_text": total > 0,
        "dimension_thickness_pairs_verified": 0,
        "producer_skus_confirmed": 0,
    }
