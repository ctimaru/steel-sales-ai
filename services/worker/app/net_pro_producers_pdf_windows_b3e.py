"""B3.E page-window PDF reader for factual observation only.

Every 15-page window is parsed in an isolated subprocess. No PDF is written
to disk or served to users. Absolute source-page numbers survive windowing.
The entire document is limited to 60 pages / 8 MiB and each subprocess has
independent CPU, memory, runtime and output limits.
"""
from __future__ import annotations

import json
import math
import subprocess
import sys

from .net_pro_producers_catalog_b1 import CatalogueRejected

MAX_BYTES = 8 * 1024 * 1024
MAX_TOTAL_PAGES = 60
WINDOW_PAGES = 15
MAX_OUTPUT = 900_000

_CHILD = r"""
import io,json,math,resource,sys
from pypdf import PdfReader,mult

resource.setrlimit(resource.RLIMIT_AS,(512*1024*1024,512*1024*1024))
resource.setrlimit(resource.RLIMIT_CPU,(5,5))
offset=sys.stdin.buffer.read(3)
if len(offset)!=3 or not offset.isdigit(): raise ValueError('window')
start=int(offset)
data=sys.stdin.buffer.read(8*1024*1024+1)
if not 0<len(data)<=8*1024*1024 or not data.startswith(b'%PDF-'): raise ValueError('pdf')
reader=PdfReader(io.BytesIO(data),strict=True)
total=len(reader.pages)
if reader.is_encrypted or not 1<=total<=60 or not 1<=start<=total:
    raise ValueError('pages')
end=min(start+15,total+1)
pages=[]
positions=[]
total_chars=0
for number in range(start,end):
    page=reader.pages[number-1]
    lines=[]
    spans=[]
    if '/Contents' in page:
        text=page.extract_text(extraction_mode='layout') or ''
        if not isinstance(text,str) or len(text)>20000: raise ValueError('page_chars')
        total_chars+=len(text)
        if total_chars>150000: raise ValueError('window_chars')
        lines=text.splitlines()
        if len(lines)>500: raise ValueError('lines')
        def visitor(text,cm,tm,font_dict,font_size):
            if not isinstance(text,str) or not text or len(text)>120 or len(spans)>2500:
                return
            m=mult(tm,cm)
            if not all(isinstance(v,(float,int)) and math.isfinite(v) for v in m):
                return
            if abs(m[1])>1e-5 or abs(m[2])>1e-5:
                return
            x,y=m[4],m[5]
            if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in (x,y,font_size)):
                return
            if not (0<=x<=10000 and 0<=y<=10000 and 0<float(font_size)<=150):
                return
            clean=' '.join(text.strip().split())
            if clean and len(clean)<=80:
                spans.append({'x':round(x,3),'y':round(y,3),
                              'size':round(float(font_size),3),'text':clean})
        page.extract_text(visitor_text=visitor)
        if len(spans)>2500: raise ValueError('spans')
    pages.append({'page':number,'lines':lines})
    positions.append({'page':number,'spans':spans})
sys.stdout.write(json.dumps({'total_pages':total,'pages':pages,
                             'positions':positions},ensure_ascii=True))
"""


def read_pdf_fact_window(content: bytes, *, start_page: int = 1) -> dict:
    """One bounded source window with absolute page locators and page total."""
    if (type(start_page) is not int or not 1 <= start_page <= MAX_TOTAL_PAGES
            or not isinstance(content, bytes) or not 0 < len(content) <= MAX_BYTES
            or not content.startswith(b"%PDF-")):
        raise CatalogueRejected("B3.E invalid PDF window request")
    try:
        completed = subprocess.run(
            [sys.executable, "-I", "-c", _CHILD],
            input=f"{start_page:03d}".encode("ascii") + content,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            timeout=11, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise CatalogueRejected("B3.E isolated PDF window unavailable") from exc
    if completed.returncode or len(completed.stdout) > MAX_OUTPUT:
        raise CatalogueRejected("B3.E PDF window rejected")
    try:
        result = json.loads(completed.stdout)
    except (ValueError, UnicodeError) as exc:
        raise CatalogueRejected("B3.E invalid PDF window result") from exc
    if not isinstance(result, dict):
        raise CatalogueRejected("B3.E invalid PDF window structure")
    total = result.get("total_pages")
    pages = result.get("pages")
    positions = result.get("positions")
    if (type(total) is not int or not 1 <= total <= MAX_TOTAL_PAGES
            or start_page > total or not isinstance(pages, list)
            or not isinstance(positions, list)):
        raise CatalogueRejected("B3.E PDF page count invalid")
    required = min(WINDOW_PAGES, total - start_page + 1)
    if len(pages) != required or len(positions) != required:
        raise CatalogueRejected("B3.E PDF window length mismatch")
    for offset, (page, positioned) in enumerate(zip(pages, positions)):
        number = start_page + offset
        if (not isinstance(page, dict) or page.get("page") != number
                or not isinstance(positioned, dict) or positioned.get("page") != number):
            raise CatalogueRejected("B3.E PDF source page mismatch")
        lines, spans = page.get("lines"), positioned.get("spans")
        if (not isinstance(lines, list) or len(lines) > 500
                or any(not isinstance(line, str) or len(line) > 20000 for line in lines)
                or not isinstance(spans, list) or len(spans) > 2500):
            raise CatalogueRejected("B3.E PDF content bounds exceeded")
        for span in spans:
            if (not isinstance(span, dict)
                    or not isinstance(span.get("text"), str)
                    or not 0 < len(span["text"]) <= 80):
                raise CatalogueRejected("B3.E invalid positioned text")
            for key in ("x", "y", "size"):
                value = span.get(key)
                if type(value) not in (int, float) or not math.isfinite(value):
                    raise CatalogueRejected("B3.E invalid coordinate")
                if not 0 <= value <= 10000:
                    raise CatalogueRejected("B3.E coordinate outside bounds")
    return result
