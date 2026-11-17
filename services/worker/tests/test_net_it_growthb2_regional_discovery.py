"""NET-IT-GROWTH.B2: region, industry and source-integrity regressions."""
import pytest
from unittest.mock import AsyncMock, patch

from app import net_it_growthb2_regional_discovery as b2


def binding(qid="Q1234", name="Tubificio S.r.l.", domain="tubificio.it",
            industry="Q2285982"):
    return {
        "item": {"value": f"http://www.wikidata.org/entity/{qid}"},
        "label": {"value": name},
        "website": {"value": f"https://www.{domain}/"},
        "industry": {"value": f"http://www.wikidata.org/entity/{industry}"},
    }


def test_all_twenty_regions_have_unique_wikidata_qids_and_piemonte_priority():
    assert len(b2.REGIONS) == 20
    assert len(set(b2.REGIONS.values())) == 20
    assert list(b2.REGIONS.items())[:2] == [
        ("Piemonte", "Q1216"), ("Lombardia", "Q1210")
    ]
    assert all(b2.QID.fullmatch(qid) for qid in b2.REGIONS.values())


def test_source_query_requires_actual_headquarters_industry_and_italian_country():
    query = b2.sparql("Q1216", 0)
    assert "wdt:P17 wd:Q38" in query
    assert "wdt:P452 ?industry" in query
    assert "wdt:P856 ?website" in query
    assert "wdt:P159 ?headquarters" in query
    assert "?headquarters wdt:P131* wd:Q1216" in query
    assert "FILTER NOT EXISTS" in query and "wdt:P31 wd:Q5" in query
    assert "LIMIT 100 OFFSET 0" in query
    assert all("wd:" + sector in query for sector in b2.SECTORS)
    assert "OFFSET 100" in b2.sparql("Q1210", 100)
    for region, offset in (("Q5", 0), ("Q1216", -100), ("Q1216", 99),
                           ("Q1216", 1100), ("Q1216", True)):
        with pytest.raises(ValueError):
            b2.sparql(region, offset)


def test_source_parsing_deduplicates_and_drops_platforms_not_people_profiles():
    rows = [
        binding(),
        binding(name="Duplicato"),
        binding(qid="Q1235", name="Carpenteria Gamma S.r.l.", domain="carpenteria.it",
                industry="Q1924906"),
        binding(qid="Q1236", domain="linkedin.com"),
        binding(qid="Q1237", name="Test", industry="Q5"),
        binding(qid="Q1238", name="Mario <script>", domain="strange.it"),
        binding(qid="Q1239", domain="example.invalid:8080"),
    ]
    output, received = b2.parse_bindings({"results": {"bindings": rows}}, "Q1216")
    assert received == len(rows)
    assert len(output) == 2
    assert output[0] == {
        "qid": "Q1234", "label": "Tubificio S.r.l.",
        "domain": "tubificio.it", "website": "https://tubificio.it/",
        "industry_qid": "Q2285982", "region_qid": "Q1216",
    }
    assert output[1]["domain"] == "carpenteria.it"
    assert output[1]["region_qid"] == "Q1216"


def test_parser_rejects_overbudget_or_malformed_response():
    with pytest.raises(ValueError):
        b2.parse_bindings({"results": {"bindings": [{}] * 101}}, "Q1216")
    with pytest.raises(ValueError):
        b2.parse_bindings({"results": {"bindings": []}}, "Q5")
    with pytest.raises(ValueError):
        b2.parse_bindings({"results": {"bindings": "not-an-array"}}, "Q1216")


@pytest.mark.asyncio
async def test_main_skips_without_owner_source_authorization():
    with patch.object(b2, "credentials_from_environment",
                      return_value=("https://example.supabase.co", "x" * 40)), \
         patch.object(b2, "call_rpc", new=AsyncMock(return_value={
             "contract": "net-it-growthb2-v1", "eligible": False,
             "reason": "approved_source_or_owner_policy_inactive"
         })) as rpc:
        result = await b2.main()
    assert result["status"] == "skipped"
    assert result["published"] == 0
    assert rpc.await_count == 1


@pytest.mark.asyncio
async def test_main_uses_exactly_two_regions_then_never_publishes():
    claims = {
        "contract": "net-it-growthb2-v1",
        "eligible": True, "run_id": "test-run", "max_records": 200,
        "regions": [{"qid": "Q1216", "offset": 0},
                    {"qid": "Q1210", "offset": 100}]
    }
    committed = {
        "contract": "net-it-growthb2-v1",
        "status": "completed",
        "new_domains": 1, "duplicate_or_rejected": 1, "published": 0,
    }
    with patch.object(b2, "credentials_from_environment",
                      return_value=("https://example.supabase.co", "x" * 40)), \
         patch.object(b2, "call_rpc", new=AsyncMock(
             side_effect=[claims, committed])) as rpc, \
         patch.object(b2, "fetch_region", new=AsyncMock(
             side_effect=[([{"qid": "Q1234"}], 1), ([{"qid": "Q1235"}], 1)])) as fetch, \
         patch.object(b2.asyncio, "sleep", new=AsyncMock()) as sleep:
        result = await b2.main()
    assert fetch.await_count == 2
    assert fetch.await_args_list[0].args[1:] == ("Q1216", 0)
    assert fetch.await_args_list[1].args[1:] == ("Q1210", 100)
    sleep.assert_awaited_once_with(8)
    assert rpc.await_count == 2
    assert rpc.await_args_list[1].args[4] == {
        "p_run_id": "test-run", "p_items": [
            {"qid": "Q1234"}, {"qid": "Q1235"}
        ], "p_counts": {"Q1216": 1, "Q1210": 1}
    }
    assert result["published"] == 0


@pytest.mark.asyncio
async def test_main_rejects_unapproved_regions_without_fetching():
    claim = {
        "contract": "net-it-growthb2-v1", "eligible": True,
        "max_records": 200, "run_id": "test-run",
        "regions": [{"qid": "Q1216", "offset": 0}, {"qid": "Q5", "offset": 0}]
    }
    with patch.object(b2, "credentials_from_environment",
                      return_value=("https://example.supabase.co", "x" * 40)), \
         patch.object(b2, "call_rpc", new=AsyncMock(return_value=claim)), \
         patch.object(b2, "fetch_region", new=AsyncMock()) as fetch:
        with pytest.raises(RuntimeError):
            await b2.main()
    fetch.assert_not_awaited()
