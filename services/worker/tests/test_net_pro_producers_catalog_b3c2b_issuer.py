"""B3.C2.B: source and rights verification never infers manufacturer capability."""
from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path
import socket
from uuid import uuid4

import pytest

from app import net_pro_producers_catalog_b3c2b_issuer as issuer
from app.net_pro_producers_catalog_b3c_queue import IntakeFailure

ROOT = Path(__file__).resolve().parents[3]
SQL = (
    ROOT / "supabase/migrations" /
    "20261118170000_net_pro_producers_b3c2b_verified_firstparty_issuer.sql"
).read_text()
COMPANY, CATALOG, TOKEN = (str(uuid4()) for _ in range(3))
CONTENT = b"%PDF-1.4\ncatalogue first-party signed bytes\n"
SHA = hashlib.sha256(CONTENT).hexdigest()


def submission():
    return {
        "company_id": COMPANY,
        "catalog_id": CATALOG,
        "lease_token": TOKEN,
        "sha256": SHA,
        "source_url": "https://www.example-manufacturer.it/download/catalogue.pdf",
        "object_path": f"{COMPANY}/{CATALOG}/{SHA}.pdf",
        "format": "pdf",
    }


class DB:
    def __init__(self, items):
        self.items = items
        self.events = []
        self.last_failure = None

    def rpc(self, name, args):
        assert name == issuer.RPC
        operation = args["p_operation"]
        payload = args["p_payload"]
        self.events.append(operation)
        if operation == "claim":
            assert 1 <= payload["limit"] <= 3
            data = {
                "contract": issuer.CONTRACT, "status": "claimed",
                "count": len(self.items), "items": self.items,
            }
        elif operation == "accept":
            assert payload["source_sha256"] == SHA
            assert payload["catalog_id"] == CATALOG
            assert payload["lease_token"] == TOKEN
            data = {
                "contract": issuer.CONTRACT,
                "status": "issued_and_enqueued", "published_claims": 0,
            }
        elif operation == "reject":
            self.last_failure = payload["error_code"]
            data = {
                "contract": issuer.CONTRACT,
                "status": "failure_recorded", "published_claims": 0,
            }
        else:
            raise AssertionError(operation)

        class Result:
            def execute(self):
                self.data = data
                return self
        return Result()


def test_empty_queue_issues_zero_rights():
    db = DB([])
    report = asyncio.run(issuer.verify_pending_catalogues(db))
    assert report["eligible_leased"] == report["verified_licensed_and_enqueued"] == 0
    assert report["manufacturer_confirmed"] == report["published_claims"] == 0
    assert db.events == ["claim"]


def test_same_verified_private_and_official_sha_issues_rights(monkeypatch):
    db = DB([submission()])

    async def fake_private(lease):
        assert lease["sha256"] == SHA
        assert lease["object_path"].endswith("/" + SHA + ".pdf")
        return CONTENT

    def fake_official(url, fmt):
        assert url.startswith("https://www.example-manufacturer.it/")
        assert fmt == "pdf"
        return CONTENT

    monkeypatch.setattr(issuer, "_download_private_catalogue", fake_private)
    monkeypatch.setattr(issuer, "_read_pinned_firstparty_bytes", fake_official)
    report = asyncio.run(issuer.verify_pending_catalogues(db, limit=1))
    assert report["eligible_leased"] == report["verified_licensed_and_enqueued"] == 1
    assert report["published_claims"] == 0
    assert db.events == ["claim", "accept"]


def test_official_document_different_bytes_never_issues_rights(monkeypatch):
    db = DB([submission()])

    async def private(_):
        return CONTENT

    def official(*_):
        return b"%PDF-1.4\nDIFFERENT"

    monkeypatch.setattr(issuer, "_download_private_catalogue", private)
    monkeypatch.setattr(issuer, "_read_pinned_firstparty_bytes", official)
    report = asyncio.run(issuer.verify_pending_catalogues(db))
    assert report["verified_licensed_and_enqueued"] == 0
    assert report["deferred_or_review"] == 1
    assert db.last_failure == "hash_mismatch"
    assert db.events == ["claim", "reject"]


def test_corrupt_private_pdf_blocks_registration(monkeypatch):
    db = DB([submission()])
    async def broken(_):
        raise IntakeFailure("size_or_digest")
    monkeypatch.setattr(issuer, "_download_private_catalogue", broken)
    report = asyncio.run(issuer.verify_pending_catalogues(db))
    assert report["verified_licensed_and_enqueued"] == 0
    assert db.last_failure == "hash_mismatch"


@pytest.mark.parametrize("url", [
    "http://www.example-manufacturer.it/catalogue.pdf",
    "https://127.0.0.1/catalogue.pdf",
    "https://169.254.169.254/catalogue.pdf",
    "https://localhost/catalogue.pdf",
    "https://user:pass@company.it/catalogue.pdf",
    "https://company.it:8443/catalogue.pdf",
    "https://company.it/catalogue.pdf#fragment",
    "https://company.it/\nHost: x",
    "https://company.it",
])
def test_untrusted_source_urls_rejected_before_network(url):
    if url == "https://company.it":
        # No document path: SQL blocks this at source_url intake.
        assert issuer._verified_source_url(url)[1] == "/"
    else:
        with pytest.raises(issuer.VerifiedIssuerError, match="unsafe_source"):
            issuer._verified_source_url(url)


def test_private_and_mixed_dns_addresses_cannot_be_contacted(monkeypatch):
    def fake_dns(*args, **kwargs):
        assert args[:2] == ("www.example-manufacturer.it", 443)
        return [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "",
             ("8.8.8.8", 443)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "",
             ("10.0.0.3", 443)),
        ]
    monkeypatch.setattr(issuer.socket, "getaddrinfo", fake_dns)
    with pytest.raises(issuer.VerifiedIssuerError, match="unsafe_source"):
        issuer._resolve_public_ip("www.example-manufacturer.it")


def test_public_dns_resolution_pins_first_global_address(monkeypatch):
    def good_dns(*_, **__):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "",
                 ("8.8.8.8", 443))]
    monkeypatch.setattr(issuer.socket, "getaddrinfo", good_dns)
    assert issuer._resolve_public_ip("www.example-manufacturer.it") == "8.8.8.8"


@pytest.mark.parametrize("key,bad", [
    ("lease_token", "invalid"),
    ("sha256", "abcd"),
    ("object_path", "../other_organization/file.pdf"),
    ("format", "exe"),
    ("source_url", 11),
])
def test_remote_lease_must_be_exact_identity(key, bad):
    entry = submission()
    entry[key] = bad
    with pytest.raises(issuer.VerifiedIssuerError, match="unexpected"):
        issuer._submission(entry)


def test_private_issuer_database_contract_and_rights_provenance():
    for token in (
        "private.network_producer_catalog_submissions",
        "cl.status='approved'",
        "cl.proof_status='verified'",
        "cl.proof_verified_at is not null",
        "m.user_id=s.submitted_by",
        "m.role='admin'",
        "m.status='active'",
        "s.uploaded_at is not null",
        "state='verifying'",
        "for update of s skip locked",
        "verification_lease_token",
        "private.netproducers1_b2_catalog('register'",
        "private.netproducers1_b3c_catalog_queue('enqueue'",
        "verified_company_authorization",
        "source_match_sha256",
        "granted_and_enqueued",
        "source_match','exact_same_bytes'",
        "netproducers1_b3c2b_clear_lease_on_withdraw",
        "enable row level security",
        "to service_role",
        "published_claims',0",
    ):
        assert token in SQL, token
    assert "grant execute on function public.netproducers1_b3c2b_verified_issuer(text,jsonb)\n  to authenticated" not in SQL
    assert "insert into public.network_producer_" not in SQL.lower()


def test_issuer_is_opt_in_before_c1_existing_cron():
    entry = (ROOT / "services/worker/app/net_pro_producers_auto1.py").read_text()
    assert 'NETPRODUCERS_B3C2_ISSUER_ENABLED' in entry
    assert entry.index("verify_pending_catalogues(db, limit=2)") < (
        entry.index("drain_authorised_catalogues(db, limit=2)")
    )
    assert "if args.persist and os.getenv" in entry
