"""Evidence of a real unclaimed/nonverified 50-company online-first import."""
import json
from pathlib import Path
from urllib.parse import urlparse


FILE = Path(__file__).resolve().parents[1] / "data" / "netgrowth3g1_online_first_batch_b_20261105.json"


def load():
    return json.loads(FILE.read_text(encoding="utf-8"))


def test_50_new_source_backed_business_profiles():
    x = load()
    rows=x["records"]
    assert x["intake_batch"] == "NET-GROWTH3D-ONLINE-20261105-B"
    assert len(rows) == 50
    assert len({r["domain"] for r in rows}) == 50
    assert sum(r["proposed_role"] == "producer" for r in rows) == 1
    assert sum(r["proposed_role"] == "processor_service_provider" for r in rows) == 49
    assert all(r["intake_status"] == "needs_review" for r in rows)
    assert all(urlparse(r["source_url"]).scheme == "https" for r in rows)
    assert all((urlparse(r["source_url"]).hostname or "").removeprefix("www.") == r["domain"] for r in rows)


def test_unclaimed_and_no_fabricated_supplier_trust():
    x = load()
    assert x["counts"]["provisional_after"] == 508
    assert x["counts"]["directory_backing_total_after"] == 786
    assert not x["presentation"]["canonical_publication"]
    assert not x["compliance"]["mandatory_company_visura"]
    assert not x["compliance"]["personal_contacts"]
    assert not x["compliance"]["source_copy_long_text"]
    assert not x["compliance"]["photos_logos"]
    assert all(not r["claimed"] and not r["verified"] and not r["stock_known"] for r in x["records"])


def test_an_existing_domain_cannot_be_present_in_a_new_batch():
    first=Path(__file__).resolve().parents[1]/"data"/"netgrowth3g_online_first_20261105.json"
    if first.exists():
        old=json.loads(first.read_text(encoding="utf-8"))
        assert not {r["domain"] for r in old["records"]} & {r["domain"] for r in load()["records"]}
