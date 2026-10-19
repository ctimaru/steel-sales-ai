import unittest
from unittest.mock import AsyncMock,patch
from app.network_profile_batch import validated_seeds,run_batch

UID="00000000-0000-0000-0000-000000000123"
class BatchValidationTests(unittest.TestCase):
 def test_invalid_or_duplicate(self):
  with self.assertRaises(ValueError): validated_seeds([])
  with self.assertRaises(ValueError): validated_seeds([{"kind":"discovered","company_id":UID,"site":"https://example.com"}]*2)
  with self.assertRaises(ValueError): validated_seeds([{"kind":"discovered","company_id":UID,"site":"http://example.com"}])
  with self.assertRaises(ValueError): validated_seeds([{"kind":"discovered","company_id":UID,"site":"https://example.com"}]*26)

class BatchAcceptanceTests(unittest.IsolatedAsyncioTestCase):
 async def test_dry_run_never_persists(self):
  item={"kind":"discovered","company_id":UID,"site":"https://example.com"}
  fake={"status":"blocked_or_unavailable","pages":0,"candidates":[]}
  with patch("app.network_profile_batch.extract_site",new=AsyncMock(return_value=fake)),patch("app.network_profile_batch.persist_candidates") as save:
   result=await run_batch([item],persist=False,pause_seconds=0)
  self.assertEqual(result["processed"],1)
  self.assertEqual(result["published"],0)
  save.assert_not_called()

if __name__=="__main__": unittest.main()
