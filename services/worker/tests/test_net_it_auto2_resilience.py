"""NET-IT-AUTO2: do not lose good sites when one site has malformed data."""
import asyncio
import unittest
from unittest.mock import patch
import app.net_it_auto2_reviewer as reviewer


class Auto2ResilienceTests(unittest.IsolatedAsyncioTestCase):
    async def test_four_distinct_sites_max_and_no_parallel_same_domain(self):
        rows = [{"id": str(i), "domain": f"company{i // 2}.it"}
                for i in range(12)]
        active = 0
        peak = 0
        active_hosts = set()

        async def fake_inspect(client, candidate, *, deep_recovery):
            nonlocal active, peak
            domain = candidate["domain"]
            self.assertNotIn(domain, active_hosts)
            active_hosts.add(domain)
            active += 1
            peak = max(active, peak)
            try:
                await asyncio.sleep(0.02)
                return {"p_candidate_id": candidate["id"],
                        "p_verdict": "identity_supported"}
            finally:
                active -= 1
                active_hosts.remove(domain)

        with patch.object(reviewer, "inspect_candidate", new=fake_inspect):
            findings = await reviewer.review_batch(rows, pause_seconds=0)
        self.assertEqual([x["p_candidate_id"] for x in findings],
                         [x["id"] for x in rows])
        self.assertGreater(peak, 1)
        self.assertLessEqual(peak, 4)

    async def test_bad_url_does_not_forge_evidence_or_abort_others(self):
        rows = [{"id": "bad", "domain": "bad.it"},
                {"id": "good", "domain": "good.it"}]

        async def inspect(client, candidate, *, deep_recovery):
            if candidate["id"] == "bad":
                raise ValueError("Unusable website URL")
            return {"p_candidate_id": candidate["id"],
                    "p_verdict": "identity_supported"}

        with patch.object(reviewer, "inspect_candidate", new=inspect):
            findings = await reviewer.review_batch(rows, pause_seconds=0)
        self.assertEqual(findings[0]["_review_error"], "ValueError")
        self.assertEqual(findings[0]["p_candidate_id"], "bad")
        self.assertNotIn("p_verdict", findings[0])
        self.assertEqual(findings[1]["p_verdict"], "identity_supported")

    async def test_unexpected_programming_error_is_not_downgraded(self):
        async def inspect(client, candidate, *, deep_recovery):
            raise RuntimeError("unexpected worker bug")
        with patch.object(reviewer, "inspect_candidate", new=inspect):
            with self.assertRaises(RuntimeError):
                await reviewer.review_batch(
                    [{"id": "a", "domain": "a.it"}], pause_seconds=0)


if __name__ == "__main__":
    unittest.main()
