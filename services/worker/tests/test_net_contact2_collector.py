"""NET-CONTACT2: scheduled NET-CONTACT1 collection with a mail-domain check."""
import unittest
from unittest.mock import AsyncMock, patch

from app.net_contact2_collector import ALLOWED_RPCS, interpret_doh, run_lot


class FakeDb:
    def __init__(self):
        self.calls = []

    def rpc(self, name, params):
        self.calls.append((name, params))
        db = self

        class _Call:
            def execute(self):
                class _R:
                    data = {"status": "staged"} if name == "netcontact1_stage_company_channel" else {}
                return _R()
        return _Call()


ITEM = {"company_id": "00000000-0000-0000-0000-0000000c0001", "site": "https://www.rossitubi.it/",
        "domain": "rossitubi.it", "company_name": "Rossi Tubi"}


class InterpretDohTest(unittest.TestCase):
    def test_answers(self):
        self.assertEqual(interpret_doh({"Status": 0, "Answer": [{"type": 15, "data": "10 mx.rossitubi.it."}]}), "mx")
        self.assertEqual(interpret_doh({"Status": 0, "Answer": [{"type": 5}]}), "no_mx")
        self.assertEqual(interpret_doh({"Status": 3}), "no_mx")
        self.assertEqual(interpret_doh({"Status": 2}), "unknown")
        self.assertEqual(interpret_doh(None), "unknown")


class RunLotTest(unittest.IsolatedAsyncioTestCase):
    async def test_email_with_mx_is_staged(self):
        db = FakeDb()
        found = dict(status="sourced_channel", pages=2,
                     email=("info@rossitubi.it", "https://www.rossitubi.it/contatti"), phone=None)
        with patch("app.net_contact2_collector.examine", new=AsyncMock(return_value=found)), \
             patch("app.net_contact2_collector.mail_domain_status", new=AsyncMock(return_value="mx")):
            counts = await run_lot(db, [ITEM], pause=0)
        self.assertEqual(counts, {"sourced_channel": 1, "email_staged": 1})
        self.assertIn("netcontact1_stage_company_channel", [c[0] for c in db.calls])

    async def test_email_without_mx_is_dropped(self):
        db = FakeDb()
        found = dict(status="sourced_channel", pages=2,
                     email=("info@rossitubi.it", "https://www.rossitubi.it/contatti"), phone=None)
        with patch("app.net_contact2_collector.examine", new=AsyncMock(return_value=found)), \
             patch("app.net_contact2_collector.mail_domain_status", new=AsyncMock(return_value="no_mx")):
            counts = await run_lot(db, [ITEM], pause=0)
        self.assertEqual(counts, {"email_domain_without_mx": 1, "no_company_channel": 1})
        self.assertEqual([c[0] for c in db.calls], ["netcontact1_record_attempt"])
        self.assertEqual(db.calls[0][1]["p_outcome"], "no_company_channel")

    def test_only_known_rpcs(self):
        self.assertEqual(set(ALLOWED_RPCS), {"netcontact1_next_batch", "netcontact1_stage_company_channel",
                                             "netcontact1_record_attempt", "net_contact2_auto_publish"})


if __name__ == "__main__":
    unittest.main()
