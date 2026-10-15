import unittest
from app.crawl_it610b_evidence import proposed_evidence

class ReviewEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.candidate={"canonical_domain":"example.it","website_url":"https://example.it/",
            "legal_name":"Example Tubi Srl","role_keys":["trader_distributor"],"confidence":0.79,
            "evidence":[{"url":"https://example.it/","snippet":"Tubi in acciaio"}],
            "facility_candidates":[{"country_code":"IT","city":"Brescia","province_code":"BS","region":"Lombardia","source_url":"https://example.it/"}]}
    def test_review_only(self):
        result=proposed_evidence(self.candidate,"lead-1")
        self.assertEqual(result["status"],"pending_review")
        self.assertTrue(result["human_approval_required"])
        self.assertEqual(result["geo_evidence"][0]["province_code"],"BS")
    def test_reject_external_evidence(self):
        self.candidate["evidence"]=[{"url":"https://other.it/"}]
        with self.assertRaises(ValueError):
            proposed_evidence(self.candidate,"lead-1")
    def test_reject_unknown_role(self):
        self.candidate["role_keys"]=["unverified"]
        with self.assertRaises(ValueError):
            proposed_evidence(self.candidate,"lead-1")
