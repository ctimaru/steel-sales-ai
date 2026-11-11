"""NET-IT-SEED1 test: index pages are pointers only; nothing is published."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.net_it_seed1_pipeline import (
    MAX_LINKS_PER_SOURCE, MAX_PROFILE_PAGES_PER_SOURCE, SeedApi, crawl, harvest,
    inspect_site, looks_italian, outbound_company_domains, profile_links,
    two_level_items,
)

SOURCE = "https://www.associazione-esempio.it/soci"


def page(url, links=(), text=""):
    return SimpleNamespace(url=url, title=None, site_name=None, meta_description=None,
                           h1=None, text=text, links=tuple(links), structured_data=())


class OutboundDomainsTest(unittest.TestCase):
    def test_keeps_only_external_https_company_domains_once(self):
        found = outbound_company_domains(SOURCE, [
            "https://www.carpenteriauno.it/chi-siamo",
            "https://carpenteriauno.it/contatti",          # same company, once
            "/soci/pagina-2",                               # the index itself
            "https://eventi.associazione-esempio.it/",      # index subdomain
            "http://tubidue.it/",                           # not https
            "https://www.facebook.com/carpenteriauno",      # platform
            "https://it.linkedin.com/company/x",            # platform subdomain
            "https://www.paginegialle.it/x",                # directory
            "https://user:pw@tubitre.it/",                  # credentials
            "https://tubiquattro.it:8443/",                 # custom port
            "mailto:info@carpenteriauno.it",
            "https://www.acciaicinque.com/it/",
        ], 300)
        self.assertEqual([i["domain"] for i in found],
                         ["carpenteriauno.it", "acciaicinque.com"])
        self.assertEqual(found[0]["url"], "https://www.carpenteriauno.it/")
        self.assertEqual({i["evidence"] for i in found}, {SOURCE})
        self.assertEqual(set(found[0]), {"domain", "url", "evidence"})

    def test_limit_is_bounded(self):
        links = [f"https://azienda{i}.it/" for i in range(MAX_LINKS_PER_SOURCE + 50)]
        self.assertEqual(len(outbound_company_domains(SOURCE, links, 10)), 10)
        self.assertEqual(len(outbound_company_domains(SOURCE, links, 10**6)),
                         MAX_LINKS_PER_SOURCE)

    def test_italian_filter(self):
        self.assertTrue(looks_italian("carpenteriauno.it", {}))
        self.assertTrue(looks_italian("acciaicinque.com", {"vat_id": "IT 01234567890"}))
        self.assertTrue(looks_italian("acciaicinque.com", {"vat_id": "01234567890"}))
        self.assertFalse(looks_italian("stahlwerk.de", {"vat_id": "DE123456789"}))
        self.assertFalse(looks_italian("acciaicinque.com", {}))


class ProfileLinksTest(unittest.TestCase):
    def test_only_same_site_profiles_below_index_or_hinted(self):
        found = profile_links(SOURCE, [
            "/soci/carpenteria-uno",                 # below the index
            "https://www.associazione-esempio.it/soci/tubi-due/",
            "/soci/carpenteria-uno",                 # duplicate
            "/espositori/acciai-tre",                # directory hint
            "/soci?page=2",                          # query: pagination
            "/soci/pagina/3",                        # pagination
            "/soci/login",                           # not a profile
            "/news/assemblea-2026",                  # unrelated page
            "/chi-siamo",                            # unrelated page
            "https://www.carpenteriauno.it/",        # external: level one, not here
            "http://www.associazione-esempio.it/soci/x",  # not https
        ], 300)
        self.assertEqual(found, [
            "https://www.associazione-esempio.it/soci/carpenteria-uno",
            "https://www.associazione-esempio.it/soci/tubi-due/",
            "https://www.associazione-esempio.it/espositori/acciai-tre",
        ])

    def test_profile_limit_is_bounded(self):
        links = [f"/soci/azienda-{i}" for i in range(MAX_PROFILE_PAGES_PER_SOURCE + 40)]
        self.assertEqual(len(profile_links(SOURCE, links, 5)), 5)
        self.assertEqual(len(profile_links(SOURCE, links, 10**6)), MAX_PROFILE_PAGES_PER_SOURCE)


class FakeApi:
    def __init__(self, replies):
        self.replies, self.calls = replies, []

    async def call(self, name, payload):
        self.calls.append((name, payload))
        reply = self.replies[name]
        return reply.pop(0) if isinstance(reply, list) else reply


class PipelineTest(unittest.IsolatedAsyncioTestCase):
    async def test_dry_run_claims_nothing(self):
        api = FakeApi({})
        self.assertEqual((await harvest(api, None, max_sources=5, persist=False))["sources"], 0)
        self.assertEqual((await crawl(api, None, limit=50, persist=False))["visited"], 0)
        self.assertEqual(api.calls, [])

    async def test_rpc_allowlist(self):
        api = SeedApi(None, "https://example.supabase.co", "k" * 40)
        with self.assertRaises(ValueError):
            await api.call("net_it_auto3_set_policy", {})

    async def test_harvest_stages_only_domains(self):
        api = FakeApi({
            "net_it_seed1_claim_sources": {"contract": "net-it-seed1-sources-v1", "status": "ok",
                "items": [{"id": "s1", "url": SOURCE, "max_links": 300}]},
            "net_it_seed1_stage": {"contract": "net-it-seed1-stage-v1", "staged": 1,
                "already_known": 0, "published": 0},
        })
        index = page(SOURCE, ["https://www.carpenteriauno.it/", "https://www.facebook.com/x"],
                     text="Mario Rossi, titolare, tel. 333 0000000")
        with patch("app.net_it_seed1_pipeline._fetch_page", new=AsyncMock(return_value=index)):
            report = await harvest(api, None, max_sources=5, persist=True)
        self.assertEqual(report["staged"], 1)
        staged = dict(api.calls)["net_it_seed1_stage"]
        self.assertEqual(staged["p_items"], [{"domain": "carpenteriauno.it",
            "url": "https://www.carpenteriauno.it/", "evidence": SOURCE}])
        self.assertNotIn("Rossi", str(api.calls))

    async def test_robots_refusal_of_index_is_respected(self):
        api = FakeApi({"net_it_seed1_claim_sources": {"contract": "net-it-seed1-sources-v1",
            "status": "ok", "items": [{"id": "s1", "url": SOURCE, "max_links": 300}]}})
        with patch("app.net_it_seed1_pipeline._fetch_page", new=AsyncMock(return_value=None)):
            report = await harvest(api, None, max_sources=5, persist=True)
        self.assertEqual((report["unreadable"], report["staged"]), (1, 0))
        self.assertEqual([c[0] for c in api.calls], ["net_it_seed1_claim_sources"])

    async def test_site_redirecting_elsewhere_is_not_a_candidate(self):
        item = {"domain": "carpenteriauno.it", "url": "https://www.carpenteriauno.it/"}
        with patch("app.net_it_seed1_pipeline._fetch_page",
                   new=AsyncMock(return_value=page("https://altra-azienda.it/"))):
            outcome, candidate, _ = await inspect_site(None, item)
        self.assertEqual((outcome, candidate), ("no_candidate", None))

    async def test_foreign_site_is_dropped(self):
        item = {"domain": "stahlwerk.de", "url": "https://www.stahlwerk.de/"}
        with patch("app.net_it_seed1_pipeline._fetch_page",
                   new=AsyncMock(return_value=page("https://www.stahlwerk.de/"))), \
             patch("app.net_it_seed1_pipeline.extract_candidate",
                   return_value={"legal_name": "Stahlwerk GmbH", "vat_id": None}):
            outcome, candidate, _ = await inspect_site(None, item)
        self.assertEqual((outcome, candidate), ("not_italian", None))

    async def test_crawl_records_each_site_and_always_closes_the_run(self):
        api = FakeApi({
            "net_it_seed1_claim_batch": [
                {"contract": "net-it-seed1-batch-v1", "status": "ok", "run_id": "r1",
                 "items": [{"domain": "carpenteriauno.it", "url": "https://www.carpenteriauno.it/"}]},
                {"contract": "net-it-seed1-batch-v1", "status": "queue_empty", "items": []}],
            "net_it_seed1_record": {"contract": "net-it-seed1-record-v1",
                                     "outcome": "candidate", "published": 0},
            "net_it_seed1_finish_batch": {"contract": "net-it-seed1-finish-v1"},
        })
        with patch("app.net_it_seed1_pipeline.inspect_site", new=AsyncMock(
                return_value=("candidate", {"legal_name": "Carpenteria Uno S.r.l."}, None))):
            report = await crawl(api, None, limit=200, persist=True)
        self.assertEqual((report["visited"], report["candidates"], report["published"]), (1, 1, 0))
        self.assertIn("net_it_seed1_finish_batch", [c[0] for c in api.calls])


class TwoLevelHarvestTest(unittest.IsolatedAsyncioTestCase):
    def profiles(self):
        base = "https://www.associazione-esempio.it/soci/"
        sponsor = "https://www.sponsor-fiera.it/"
        return {
            SOURCE: page(SOURCE, [f"/soci/azienda-{i}" for i in range(6)]
                         + ["https://www.facebook.com/assoc"]),
            **{f"{base}azienda-{i}": page(f"{base}azienda-{i}",
                [f"https://www.azienda{i}.it/", sponsor, "https://www.linkedin.com/x"],
                text="Referente: Mario Rossi") for i in range(5)},
            f"{base}azienda-5": page(f"{base}azienda-5", [sponsor]),   # only the sponsor
        }

    async def test_follows_profiles_keeps_company_site_drops_sponsor(self):
        pages = self.profiles()
        async def fake_fetch(client, url, base):
            return pages.get(url)
        with patch("app.net_it_seed1_pipeline._fetch_page", new=fake_fetch):
            items, read = await two_level_items(None, SOURCE, pages[SOURCE].links, 300,
                                                pause_seconds=0)
        self.assertEqual(read, 6)
        self.assertEqual([i["domain"] for i in items], [f"azienda{i}.it" for i in range(5)])
        self.assertEqual(items[0]["evidence"],
                         "https://www.associazione-esempio.it/soci/azienda-0")
        self.assertNotIn("sponsor-fiera.it", str(items))
        self.assertEqual(set(items[0]), {"domain", "url", "evidence"})

    async def test_harvest_uses_two_levels_only_when_index_links_few_sites(self):
        pages = self.profiles()
        async def fake_fetch(client, url, base):
            return pages.get(url)
        api = FakeApi({
            "net_it_seed1_claim_sources": {"contract": "net-it-seed1-sources-v1", "status": "ok",
                "items": [{"id": "s1", "url": SOURCE, "max_links": 300}]},
            "net_it_seed1_stage": {"contract": "net-it-seed1-stage-v1", "staged": 5,
                "already_known": 0, "published": 0},
        })
        with patch("app.net_it_seed1_pipeline._fetch_page", new=fake_fetch), \
             patch("app.net_it_seed1_pipeline.PROFILE_PAUSE_SECONDS", 0):
            report = await harvest(api, None, max_sources=5, persist=True)
        self.assertEqual((report["profiles_read"], report["links_found"], report["published"]),
                         (6, 5, 0))
        staged = dict(api.calls)["net_it_seed1_stage"]["p_items"]
        self.assertEqual(len(staged), 5)
        self.assertNotIn("Rossi", str(api.calls))

        # An index that already links many websites directly is not crawled deeper.
        direct = page(SOURCE, [f"https://www.diretta{i}.it/" for i in range(12)]
                      + [f"/soci/azienda-{i}" for i in range(6)])
        fetched = []
        async def count_fetch(client, url, base):
            fetched.append(url)
            return direct
        api2 = FakeApi({
            "net_it_seed1_claim_sources": {"contract": "net-it-seed1-sources-v1", "status": "ok",
                "items": [{"id": "s1", "url": SOURCE, "max_links": 300}]},
            "net_it_seed1_stage": {"contract": "net-it-seed1-stage-v1", "staged": 12,
                "already_known": 0, "published": 0},
        })
        with patch("app.net_it_seed1_pipeline._fetch_page", new=count_fetch):
            report2 = await harvest(api2, None, max_sources=5, persist=True)
        self.assertEqual((fetched, report2["profiles_read"]), ([SOURCE], 0))


if __name__ == "__main__":
    unittest.main()
