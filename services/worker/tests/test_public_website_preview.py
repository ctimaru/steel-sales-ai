import unittest
from app.public_website_preview import normalize_seeds

class PublicWebsitePreviewTest(unittest.TestCase):
    def test_https_single(self):
        self.assertEqual(normalize_seeds("https://example.com/"), ["https://example.com/"])
    def test_reject_directory(self):
        with self.assertRaises(ValueError):
            normalize_seeds("https://www.europages.com")
    def test_reject_duplicate(self):
        with self.assertRaises(ValueError):
            normalize_seeds("https://example.com,https://www.example.com")
    def test_reject_private_ip(self):
        with self.assertRaises(ValueError):
            normalize_seeds("https://127.0.0.1")
    def test_reject_many(self):
        with self.assertRaises(ValueError):
            normalize_seeds(",".join("https://x%d.example.com" % n for n in range(6)))

if __name__ == "__main__":
    unittest.main()
