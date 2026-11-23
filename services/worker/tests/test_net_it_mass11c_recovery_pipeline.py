"""MASS11C: existing AUTO2 worker must not publish or forge a recovery."""
import os
import unittest
from unittest.mock import AsyncMock, patch

from app import net_it_auto2_reviewer as reviewer


_ID = "00000000-0000-0000-0000-000000120026"


class StubResponse:
    def __init__(self, code, result=None):
        self.status_code = code
        self.result = result or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise AssertionError(f"unexpected response: {self.status_code}")

    def json(self):
        return self.result


class StubClient:
    def __init__(self, with_recovery=True):
        self.calls = []
        self.with_recovery = with_recovery

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return None

    async def post(self, url, *, headers, json):
        route = url.rsplit("/", 1)[-1]
        self.calls.append(route)
        if route == "net_it_auto2_recovery_queue":
            return StubResponse(404)
        if route == "net_it_mass11c_recovery_queue":
            if not self.with_recovery:
                return StubResponse(404)
            return StubResponse(200, {
                "contract": "net-it-mass11c-recovery-queue-v1",
                "items": [{
                    "id": _ID, "domain": "testcarpenteria.it",
                    "company_name": "Test Carpenteria",
                    "url": "https://testcarpenteria.it/",
                    "website_url": "https://testcarpenteria.it/",
                    "quality_flags": ["identity_no_legal_suffix"],
                    "role_keys": ["processor_service_provider"],
                }],
            })
        if route == "net_it_auto2_queue":
            return StubResponse(200, {"contract": "net-it-auto2-queue-v1",
                                      "items": []})
        if route == "net_it_auto2_record":
            return StubResponse(200, {"contract": "net-it-auto2-review-v1",
                "verdict": json["p_verdict"], "publication_count": 0})
        if route == "net_it_mass11c_recovery_finalize":
            return StubResponse(200, {
                "contract": "net-it-mass11c-recovery-finalize-v1",
                "status": "restored_discard", "recovered": 1, "published": 0})
        raise AssertionError(f"unexpected RPC: {route}")


class RecoveryWorkerTest(unittest.IsolatedAsyncioTestCase):
    async def test_once_only_claim_review_record_then_finalize(self):
        stub = StubClient()
        finding = {
            "p_candidate_id": _ID, "p_verdict": "identity_supported",
            "p_reviewer_version": reviewer.VERSION, "p_reasons": [],
            "p_observed_domain": "testcarpenteria.it",
            "p_matched_name": True, "p_observed_name": "Test Carpenteria S.r.l.",
            "p_page_url": "https://testcarpenteria.it/contatti",
            "p_hash": "a" * 64, "p_confidence": 0.94,
            "p_terms_url": None, "p_rights_state": "unknown",
        }
        inspect = AsyncMock(return_value=[finding])
        with patch.dict(os.environ, {
             "SUPABASE_URL": "https://unit-test.supabase.co",
             "SUPABASE_SERVICE_ROLE_KEY": "unit-test-no-real-credentials",
             }), patch.object(reviewer.httpx, "AsyncClient",
                return_value=stub), patch.object(reviewer, "review_batch", inspect):
            res = await reviewer.execute(limit=12, persist=True)
        self.assertEqual(res["queue_kind"], "mass11c_firstparty_recovery")
        self.assertEqual(res["mass11c_finalized"], 1)
        self.assertEqual(res["mass11c_recovered"], 1)
        self.assertEqual(res["published"], 0)
        self.assertTrue(inspect.await_args.kwargs["deep_recovery"])
        self.assertEqual(stub.calls, [
            "net_it_auto2_recovery_queue", "net_it_mass11c_recovery_queue",
            "net_it_auto2_record", "net_it_mass11c_recovery_finalize"])

    async def test_no_migration_falls_back_to_normal_queue(self):
        stub = StubClient(with_recovery=False)
        with patch.dict(os.environ, {
             "SUPABASE_URL": "https://unit-test.supabase.co",
             "SUPABASE_SERVICE_ROLE_KEY": "unit-test-no-real-credentials",
             }), patch.object(reviewer.httpx, "AsyncClient", return_value=stub):
            res = await reviewer.execute(limit=12, persist=True)
        self.assertEqual(res["queue_kind"], "standard")
        self.assertEqual(res["reviewed"], 0)
        self.assertEqual(res["published"], 0)
        self.assertEqual(stub.calls, [
            "net_it_auto2_recovery_queue", "net_it_mass11c_recovery_queue",
            "net_it_auto2_queue"])

    async def test_dry_run_does_not_claim_mass11c(self):
        stub = StubClient()
        with patch.dict(os.environ, {
             "SUPABASE_URL": "https://unit-test.supabase.co",
             "SUPABASE_SERVICE_ROLE_KEY": "unit-test-no-real-credentials",
             }), patch.object(reviewer.httpx, "AsyncClient", return_value=stub):
            res = await reviewer.execute(limit=12, persist=False)
        self.assertEqual(res["mode"], "dry_run")
        self.assertNotIn("net_it_mass11c_recovery_queue", stub.calls)
        self.assertEqual(res["published"], 0)


if __name__ == "__main__":
    unittest.main()
