from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, patch
import unittest

from app import trader1d3b2_live_refresh as m
from app.company_discovery import CompanyDiscoveryError


def source(rid="11111111-1111-4111-8111-111111111111", kind="role_evidence",
           url="https://www.example.com/tubes"):
    return {"research_id":rid,"domain":"example.com","market":"DE",
            "source_kind":kind,"source_url":url}


def page(total=1,offset=0,items=None):
    return {"contract":m.CONTRACT,"total":total,"limit":5,"offset":offset,
            "items":items if items is not None else [source()]}


class LiveSourceValidationTest(unittest.TestCase):
    def test_bounds_and_selection(self):
        self.assertEqual(m.validate_items(page(),expected_offset=0)[0],1)
        self.assertEqual(m.utc_rotation(date(2026,10,20),11),0)
        self.assertEqual(m.utc_rotation(date(2026,10,21),11),1)
        self.assertEqual(m.utc_rotation(date(2026,10,22),11),2)
        self.assertEqual(m.utc_rotation(date(2026,10,23),11),0)
        with self.assertRaises(ValueError):
            m.validate_items(page(total=2001),expected_offset=0)
        with self.assertRaises(ValueError):
            m.validate_items(page(total=20,items=[]),expected_offset=0)
        with self.assertRaises(ValueError):
            m.validate_items(page(total=1,offset=5),expected_offset=0)

    def test_rejects_off_domain_local_credentials_plain_http_and_duplicates(self):
        bad_urls=[
            "https://localhost/",
            "https://127.0.0.1/",
            "http://www.example.com/tubes",
            "https://www.other.com/tubes",
            "https://example.com@bad.com",
            "https://www.example.com:444/tubes",
            "https://www.linkedin.com/company/a",
        ]
        for url in bad_urls:
            with self.subTest(url=url),self.assertRaises((ValueError,CompanyDiscoveryError)):
                m.validate_items(page(items=[source(url=url)]),expected_offset=0)
        with self.assertRaises(ValueError):
            m.validate_items(page(total=2,items=[source(),source()]),expected_offset=0)

    def test_product_role_two_distinct_urls_may_share_domain(self):
        rows=[source(),source(kind="product_evidence",
                              url="https://www.example.com/steel")]
        n,items=m.validate_items(page(total=2,items=rows),expected_offset=0)
        self.assertEqual(n,2)
        self.assertEqual(len(items),2)


class LiveWorkerTest(unittest.IsolatedAsyncioTestCase):
    async def test_single_atomic_write_and_no_publication(self):
        responses=[
            page(),
            {"contract":m.COMMIT_CONTRACT,"inserted":1,"duplicate_day":0,
             "published":0,"rights_updated":0},
        ]
        calls=[]
        async def rpc(*args,**kwargs):
            calls.append(args[3])
            return responses.pop(0)
        health={"status":"reachable_html","http_status":200,
                "content_type":"text/html","fingerprint":"a"*64}
        with patch.object(m,"service_rpc",side_effect=rpc),patch.object(
            m,"inspect_source",new_callable=AsyncMock,return_value=health):
            result=await m.run(day=date(2026,10,20),delay=0,
              api_client=object(),source_client=object(),
              credentials=("https://approved.example.com","mock-key"))
        self.assertEqual(calls,["trader1d3b2_source_batch",
                                "trader1d3b2_commit_observations"])
        self.assertEqual(result["total_live_sources"],1)
        self.assertEqual(result["recorded"],1)
        self.assertEqual(result["published"],0)
        self.assertEqual(result["source_rights_updated"],0)
        self.assertFalse(result["company_content_downloaded"])

    async def test_inventory_changing_fails_before_source_network_or_insert(self):
        ids=[f"{i:08x}-1111-4111-8111-111111111111" for i in range(1,6)]
        first=page(total=10,items=[source(rid=i) for i in ids])
        later=page(total=11,offset=5,items=[source(rid=i) for i in ids])
        with patch.object(m,"service_rpc",new_callable=AsyncMock,
                          side_effect=[first,later]) as rpc, patch.object(
            m,"inspect_source",new_callable=AsyncMock) as fetch:
            with self.assertRaises(RuntimeError):
                await m.run(day=date(2026,10,21),delay=0,
                    api_client=object(),source_client=object(),
                    credentials=("https://approved.example.com","mock-key"))
        self.assertEqual(rpc.await_count,2)
        fetch.assert_not_awaited()

    async def test_unexpected_commit_response_is_not_success(self):
        responses=[page(),{"contract":m.COMMIT_CONTRACT,
                            "inserted":1,"duplicate_day":0,
                            "published":1,"rights_updated":0}]
        health={"status":"robots_or_unavailable","http_status":None,
                "content_type":None,"fingerprint":None}
        with patch.object(m,"service_rpc",new_callable=AsyncMock,
                          side_effect=responses), patch.object(
            m,"inspect_source",new_callable=AsyncMock,return_value=health):
            with self.assertRaises(RuntimeError):
                await m.run(day=date(2026,10,20),delay=0,
                   api_client=object(),source_client=object(),
                   credentials=("https://approved.example.com","mock-key"))


if __name__=="__main__":
    unittest.main()
