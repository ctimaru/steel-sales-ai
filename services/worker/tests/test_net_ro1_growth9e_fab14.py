"""NET-RO1.GROWTH9.E: Romania carpenterie intake, identity, and guarded publisher."""
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "services/worker/data"
MIG = ROOT / "supabase/migrations"


def load():
    manifest=json.loads((DATA / "net_ro1_growth9e_fabricators14_20261108.json").read_text(encoding="utf-8"))
    review=json.loads((DATA / "net_ro1_growth9e_reconcile48_20261108.json").read_text(encoding="utf-8"))
    source=(MIG / "20261108170000_net_ro1_growth9e_fab14_private_research.sql").read_text(encoding="utf-8")
    publish=(MIG / "20261108171000_net_ro1_growth9e_fab14_publisher.sql").read_text(encoding="utf-8")
    return manifest,review,source,publish


def test_intake_14_first_party_distinct_and_unclaimed():
    manifest,_,_,_=load()
    rows=manifest["companies"]
    assert manifest["recovered_from_held"] == 7
    assert manifest["new_source_backed"] == 7
    assert manifest["starting_public_ro"] == 220
    assert manifest["starting_private_ro"] == 313
    assert manifest["expected_public_ro"] == 234
    assert manifest["expected_private_ro"] == 327
    assert len(rows) == 14
    assert len(set(r["canonical_domain"] for r in rows)) == 14
    assert len(set(r["research_id"] for r in rows)) == 14
    assert Counter(r["proposed_role"] for r in rows) == {"processor_service_provider":12,"producer":2}
    assert len([r for r in rows if r["census_row"] is not None]) == 7
    assert all(r["batch_key"]=="NET-RO1-G9E-FAB14" for r in rows)
    assert all(r["country_code"]=="RO" and r["source_kind"]=="first_party_web" for r in rows)
    assert all(r["verification_status"]=="web_sourced_unverified" and r["claim_status"]=="unclaimed" for r in rows)
    assert all(r["publication_status"]=="not_published" and r["review_lane"]=="web_profile_review_pending" for r in rows)
    assert all(r["source_url"].startswith("https://") and r["source_url"].split("/")[2].removeprefix("www.") == r["canonical_domain"] for r in rows)
    assert all(r["city"] and r["province"] and r["nuts"].startswith("RO") for r in rows)
    assert all(30<=len(r["source_summary"])<=950 for r in rows)
    assert "avirob.eu" not in {r["canonical_domain"] for r in rows}
    assert {r["canonical_domain"] for r in rows if r["proposed_role"]=="producer"} == {"profilegalvanizate.ro","profin.ro"}
    assert all(not (r["public_company_contact_email"] and r["public_company_contact_email"].split("@")[-1]!=r["canonical_domain"]) for r in rows)


def test_remaining_48_reconciled_exactly_once():
    m,r,_,_=load()
    assert len(r["records"]) == r["held_before"] == 48
    assert len({row["source_row"] for row in r["records"]}) == 48
    assert r["recovered_from_held"] == 7
    assert r["held_after"] == 41
    assert r["new_first_party_industrial"] == 7
    assert r["excluded_duplicate"]["domain"] == "avirob.eu"
    recovered=[x for x in r["records"] if x["decision"]=="source_cleared_growth9e_private_intake"]
    assert len(recovered)==7
    assert {x["source_row"] for x in recovered} == {c["census_row"] for c in m["companies"] if c["census_row"] is not None}
    assert all(row["publication_approved"] is False for row in r["records"])
    for name in ("ZAUNER ROMANIA SRL","EMSIL TECHTRANS SRL","MIRAS INTERNATIONAL SRL"):
        assert any(x["normalized_company_name"]==name and "review" in x["decision"] for x in r["records"])


def test_private_source_batch_atomic_guarded():
    m,_,sql,_=load()
    assert sql.count("INSERT INTO private.network_web_research_seeds") == 1
    assert "INSERT INTO public.network_companies" not in sql
    assert "INSERT INTO public.network_contacts" not in sql
    for term in ("v_count<>14","v_inserted<>14","canonical_domain text))<>14","research_id text))<>14",
                 "network_netfast3_suppressed_domains","network_eu_nuts2024_regions",
                 "SHARE ROW EXCLUSIVE MODE","pg_advisory_xact_lock","NET-RO1-G9E-FAB14"):
        assert term in sql,term
    found=re.search(r"v_manifest constant jsonb := '([\\s\\S]*?)'::jsonb;",sql)
    assert found
    embedded=json.loads(found.group(1).replace("''","'"))
    assert len(embedded)==len(m["companies"])==14


def test_publication_requires_explicit_service_role_commit():
    _,_,_,sql=load()
    for term in ("private.netro_growth9e_publish_fab14", "p_commit boolean DEFAULT false",
                 "v_expected constant integer := 14","v_existing<>220","v_research<>327",
                 "v_eligible<>v_expected","v_prev<>0","v_published<>v_expected",
                 "'eligible',14","'would_publish',14","'expected_total_public_ro',234",
                 "'already_public_ro_expected',220","network_ro14c_publication_links",
                 "SHARE ROW EXCLUSIVE MODE","pg_advisory_xact_lock",
                 "netro_growth9e_fabricator_web","REVOKE ALL ON FUNCTION",
                 "TO service_role","'owner_verified',false","'tube_purchases_verified',false"):
        assert term in sql,term
    assert sql.count("INSERT INTO public.network_companies") == 1
    assert sql.count("INSERT INTO public.network_facilities") == 1
    assert sql.count("INSERT INTO public.network_company_role_assignments") == 1
    for unsafe in ("SELECT private.netro_growth9e_publish_fab14(true)",
                   "INSERT INTO public.network_contacts","INSERT INTO public.network_company_claims",
                   "INSERT INTO public.network_company_products","INSERT INTO public.network_company_certifications"):
        assert unsafe not in sql
