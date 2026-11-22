"""Read-only diagnostics of a strictly validated official RNA monthly XML URL.

No full XML transfer, no company data, no Supabase credentials.
"""
from __future__ import annotations

import argparse
import json
import socket
import ssl
import urllib.error
import urllib.request
from urllib.parse import urlsplit

from app.rna_corporate_candidates import safe_rna_url


def run(url: str) -> dict[str, object]:
    safe_rna_url(url)
    host = urlsplit(url).hostname
    assert host == "www.rna.gov.it"
    result: dict[str, object] = {
        "source": "MIMIT_RNA_monthly_XML",
        "mode": "READ_ONLY_SOURCE_DIAGNOSTICS",
        "url": url,
        "dns": "not_checked",
        "tcp_443": "not_checked",
        "https": "not_checked",
        "http_status": None,
        "xml_downloaded": False,
        "supabase_writes": 0,
        "network_publications": 0,
    }
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        result["dns"] = "ok" if infos else "empty"
    except OSError as exc:
        result["dns"] = type(exc).__name__
        return result

    try:
        with socket.create_connection((host, 443), timeout=8):
            result["tcp_443"] = "ok"
    except OSError as exc:
        result["tcp_443"] = type(exc).__name__
        return result

    # HEAD performs no body download; redirects are not automatically followed,
    # so unexpected redirects remain visible rather than reaching another host.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
        NoRedirect(),
    )
    request = urllib.request.Request(
        url,
        method="HEAD",
        headers={"User-Agent": "SmartSteelSales-RNA-SourceDiagnostics/1.0"},
    )
    try:
        with opener.open(request, timeout=12) as response:
            result["https"] = "ok"
            result["http_status"] = response.status
            result["content_type"] = response.headers.get("Content-Type", "")
            result["content_length"] = response.headers.get("Content-Length", "")
    except urllib.error.HTTPError as exc:
        result["https"] = "http_error"
        result["http_status"] = exc.code
    except (OSError, ValueError) as exc:
        result["https"] = type(exc).__name__
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="RNA DNS/TCP/HTTPS/HEAD diagnostics without body download")
    parser.add_argument("--dataset-url", required=True)
    args = parser.parse_args()
    report = run(args.dataset_url)
    print(json.dumps(report, indent=2, sort_keys=True))
    # Diagnostic intentionally succeeds if a host is unreachable:
    # availability is a result, not an infrastructure exception.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
