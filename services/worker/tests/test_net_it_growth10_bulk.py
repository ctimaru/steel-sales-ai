"""NET-IT-GROWTH10: 200-site bounded batch capacity, never fake evidence."""
import unittest
from unittest.mock import AsyncMock, patch

from app import net_it_auto2_reviewer as reviewer


def result(attempted, recorded, errors=0, queue_kind="standard"):
    return {"attempted": attempted, "reviewed": attempted - errors,
            "recorded": recorded, "site_errors": errors,
            "identity_supported": recorded, "queue_kind": queue_kind,
            "published": 0}


class Auto2BulkTests(unittest.IsolatedAsyncioTestCase):
    async def test_four_full_lots_allow_up_to_two_hundred(self):
        stub = AsyncMock(side_effect=[result(50, 50) for _ in range(4)])
        with patch.object(reviewer, "execute", stub):
            outcome = await reviewer.execute_lots(limit=50, lots=4, persist=True)
        self.assertEqual(outcome["configured_capacity"], 200)
        self.assertEqual(outcome["lots_processed"], 4)
        self.assertEqual(outcome["attempted"], 200)
        self.assertEqual(outcome["recorded"], 200)
        self.assertEqual(outcome["published"], 0)
        self.assertEqual(stub.await_count, 4)
        self.assertTrue(all(c.kwargs["limit"] == 50 and c.kwargs["persist"]
                            for c in stub.await_args_list))

    async def test_stops_on_empty_queue(self):
        stub = AsyncMock(side_effect=[result(33, 33), result(0, 0)])
        with patch.object(reviewer, "execute", stub):
            outcome = await reviewer.execute_lots(limit=50, lots=4, persist=True)
        self.assertEqual(outcome["attempted"], 33)
        self.assertEqual(outcome["lots_processed"], 2)

    async def test_error_only_stops_without_retry_spin(self):
        stub = AsyncMock(return_value=result(1, 0, 1))
        with patch.object(reviewer, "execute", stub):
            outcome = await reviewer.execute_lots(limit=50, lots=4, persist=True)
        self.assertEqual(outcome["lots_processed"], 1)
        self.assertEqual(outcome["site_errors"], 1)
        self.assertEqual(stub.await_count, 1)

    async def test_recovery_batch_then_regular_batch(self):
        stub = AsyncMock(side_effect=[result(12, 12, queue_kind="overture4_recovery"),
                                      result(50, 48, 2), result(0, 0)])
        with patch.object(reviewer, "execute", stub):
            outcome = await reviewer.execute_lots(limit=50, lots=4, persist=True)
        self.assertEqual(outcome["attempted"], 62)
        self.assertEqual(outcome["recorded"], 60)
        self.assertEqual(outcome["site_errors"], 2)

    async def test_dry_run_never_repeats_the_same_sites(self):
        stub = AsyncMock(return_value=result(50, 0))
        with patch.object(reviewer, "execute", stub):
            outcome = await reviewer.execute_lots(limit=50, lots=4, persist=False)
        self.assertEqual(outcome["lots_processed"], 1)
        self.assertEqual(outcome["configured_capacity"], 50)
        self.assertEqual(stub.await_count, 1)

    async def test_rejects_unbounded_lots(self):
        with self.assertRaises(ValueError):
            await reviewer.execute_lots(limit=50, lots=5, persist=True)
        with self.assertRaises(ValueError):
            await reviewer.execute_lots(limit=100, lots=4, persist=True)


if __name__ == "__main__":
    unittest.main()
