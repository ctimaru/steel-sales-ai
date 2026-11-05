"""NET-GROWTH3.G: archive an actual 50-company source-first, unverified cohort."""
from pathlib import Path
from urllib.parse import urlparse
import json


DATA=Path(__file__).resolve().parents[1]/"data"/"netgrowth3g_online_first_20261105.json"


def test_50_unique_business_sources_in_staged_cohort():
    doc=json.loads(DATA.read_text(encoding="utf-8"))
    rows=doc["records"]
    assert len(rows)==50
    assert len({r["domain"] for r in rows})==50
    assert sum(r["proposed_role"]=="producer" for r in rows)==9
    assert sum(r["proposed_role"]=="processor_service_provider" for r in rows)==41
    assert doc["production_staging_batch"]=="NET-GROWTH3D-ONLINE-20261105-A"
    assert all(urlparse(r["source_url"]).scheme=="https" for r in rows)
    assert all((urlparse(r["source_url"]).hostname or "").removeprefix("www.")==r["domain"] for r in rows)


def test_no_claimed_verified_or_stock_conclusions():
    doc=json.loads(DATA.read_text(encoding="utf-8"))
    assert all(not r["claimed"] and not r["verified"] for r in doc["records"])
    assert all(r["intake_status"]=="needs_review" for r in doc["records"])
    assert doc["profile_flags"]["claimed_status"]=="unclaimed"
    assert doc["profile_flags"]["verification_status"]=="unverified"
    assert doc["profile_flags"]["discovery_status"]=="unconfirmed"
    assert not doc["privacy_constraints"]["stock_or_prices_inferred"]
    assert not doc["privacy_constraints"]["logos_or_images_copied"]


def test_brand_aliases_and_weaker_tube_claims_are_out_of_this_batch():
    doc=json.loads(DATA.read_text(encoding="utf-8"))
    domains={r["domain"] for r in doc["records"]}
    assert not domains.intersection({
        "tcbtubi.it","lasermec.it","envasald.com",
        "emmeerreinox.it","t-erre.it","fabbroferro.it",
        "dematubi.it","gromet.it"
    })
    assert {"acciaioted.com","mep-snc.com","nobilcut.it",
            "tubisolution.com","oemmevisrl.it","lasersid.it",
            "crtubi.com","carpenteriadanasi.it"}.issubset(domains)
