import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.net_it_autofeed import SOURCE_URL
from app.net_it_autofeed_worker import refill_from_configured_audit

SOURCE = {"url": SOURCE_URL, "id": "test-source", "max_links": 250}
AUDIT = ("domain,gers_id,area_bucket,overture_taxonomy,source_license,release\n"
         "valid.it,4d72bac6-6fd0-4220-bdb3-a728f782ce48,lombardia,metal_fabricator,"
         "CDLA-Permissive-2.0,2026-11-18.0\n").encode()


class Api:
    def __init__(self, contract="net-it-autofeed-stage-v1"):
        self.calls = []
        self.contract = contract

    async def call(self, name, payload):
        self.calls.append((name, payload))
        return {"contract": self.contract, "published": 0, "status": "ok",
                "received": 1, "staged": 1, "already_known": 0}


class WorkerTest(unittest.IsolatedAsyncioTestCase):
    def env(self, path, digest):
        return {"NET_IT_AUTOFEED_AUDIT_PATH": str(path),
                "NET_IT_AUTOFEED_AUDIT_SHA256": digest,
                "NET_IT_AUTOFEED_RELEASE": "2026-11-18.0",
                "NET_IT_AUTOFEED_AUDIT_URL":
                "https://github.com/ctimaru/steel-sales-ai/blob/" + "a"*40
                + "/services/worker/audits/test.csv"}

    async def test_no_configuration_no_write(self):
        api = Api()
        with patch.dict(os.environ, {}, clear=True):
            result = await refill_from_configured_audit(api, SOURCE)
        self.assertEqual(result["status"], "not_configured")
        self.assertFalse(api.calls)

    async def test_atomic_rpc_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "audit.csv"
            path.write_bytes(AUDIT)
            with patch.dict(os.environ, self.env(path, hashlib.sha256(AUDIT).hexdigest()), clear=True):
                api = Api()
                result = await refill_from_configured_audit(api, SOURCE)
                self.assertEqual(result["staged"], 1)
                self.assertEqual(api.calls[0][0], "net_it_autofeed_stage")
                self.assertEqual(api.calls[0][1]["p_items"][0]["domain"], "valid.it")
                with self.assertRaises(RuntimeError):
                    await refill_from_configured_audit(Api("old-contract"), SOURCE)

    async def test_digest_mismatch_no_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "audit.csv"
            path.write_bytes(AUDIT)
            api = Api()
            with patch.dict(os.environ, self.env(path, "0"*64), clear=True):
                result = await refill_from_configured_audit(api, SOURCE)
            self.assertEqual(result["status"], "invalid_audit")
            self.assertFalse(api.calls)
