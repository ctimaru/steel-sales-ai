import unittest

from app.net_it_autofeed import select_items

HEAD = "domain,gers_id,area_bucket,overture_taxonomy,source_license,release"
GERS = "4d72bac6-6fd0-4220-bdb3-a728f782ce48"
RELEASE = "2026-11-18.0"
AUDIT = "https://github.com/ctimaru/steel-sales-ai/blob/" + "a" * 40 + "/services/worker/audits/test.csv"


def row(domain, category="metal_fabricator", license="CDLA-Permissive-2.0",
        gers=GERS, release=RELEASE):
    return f"{domain},{gers},lombardia,{category},{license},{release}"


class AutoFeedTest(unittest.TestCase):
    def test_filter_and_dedup(self):
        rows = [HEAD, row("valid.it"), row("valid.it"), row("known.it"),
                row("other.it", "school"), row("legno.it"),
                row("wrong.it", license="unknown"), row("bad.it", gers="bad"),
                row("sub.valid.it"), row("old.it", release="2026-10-01.0")]
        items = select_items(rows, release=RELEASE, audit_url=AUDIT,
                             known_domains=["known.it"])
        self.assertEqual([i["domain"] for i in items], ["valid.it"])
        self.assertEqual(items[0]["gers_id"], GERS)
        self.assertEqual(items[0]["evidence"], AUDIT)
        self.assertNotIn("legal_name", items[0])

    def test_conflicting_identity_excluded(self):
        rows = [HEAD, row("valid.it"),
                row("valid.it", gers="4d72bac6-6fd0-4220-bdb3-a728f782ce49")]
        self.assertEqual(select_items(rows, release=RELEASE, audit_url=AUDIT), [])

    def test_bounds_and_immutable_source(self):
        rows = [HEAD, row("b.it"), row("a.it")]
        self.assertEqual(len(select_items(rows, release=RELEASE,
                                          audit_url=AUDIT, limit=1)), 1)
        with self.assertRaises(ValueError):
            select_items(rows, release=RELEASE, audit_url=AUDIT, limit=251)
        with self.assertRaises(ValueError):
            select_items(rows, release=RELEASE, audit_url=AUDIT.replace("a"*40, "main"))

    def test_resume_and_shortlinks(self):
        rows = [HEAD, row("b.it"), row("a.it"), row("goo.gl"), row("bit.ly")]
        self.assertEqual([i["domain"] for i in select_items(
            rows, release=RELEASE, audit_url=AUDIT, after_domain="a.it")], ["b.it"])
