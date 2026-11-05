"""NET-RO1.4 WEB-GROWTH2: offline checks, never DB writes or company publication."""
from collections import Counter
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "services" / "worker" / "data"
OLD = DATA / "netro1_first50_qualification_ledger_20261105.json"
WAVE1 = DATA / "netro1_4_web_growth_first17_20261105.json"
WAVE2 = DATA / "netro1_4_web_growth2_20261105.json"
SQL = ROOT / "supabase" / "migrations" / "20261105144500_net_ro1_web_growth2_research.sql"


def _rows(path):
    return json.loads(path.read_text(encoding="utf-8"))["records"]


def test_50_additional_domains_distinct_from_prior_67():
    previous = _rows(OLD) + _rows(WAVE1)
    wave2 = _rows(WAVE2)
    assert len(previous) == 67 and len(wave2) == 50
    domains = [r["domain"] for r in previous + wave2]
    assert len(set(domains)) == 117
    assert all(x["candidate_id"] == "NET-RO1-" + str(68+i).zfill(3) for i,x in enumerate(wave2))
    doc = json.loads(WAVE2.read_text(encoding="utf-8"))
    assert doc["cohort_size"] == 50 and doc["total_research_domains"] == 117


def test_role_and_web_evidence_quality_split():
    wave2 = _rows(WAVE2)
    assert Counter(x["proposed_role"] for x in wave2) == {
        "producer": 5, "trader_distributor": 30,
        "processor_service_provider": 15
    }
    assert Counter(x["source_kind"] for x in wave2) == {
        "first_party_web": 41, "industry_directory": 8,
        "historical_trade_ad": 1
    }
    assert all(x["country"] == "RO" and x["source_url"].startswith("https://") for x in wave2)
    assert all(x["production_write_authorized"] is False for x in wave2)
    assert all(x["publication_status"] == "not_published" for x in wave2)
    assert all(x["claim_status"] == "unclaimed" for x in wave2)
    assert all(x["verification_status"] == "website_sourced_unverified" for x in wave2)
    assert all(x["no_personal_contacts"] is True for x in wave2)
    assert all(x["source_rights"] == "link_and_independently_paraphrased_facts_only" for x in wave2)
    assert all(len(x["summary_it"]) >= 25 for x in wave2)


def test_weak_entries_marked_as_not_verified_and_group_aliases_held():
    by_domain = {x["domain"]: x for x in _rows(WAVE2)}
    assert by_domain["conmet.com.ro"]["source_kind"] == "historical_trade_ad"
    assert "2007" in by_domain["conmet.com.ro"]["review_lane"]
    assert by_domain["technosteel-lbr.ro"]["source_kind"] == "industry_directory"
    assert "unverified" in by_domain["technosteel-lbr.ro"]["review_lane"]
    assert "different_brands" in by_domain["metal-inox.ro"]["review_lane"]
    assert "alias" in by_domain["steelpipes.ro"]["review_lane"]
    assert by_domain["steeltevimetal.ro"]["source_kind"] == "industry_directory"
    assert by_domain["wecubex.ro"]["proposed_role"] == "processor_service_provider"
    assert "ht i-romania.ro" not in by_domain


def test_second_migration_exact_50_rows_private_and_idempotent():
    sql = SQL.read_text(encoding="utf-8")
    assert "INSERT INTO private.network_web_research_seeds" in sql
    assert "ON CONFLICT (country_code,canonical_domain) DO NOTHING" in sql
    assert "INSERT INTO public." not in sql
    assert "UPDATE public." not in sql
    domains = re.findall(r"\('RO', '([a-z0-9.-]+)',",sql)
    assert len(domains) == len(set(domains)) == 50
    assert set(domains) == {x["domain"] for x in _rows(WAVE2)}
    assert sql.count("'NET-RO1-WEB50'") == 50
    assert sql.count("'historical_trade_ad'") == 1
    assert sql.count("'industry_directory'") == 8
