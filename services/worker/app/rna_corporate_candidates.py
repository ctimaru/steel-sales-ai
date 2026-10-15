"""CRAWL-IT6.6c — offline/one-shot RNA corporate-beneficiary candidate extraction.

Data owner: MIMIT Registro Nazionale Aiuti di Stato (RNA); see official open-data
license metadata and the site's personal data usage notice before any staging.
The XML aid-component NACE code is a *sourcing hint*, not evidence the
beneficiary's primary business or steel procurement is verified.

No Supabase writes, no company websites fetched, no individual contacts.
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import json
import re
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit

import httpx

OFFICIAL_INDEX = "https://www.rna.gov.it/open-data/aiuti"
URL_PATTERN = re.compile(
    r"^/sites/rna\.mise\.gov\.it/files/opendata/OpenData_Aiuti_20\d{2}_(?:0[1-9]|1[0-2])(?:_\d{3})?(?:\.xml)?$"
)
MAX_DOWNLOAD_BYTES = 180_000_000
MAX_OUTPUT_ROWS = 300
MAX_RECORDS_SCANNED = 2_000_000
# NACE Rev.2 wholesale metals (46.72); Rev.2.1 46.82.
TRADER_CODES = ("46.72", "46.82")
# These are only *potential* industrial users of steel products,
# NOT proven buyers; no automatic marketplace role materialization.
BUYER_CODES = ("25.11", "25.12", "25.62", "25.5", "28.", "29.", "30.")
LEGAL_FORM = re.compile(
    r"\b(?:S\.?R\.?L\.?|S\.?P\.?A\.?|S\.?N\.?C\.?|S\.?A\.?S\.?|"
    r"COOPERATIVA|SOC[IÌ]ET[AÀ]\s+COOPERATIVA|CONSORZIO|SOCIETA\s+CONSORTILE)\b",
    re.IGNORECASE,
)
TAX = re.compile(r"^[0-9]{11}$")
COR = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].upper()


def safe_rna_url(url: str) -> str:
    parts = urlsplit(url)
    if (parts.scheme != "https" or parts.hostname != "www.rna.gov.it" or
        parts.port not in (None, 443) or parts.username or parts.password or
        parts.query or parts.fragment or
        not URL_PATTERN.fullmatch(parts.path)):
        raise ValueError("Only exact official MIMIT RNA monthly XML URLs are allowed")
    return url


async def download_rna_xml(url: str, path: Path) -> int:
    safe_rna_url(url)
    # Bounded retries cover transient official-host connection failures.
    # Fail closed: never interpret an inaccessible source as zero candidates.
    for attempt in range(1, 4):
        total = 0
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(180.0, connect=30.0),
                follow_redirects=False,
            ) as client:
                async with client.stream(
                    "GET", url,
                    headers={"User-Agent": "SmartSteelSales-RNA-CorporatePreview/1.0 (hello@smartsteelsales.com)"},
                ) as response:
                    if response.status_code != 200:
                        raise RuntimeError(f"RNA official monthly XML returned HTTP {response.status_code}")
                    declared = response.headers.get("content-length")
                    if declared and int(declared) > MAX_DOWNLOAD_BYTES:
                        raise ValueError("RNA XML file above bounded 180MB budget")
                    with path.open("wb") as output:
                        async for part in response.aiter_bytes(chunk_size=65536):
                            total += len(part)
                            if total > MAX_DOWNLOAD_BYTES:
                                raise ValueError("RNA XML download exceeded bounded byte budget")
                            output.write(part)
            return total
        except (httpx.ConnectTimeout, httpx.ConnectError, httpx.ReadTimeout) as exc:
            if attempt == 3:
                raise RuntimeError(
                    "Official RNA host unreachable after 3 bounded attempts; "
                    "no candidates generated or database writes performed. "
                    "Check official dataset availability and URL."
                ) from exc
            print(f"RNA transient network failure on attempt {attempt}/3; retrying", flush=True)
            await asyncio.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def sector_roles(codes: list[str], target: str) -> tuple[str, str] | None:
    for code in codes:
        # Some fields have "C.25.11" or bare "25.11"; never search arbitrary text.
        value = code.strip().upper().replace("NACE:", "").replace(" ", "")
        value = re.sub(r"^[A-U][.]", "", value)
        if not re.fullmatch(r"[0-9]{2}(?:\.[0-9]{1,2}){0,2}", value):
            continue
        if target in ("trader", "both") and any(value == x or value.startswith(x + ".") for x in TRADER_CODES):
            return "trader_distributor", value
        if target in ("buyer", "both") and any(
            value == x.rstrip(".") or value.startswith(x) for x in BUYER_CODES
        ):
            return "end_user", value
    return None


def candidate_from_aiuto(element: ET.Element, target: str) -> dict[str, str] | None:
    direct = {local(child.tag): (child.text or "").strip() for child in element}
    name = direct.get("DENOMINAZIONE_BENEFICIARIO", "")
    tax = direct.get("CODICE_FISCALE_BENEFICIARIO", "")
    cor = direct.get("COR", "")
    if (not 3 <= len(name) <= 180 or
        not TAX.fullmatch(tax) or not COR.fullmatch(cor) or
        not LEGAL_FORM.search(name) or
        name[0] in "=+\-@" or any(x in name for x in "<>\n\r\t@")):
        return None
    codes = [child.text.strip() for child in element.iter()
             if local(child.tag) == "SETTORE_ATTIVITA" and child.text]
    proposal = sector_roles(codes, target)
    if not proposal:
        return None
    role, nace = proposal
    return {
        "company_name": name, "corporate_tax_id": tax, "role": role,
        # Preserve both the official aid ID and the actual NACE hint.
        "source_record_id": "RNA-" + cor + "-NACE-" + nace,
        "evidence_url": OFFICIAL_INDEX,
    }


def export_rna_candidates(
    input_file: Path, output_file: Path | None,
    target: str = "both", max_rows: int = 200,
) -> dict[str, object]:
    if target not in ("trader", "buyer", "both"):
        raise ValueError("Target must be trader, buyer or both")
    if not 1 <= max_rows <= MAX_OUTPUT_ROWS:
        raise ValueError("Candidate cap must be 1-300")
    if input_file.stat().st_size > MAX_DOWNLOAD_BYTES:
        raise ValueError("Unbounded input file rejected")
    # Never create a CSV from arbitrary HTML or error responses.
    with input_file.open("rb") as f:
        if b"<!DOCTYPE" in f.read(8192).upper():
            raise ValueError("RNA XML DTD rejected")
    counters = {"scanned": 0, "skipped": 0, "duplicate_tax": 0}
    selected: list[dict[str, str]] = []
    tax_ids: set[str] = set()
    context = ET.iterparse(input_file, events=("start", "end"))
    root = None
    for event, element in context:
        if root is None and event == "start":
            root = element
            if local(root.tag) != "LISTA_AIUTI":
                raise ValueError("Unexpected RNA XML root")
        if event != "end" or local(element.tag) != "AIUTO":
            continue
        counters["scanned"] += 1
        if counters["scanned"] > MAX_RECORDS_SCANNED:
            raise ValueError("RNA preview scanning budget exceeded")
        row = candidate_from_aiuto(element, target)
        if not row:
            counters["skipped"] += 1
        elif row["corporate_tax_id"] in tax_ids:
            counters["duplicate_tax"] += 1
        else:
            tax_ids.add(row["corporate_tax_id"])
            selected.append(row)
        element.clear()
        if root is not None:
            root.clear()
        if len(selected) >= max_rows:
            break
    if root is None:
        raise ValueError("Empty RNA XML")
    # Public GitHub repositories MUST NOT upload artifacts containing company IDs.
    # summary-only mode does not even materialize the CSV in the runner filesystem.
    if output_file is not None:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with output_file.open("w", encoding="utf-8-sig", newline="") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=[
                "company_name", "corporate_tax_id", "role", "source_record_id", "evidence_url"
            ])
            writer.writeheader()
            writer.writerows(selected)
    return {
        "source": "MIMIT_RNA_open_data_corporate_only",
        "mode": "OFFLINE_CSV_PREVIEW",
        "max_candidates": max_rows,
        "candidates": len(selected),
        "traders": sum(r["role"] == "trader_distributor" for r in selected),
        "potential_buyers": sum(r["role"] == "end_user" for r in selected),
        **counters,
        "proposed_not_verified": True,
        "supabase_writes": 0,
        "network_publications": 0,
        "personal_contacts": 0,
    }


async def run(args: argparse.Namespace) -> int:
    if args.summary_only and args.output:
        raise ValueError("A public summary cannot include CSV output")
    if not args.summary_only and not args.output:
        raise ValueError("Local CSV conversion requires an output path")
    output = None if args.summary_only else Path(args.output)
    if args.dataset_url:
        with tempfile.TemporaryDirectory(prefix="rna-preview-") as directory:
            input_file = Path(directory) / "official.xml"
            size = await download_rna_xml(args.dataset_url, input_file)
            report = export_rna_candidates(input_file, output, args.segment, args.limit)
            report["source_bytes"] = size
    else:
        if not args.input:
            raise ValueError("Provide --input or --dataset-url")
        report = export_rna_candidates(Path(args.input), output, args.segment, args.limit)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="MIMIT RNA corporate-only CSV candidate preview (zero database writes)")
    parser.add_argument("--input", help="Local official monthly RNA XML file")
    parser.add_argument("--dataset-url", help="Exact official RNA monthly XML download URL")
    parser.add_argument("--segment", choices=("trader", "buyer", "both"), default="both")
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--output", help="Private local CSV file; forbidden with --summary-only")
    parser.add_argument("--summary-only", action="store_true", help="Aggregate counts only, no CSV file or company identifiers")
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
