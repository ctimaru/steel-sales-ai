"""B3 safe source graph: same-host partner links, no PII, no publication."""
import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app import net_it_growthb3_firstparty_referrals as b3


def test_partner_page_selection_is_first_party_and_bounded():
    result = b3.partner_pages("https://www.steel-company.it/", [
        "https://example.net/partners",
        "/prodotti/tubi",
        "/partner/",
        "/collaborazioni/",
        "/associati/",
        "/partnership?session=private",
        "https://127.0.0.1/partners",
    ])
    assert result == ["https://www.steel-company.it/partner/",
                      "https://www.steel-company.it/collaborazioni/"]


def test_referrals_hold_only_domains_without_company_information():
    candidates = b3.referrals_on_partner_page(
        "https://www.steel-company.it/partner/",
        ["https://www.partner-steel.it/chi-siamo",
         "https://partner-steel.it/prodotti",
         "https://linkedin.com/company/foo",
         "mailto:someone@example.it",
         "https://www.seconda-carpenteria.it/"],
        "11111111-1111-4111-8111-111111111111"
    )
    assert len(candidates) == 2
    assert candidates[0] == {
        "domain": "partner-steel.it",
        "homepage": "https://partner-steel.it/",
        "source_company_id": "11111111-1111-4111-8111-111111111111",
        "evidence_url": "https://www.steel-company.it/partner/",
    }
    assert set(candidates[0]) == {
        "domain", "homepage", "source_company_id", "evidence_url"
    }


def test_homepage_links_do_not_create_referrals():
    assert b3.referrals_on_partner_page(
        "https://steel-company.it/", ["https://other-steel.it/"],
        "11111111-1111-4111-8111-111111111111"
    ) == []


def test_main_skips_without_an_owner_policy():
    asyncio.run(_main_skips())


async def _main_skips():
    with patch.object(b3, "credentials_from_environment", return_value=(
            "https://example.supabase.co", "sb_secret_test"
    )), patch.object(b3, "rpc", new=AsyncMock(return_value={
        "contract": "net-it-growthb3-v1", "eligible": False,
        "reason": "owner_policy_inactive"
    })) as rpc:
        report = await b3.main()
    assert report["status"] == "skipped"
    assert report["published"] == 0
    assert rpc.await_count == 1


def test_main_commits_only_approved_first_party_origin_domains():
    asyncio.run(_main_happy())


async def _main_happy():
    sources = [
        {"company_id": "11111111-1111-4111-8111-111111111111",
         "domain": "steel-company.it", "homepage": "https://steel-company.it/",
         "role_hint": "producer"},
        {"company_id": "22222222-2222-4222-8222-222222222222",
         "domain": "carpenteria.it", "homepage": "https://carpenteria.it/",
         "role_hint": "processor_service_provider"},
    ]
    candidate = {
        "domain": "partner-steel.it", "homepage": "https://partner-steel.it/",
        "evidence_url": "https://steel-company.it/partner/",
        "source_company_id": sources[0]["company_id"],
    }
    with patch.object(b3, "credentials_from_environment", return_value=(
            "https://example.supabase.co", "sb_secret_test"
    )), patch.object(b3, "rpc", new=AsyncMock(side_effect=[
        {"contract": "net-it-growthb3-v1", "eligible": True,
         "run_id": "run-uuid", "items": sources, "max_referrals": 120},
        {"contract": "net-it-growthb3-v1", "status": "completed",
         "net_new_to_network": 1, "duplicate_or_invalid": 0, "published": 0},
    ])) as rpc, patch.object(b3, "harvest_site", new=AsyncMock(
        side_effect=[([candidate], 14, False), ([], 8, False)]
    )) as harvest:
        result = await b3.main()
    assert harvest.await_count == 2
    assert rpc.await_count == 2
    assert rpc.await_args_list[1].args[4] == {
        "p_run_id": "run-uuid", "p_items": [candidate],
        "p_metrics": {"raw_links": 22, "failures": 0},
    }
    assert result["new_unverified_domains"] == 1
    assert result["published"] == 0


def test_main_rejects_abnormal_batch_before_visiting_sites():
    asyncio.run(_main_abnormal())


async def _main_abnormal():
    with patch.object(b3, "credentials_from_environment", return_value=(
            "https://example.supabase.co", "sb_secret_test"
    )), patch.object(b3, "rpc", new=AsyncMock(return_value={
        "contract": "net-it-growthb3-v1", "eligible": True,
        "run_id": "run-uuid", "items": [], "max_referrals": 120
    })), patch.object(b3, "harvest_site", new=AsyncMock()) as harvest:
        with pytest.raises(RuntimeError):
            await b3.main()
    harvest.assert_not_awaited()
