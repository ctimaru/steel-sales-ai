import unittest
from unittest.mock import Mock

from app.network_profile_persistence import parse_company_id, prepare_candidates, persist_candidates


class EnrichmentPersistenceTest(unittest.TestCase):
    def test_reject_invalid_uuid(self):
        with self.assertRaises(ValueError):
            parse_company_id("not-a-company")

    def test_unavailable_or_unreviewed_never_persists(self):
        candidate = {"review_status": "accepted", "field_key": "description",
                     "evidence_url": "https://example.com", "field_value": "x"}
        self.assertEqual(prepare_candidates({"status": "candidates_only", "candidates": [candidate]}), [])
        self.assertEqual(prepare_candidates({"status": "blocked_or_unavailable", "candidates": [candidate]}), [])

    def test_service_rpc_receives_only_eligible_evidence(self):
        item = {"review_status": "candidate", "field_key": "description",
                "field_value": "Source text", "evidence_url": "https://example.com/",
                "evidence_excerpt": "Source text", "extractor_version": "v1",
                "fetched_at": "2026-10-19T00:00:00Z", "confidence": 1.0}
        prepared = prepare_candidates({"status": "candidates_only", "candidates": [item]})
        self.assertEqual(len(prepared), 1)
        self.assertNotIn("confidence", prepared[0])
        rpc_call = Mock()
        rpc_call.execute.return_value.data = 1
        db = Mock()
        db.rpc.return_value = rpc_call
        uid = "00000000-0000-0000-0000-000000000123"
        self.assertEqual(persist_candidates(db, company_id=uid, kind="discovered",
                                            candidates=prepared), 1)
        name, payload = db.rpc.call_args.args
        self.assertEqual(name, "netprofile1c3_ingest_evidence")
        self.assertIsNone(payload["p_canonical_company_id"])
        self.assertEqual(payload["p_discovered_record_id"], uid)
        self.assertEqual(payload["p_candidates"], prepared)


if __name__ == "__main__":
    unittest.main()
