"""MASS11G: source-scoped deep recovery never approves or publishes a company.

Covers exclusive queue selection, fresh proof finalization, failed evidence
and migration-unavailable fallback, preserving the existing reviewer pipeline.
"""
import os
import unittest
from unittest.mock import AsyncMock, patch

from app import net_it_auto2_reviewer as reviewer


CANDIDATE = "00000000-0000-0000-0000-000000241124"


class StubResponse:
    def __init__(self, code, data=None):
        self.status_code = code
        self.data = data or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise AssertionError(f"unexpected HTTP {self.status_code}")

    def json(self):
        return self.data


class StubClient:
    def __init__(self, *, campaign=True, recovered=True):
        self.calls = []
        self.campaign = campaign
        self.recovered = recovered

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return None

    async def post(self, url, *, headers, json):
        route = url.rsplit("/", 1)[-1]
        self.calls.append(route)
        if route in ("net_it_auto2_recovery_queue", "net_it_mass11c_recovery_queue"):
            return StubResponse(404)
        if route == "net_it_mass11g_recovery_queue":
            if not self.campaign:
                return StubResponse(404)
            return StubResponse(200, {
                "contract": "net-it-mass11g-recovery-queue-v1",
                "count": 1,
                "publication_authorized": False,
                "items": [{
                    "id": CANDIDATE,
                    "domain": "carpenteriaesempio.it",
                    "company_name": "Carpenteria Esempio",
                    "url": "https://carpenteriaesempio.it/",
                    "website_url": "https://carpenteriaesempio.it/",
                    "quality_flags": ["identity_no_legal_suffix"],
                    "role_keys": ["processor_service_provider"],
                }],
            })
        if route == "net_it_auto2_queue":
            return StubResponse(200, {"contract": "net-it-auto2-queue-v1", "items": []})
        if route == "net_it_auto2_record":
            return StubResponse(200, {"contract": "net-it-auto2-review-v1",
                                      "verdict": json["p_verdict"],
                                      "publication_count": 0})
        if route == "net_it_mass11g_recovery_finalize":
            return StubResponse(200, {
                "contract": "net-it-mass11g-recovery-finalize-v1",
                "recovered": 1 if self.recovered else 0,
                "published": 0,
                "status": "restored_discard" if self.recovered else "evidence_or_policy_hold",
            })
        raise AssertionError(f"unexpected RPC {route}")


class ReviewPipelineTest(unittest.IsolatedAsyncioTestCase):
    def _finding(self, verdict: str) -> dict:
        return {
            "p_candidate_id": CANDIDATE,
            "p_verdict": verdict,
            "p_reviewer_version": reviewer.VERSION,
            "p_reasons": [] if verdict == "identity_supported" else ["no_company_name_on_site"],
            "p_observed_domain": "carpenteriaesempio.it" if verdict == "identity_supported" else None,
            "p_matched_name": verdict == "identity_supported",
            "p_observed_name": "Carpenteria Esempio S.r.l." if verdict == "identity_supported" else None,
            "p_page_url": "https://carpenteriaesempio.it/contatti",
            "p_hash": "a" * 64,
            "p_confidence": 0.94 if verdict == "identity_supported" else 0.4,
            "p_terms_url": None,
            "p_rights_state": "unknown",
        }

    async def _execute(self, stub, *, persist=True, verdict="identity_supported"):
        inspect = AsyncMock(return_value=[self._finding(verdict)])
        with patch.dict(os.environ, {
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "test-not-secret",
        }), patch.object(reviewer.httpx, "AsyncClient", return_value=stub), \
                patch.object(reviewer, "review_batch", inspect):
            result = await reviewer.execute(limit=12, persist=persist)
        return result, inspect

    async def test_supported_fresh_source_proof_can_only_restore_discard(self):
        stub = StubClient()
        result, inspect = await self._execute(stub)
        self.assertEqual(result["queue_kind"], "mass11g_firstparty_recovery")
        self.assertTrue(inspect.await_args.kwargs["deep_recovery"])
        self.assertEqual(result["mass11g_finalized"], 1)
        self.assertEqual(result["mass11g_recovered"], 1)
        self.assertEqual(result["published"], 0)
        self.assertEqual(stub.calls, [
            "net_it_auto2_recovery_queue", "net_it_mass11c_recovery_queue",
            "net_it_mass11g_recovery_queue", "net_it_auto2_record",
            "net_it_mass11g_recovery_finalize",
        ])

    async def test_insufficient_evidence_remains_on_hold(self):
        stub = StubClient(recovered=False)
        result, _ = await self._execute(stub, verdict="needs_human")
        self.assertEqual(result["mass11g_finalized"], 1)
        self.assertEqual(result["mass11g_recovered"], 0)
        self.assertEqual(result["published"], 0)

    async def test_without_migration_falls_back_to_standard_queue(self):
        stub = StubClient(campaign=False)
        result, _ = await self._execute(stub)
        self.assertEqual(result["queue_kind"], "standard")
        self.assertEqual(result["reviewed"], 0)
        self.assertEqual(result["published"], 0)
        self.assertEqual(stub.calls, [
            "net_it_auto2_recovery_queue", "net_it_mass11c_recovery_queue",
            "net_it_mass11g_recovery_queue", "net_it_auto2_queue",
        ])

    async def test_dry_run_does_not_claim_recovery(self):
        stub = StubClient()
        result, _ = await self._execute(stub, persist=False)
        self.assertEqual(result["mode"], "dry_run")
        self.assertNotIn("net_it_mass11g_recovery_queue", stub.calls)
        self.assertEqual(result["published"], 0)


if __name__ == "__main__":
    unittest.main()
