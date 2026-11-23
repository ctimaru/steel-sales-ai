"""Acceptance of automatic manufacturer activity; negative cases are essential."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from app.net_profile_prod1b import (
    identity_matches_domain, safe_official_source, source_backed_facts, run_cycle,
)


def page(text, *, url="https://www.itastahl.eu/prodotti/", meta=None):
    return SimpleNamespace(
        url=url, text=text, title="Itastahl - Prodotti",
        meta_description=meta, h1=None,
    )


class ManufacturerEvidenceTest(unittest.TestCase):
    def test_explicit_manufacturing_relations_only(self):
        p = page("La nostra azienda produce tubi e condotte per applicazioni industriali.")
        rows = source_backed_facts(p)
        self.assertEqual([row["field_key"] for row in rows], ["products", "description"])
        self.assertEqual(rows[0]["field_value"], ["Tubi e condotte"])
        self.assertIn("produzione di tubi e condotte", rows[1]["field_value"])
        self.assertIn("produce tubi", rows[0]["evidence_excerpt"])

    def test_manufacturer_cites_explicit_mixed_production_and_sales(self):
        p = page("", meta=("Produciamo e commercializziamo DIRETTAMENTE tubi "
                           "a sezione circolare e sagomata nelle dimensioni standard."))
        self.assertEqual(source_backed_facts(p)[0]["field_value"], ["Tubi e condotte"])

    def test_hollow_sections_from_specific_factory_phrase(self):
        p = page("Produzione di profilati in acciaio per strutture industriali e costruzioni.")
        self.assertEqual(source_backed_facts(p)[0]["field_value"], ["Profilati in acciaio"])

    def test_one_quote_must_support_every_product_label(self):
        p = page("Produciamo tubi per strutture industriali e costruzioni. "
                 "Fabbrichiamo anche stampi e portastampi per settore meccanico.")
        rows = source_backed_facts(p)
        self.assertEqual(rows[0]["field_value"], ["Tubi e condotte"])
        self.assertNotIn("Stampi e portastampi", rows[0]["field_value"])
        self.assertIn("tubi", rows[0]["evidence_excerpt"].lower())

    def test_machine_makers_must_not_be_mistaken_for_tube_manufacturers(self):
        for phrase in (
            "Produciamo macchine per la produzione di tubi saldati e profilati.",
            "Costruiamo impianti per la produzione di tubi in acciaio.",
            "Progettiamo linee e macchinari per la produzione di tubi.",
            "We manufacture machines for steel tube forming.",
        ):
            with self.subTest(phrase=phrase):
                self.assertEqual(source_backed_facts(page(phrase)), [])

    def test_distributor_and_keyword_mere_mentions_are_not_manufacture(self):
        for phrase in (
            "Vendita all'ingrosso e commercializzazione di tubi e profili.",
            "Distributori di tubi EN 10219 e lamiere S355.",
            "Offriamo tubi e nastri a magazzino. Scopri il catalogo.",
            "Qualità e tecnologia per la lavorazione di tubi.",
            "Azienda produttrice di macchine per la trafilatura di tubi.",
        ):
            with self.subTest(phrase=phrase):
                self.assertEqual(source_backed_facts(page(phrase)), [])

    def test_noise_and_private_channels_never_become_public_claims(self):
        self.assertEqual(source_backed_facts(page(
            "Cookie privacy — Produciamo tubi per uso industriale."
        )), [])
        rows = source_backed_facts(page(
            "Produciamo tubi per uso industriale. Contattaci: privacy@example.com."
        ))
        self.assertEqual(len(rows), 2)
        self.assertNotIn("privacy@example.com", str(rows))

    def test_cross_linked_identity_and_url_blocked(self):
        self.assertFalse(identity_matches_domain(
            "Ing. Nevio Bigollo Quality Manager SBE-VARVIT S.p.A.",
            None, "dectestingmachines.it"
        ))
        self.assertTrue(identity_matches_domain("Itastahl S.r.l.", None, "itastahl.eu"))
        self.assertFalse(safe_official_source(
            "https://www.itastahl.eu.evil.test/tubi", "itastahl.eu"
        ))
        self.assertFalse(safe_official_source(
            "https://user:pass@itastahl.eu/tubi", "itastahl.eu"
        ))
        self.assertFalse(safe_official_source(
            "http://www.itastahl.eu/tubi", "itastahl.eu"
        ))
        self.assertTrue(safe_official_source(
            "https://www.itastahl.eu/prodotti/", "itastahl.eu"
        ))


class ActivityCronTest(unittest.IsolatedAsyncioTestCase):
    async def test_default_dry_run_does_not_claim_or_write(self):
        db = Mock()
        result = await run_cycle(db)
        self.assertEqual(result["mode"], "dry_run")
        self.assertEqual(result["accepted_facts"], 0)
        db.rpc.assert_not_called()

    async def test_persist_only_explicit_firstparty_facts(self):
        db = Mock()
        calls = []
        uid = "00000000-0000-0000-0000-000000000123"
        token = "00000000-0000-0000-0000-000000000456"

        def rpc(name, args):
            calls.append((name, args))
            if name.endswith("_seed"):
                result = {"contract": "netprofile-prod1b-seed-v1", "added": 1}
            elif name.endswith("_claim"):
                result = {"contract": "netprofile-prod1b-claim-v1", "items": [{
                    "company_id": uid, "lease_token": token,
                    "legal_name": "Itastahl S.r.l.", "trading_name": None,
                    "site_url": "https://www.itastahl.eu/",
                    "canonical_domain": "itastahl.eu",
                    "product_url": "https://www.itastahl.eu/prodotti/",
                }]}
            else:
                result = {"contract": "netprofile-prod1b-complete-v1", "accepted": 2}
            response = Mock()
            response.execute.return_value.data = result
            return response
        db.rpc.side_effect = rpc
        p = page("Produciamo tubi per il settore industriale e per strutture in acciaio.")
        with patch("app.net_profile_prod1b._fetch_page", new=AsyncMock(return_value=p)):
            output = await run_cycle(db, persist=True, limit=1)
        self.assertEqual(output["accepted_facts"], 2)
        action, payload = calls[-1]
        self.assertEqual(action, "netprofile_prod1b_complete")
        self.assertEqual(payload["p_status"], "verified")
        self.assertEqual(len(payload["p_source_sha256"]), 64)
        self.assertEqual(len(payload["p_facts"]), 2)
        self.assertEqual(payload["p_source_url"], p.url)

    async def test_wrong_identity_fails_closed_without_fetch(self):
        db = Mock()
        calls = []

        def rpc(name, args):
            calls.append((name, args))
            payload = (
                {"contract": "netprofile-prod1b-seed-v1", "added": 1}
                if name.endswith("_seed") else
                {"contract": "netprofile-prod1b-claim-v1", "items": [{
                    "company_id": "00000000-0000-0000-0000-000000000123",
                    "lease_token": "00000000-0000-0000-0000-000000000456",
                    "legal_name": "Unrelated machinery company",
                    "trading_name": None,
                    "site_url": "https://itastahl.eu/",
                    "canonical_domain": "itastahl.eu",
                    "product_url": None,
                }]}
                if name.endswith("_claim") else
                {"contract": "netprofile-prod1b-complete-v1", "accepted": 0}
            )
            response = Mock()
            response.execute.return_value.data = payload
            return response
        db.rpc.side_effect = rpc
        with patch("app.net_profile_prod1b._fetch_page", new=AsyncMock()) as fetch:
            output = await run_cycle(db, persist=True, limit=1)
            fetch.assert_not_awaited()
        self.assertEqual(output["accepted_facts"], 0)
        self.assertEqual(calls[-1][1]["p_status"], "blocked")
        self.assertEqual(calls[-1][1]["p_facts"], [])


if __name__ == "__main__":
    unittest.main()
