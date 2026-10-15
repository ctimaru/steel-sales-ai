import os
import unittest
from unittest.mock import patch

from app.approved_source_batch import run


class ApprovedSourceBatchTests(unittest.IsolatedAsyncioTestCase):
    async def test_disabled_by_default(self):
        with patch.dict(os.environ, {"CRAWL_IT68_ENABLED": "false"}):
            with self.assertRaises(RuntimeError):
                await run(1)

    async def test_limits_not_expanded(self):
        with patch.dict(os.environ, {"CRAWL_IT68_ENABLED": "true"}):
            with self.assertRaises(ValueError):
                await run(4)

    async def test_stages_only_without_publishing(self):
        from unittest.mock import AsyncMock
        with patch.dict(os.environ, {"CRAWL_IT68_ENABLED": "true"}):
            with patch("app.approved_source_batch.harvest_once", new_callable=AsyncMock) as fn:
                fn.side_effect = [7, 3]
                result = await run(2)
                self.assertEqual(result["staged_leads"], 10)
                self.assertEqual(result["published"], 0)
                self.assertEqual(fn.await_count, 2)
