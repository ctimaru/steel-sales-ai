from __future__ import annotations

import pytest

from app.company_discovery import (
    CrawledPage,
    CompanyDiscoveryError,
    canonicalize_seed_url,
    classify_company,
    extract_candidate,
)


def test_discovery_blocks_non_public_seed_targets() -> None:
    for url in (
        "http://127.0.0.1/admin",
        "http://10.0.0.3/",
        "http://169.254.169.254/latest/meta-data/",
        "ftp://example.com/file",
        "https://user:password@example.com/",
        "https://example.com:8080/",
    ):
        with pytest.raises(CompanyDiscoveryError):
            canonicalize_seed_url(url)


def test_discovery_normalizes_public_seed_url() -> None:
    assert canonicalize_seed_url("HTTPS://WWW.EXAMPLE.COM/about#team") == (
        "https://www.example.com/about"
    )


def test_classifier_keeps_multi_role_tube_company() -> None:
    roles, subtypes, products = classify_company(
        """
        Siamo produttori di tubi saldati in acciaio.
        Ampio stock e distribuzione con pronta consegna.
        Il nostro centro servizi esegue taglio laser, piegatura e saldatura.
        Produzione di tubi quadri e rettangolari.
        """
    )
    assert roles == ["producer", "trader_distributor", "processor_service_provider"]
    assert "tube_pipe_producer" in subtypes
    assert "stockholder" in subtypes
    assert "steel_service_center" in subtypes
    assert "cutting_specialist" in subtypes
    assert "fabricator" in subtypes
    assert {"key": "tubes_pipes", "relationship_type": "produces"} in products
    assert {"key": "tubes_pipes", "relationship_type": "distributes"} in products
    assert {"key": "tubes_pipes", "relationship_type": "processes"} in products
    assert {"key": "hollow_sections", "relationship_type": "produces"} in products


def test_extract_candidate_requires_tube_evidence_and_preserves_sources() -> None:
    pages = [
        CrawledPage(
            url="https://example-tubi.it/",
            title="Example Tubi S.r.l. | Tubi in acciaio",
            site_name="Example Tubi",
            meta_description="Produzione e lavorazione di tubi in acciaio.",
            h1="Example Tubi",
            text=(
                "Example Tubi S.r.l. P. IVA 01234567890. "
                "Produzione di tubi saldati e tubi rettangolari. "
                "Taglio laser e lavorazione tubo."
            ),
            links=(),
        ),
        CrawledPage(
            url="https://example-tubi.it/prodotti",
            title="Prodotti",
            site_name=None,
            meta_description=None,
            h1="Tubi",
            text="Tubi in acciaio, hollow section, lavorazioni e produzione.",
            links=(),
        ),
    ]

    candidate = extract_candidate(pages, "IT")
    assert candidate is not None
    assert candidate["canonical_domain"] == "example-tubi.it"
    assert candidate["legal_name"].lower().endswith("s.r.l")
    assert candidate["vat_id"] == "01234567890"
    assert candidate["country_code"] == "IT"
    assert "producer" in candidate["role_keys"]
    assert "processor_service_provider" in candidate["role_keys"]
    assert len(candidate["evidence"]) == 2
    assert candidate["source_urls"] == [
        "https://example-tubi.it/",
        "https://example-tubi.it/prodotti",
    ]


def test_extract_candidate_skips_non_tube_company() -> None:
    pages = [
        CrawledPage(
            url="https://generic-industria.it/",
            title="Generic Industria",
            site_name="Generic Industria",
            meta_description="Automazione industriale.",
            h1="Generic Industria",
            text="Automazione industriale e software per fabbriche.",
            links=(),
        )
    ]
    assert extract_candidate(pages, "IT") is None
