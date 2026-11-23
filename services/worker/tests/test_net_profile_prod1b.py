"""Acceptance of automatic manufacturer activity; negative cases are essential."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from app.net_profile_prod1b import (
    identity_matches_domain, safe_official_source, source_backed_facts, run_cycle,
    _official_section_links, _queued_sources, MAX_SOURCE_PAGES,
)


def page(text, *, url="https://www.itastahl.eu/prodotti/", meta=None, links=()):
    return SimpleNamespace(
        url=url, text=text, title="Itastahl - Prodotti",
        meta_description=meta, h1=None, links=links,
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
        p = page("La nostra azienda è specializzata nella produzione di profilati in acciaio per strutture industriali.")
        self.assertEqual(source_backed_facts(p)[0]["field_value"], ["Profilati in acciaio"])

    def test_one_quote_must_support_every_product_label(self):
        p = page("Produciamo tubi per strutture industriali e costruzioni. "
                 "Fabbrichiamo anche stampi e portastampi per settore meccanico.")
        rows = source_backed_facts(p)
        self.assertEqual(rows[0]["field_value"], ["Tubi e condotte"])
        self.assertNotIn("Stampi e portastampi", rows[0]["field_value"])
        self.assertIn("tubi", rows[0]["evidence_excerpt"].lower())

    def test_explicit_workings_are_services_with_their_own_quote(self):
        p = page(
            "Produciamo tubi per applicazioni industriali e strutture saldate. "
            "Eseguiamo taglio laser, saldatura e calandratura conto terzi."
        )
        rows = source_backed_facts(p)
        self.assertEqual([r["field_key"] for r in rows],
                         ["products", "description", "services"])
        self.assertEqual(rows[0]["field_value"], ["Tubi e condotte"])
        self.assertEqual(rows[2]["field_value"],
                         ["Taglio laser", "Saldatura", "Calandratura"])
        self.assertIn("Eseguiamo taglio laser", rows[2]["evidence_excerpt"])
        self.assertNotIn("calandratura", rows[0]["evidence_excerpt"].lower())

    def test_services_without_product_claims_are_visible_but_not_manufactured(self):
        rows = source_backed_facts(page(
            "Siamo specializzati nella saldatura e nelle lavorazioni meccaniche "
            "per applicazioni industriali."
        ))
        self.assertEqual([r["field_key"] for r in rows],
                         ["description", "services"])
        self.assertEqual(rows[1]["field_value"],
                         ["Saldatura", "Lavorazioni meccaniche"])

    def test_workings_are_not_inferred_from_navigation_or_machinery(self):
        for text in (
            "Prodotti Produzione Lavorazioni Taglio laser Saldatura Servizi.",
            "Macchine e impianti per saldatura e taglio laser, e assistenza.",
            "I nostri partner eseguono taglio laser e piegatura metalli.",
            "Vendita e distribuzione di macchinari per il taglio laser.",
        ):
            with self.subTest(text=text):
                self.assertEqual(source_backed_facts(page(text)), [])

    def test_official_paths_prioritize_workings_and_reject_foreign_or_docs(self):
        home = page("", url="https://www.tomatislamiere.it/",
                    links=(
                        "/lavorazioni-metalli/taglio-laser-tubo/",
                        "/prodotti/",
                        "/lavorazioni-metalli/",
                        "https://evil.example.com/produzione/",
                        "//www.tomatislamiere.it.evil.test/produzione/",
                        "/certificazioni/",
                        "/sistema-qualita/",
                        "/files/tubi-catalogo.pdf",
                        "/news/produzione-tubi/",
                        "/privacy/",
                        "/contatti/",
                        "mailto:commerciale@example.com",
                    ))
        links = _official_section_links(home, "tomatislamiere.it")
        self.assertEqual(links, [
            "https://www.tomatislamiere.it/lavorazioni-metalli/taglio-laser-tubo/",
            "https://www.tomatislamiere.it/prodotti/",
            "https://www.tomatislamiere.it/lavorazioni-metalli/",
        ])
        self.assertTrue(all("evil" not in url for url in links))

    def test_indexed_sources_reject_pdf_privacy_and_crosslinked_domains(self):
        item = {
            "product_urls": [
                "https://officineruboni.it/lavorazioni-carpenteria-metallica/",
                "https://officineruboni.it/certificazioni/",
                "https://officineruboni.it/schede/catalogo.pdf",
                "https://evil.com/lavorazioni/",
                "https://officineruboni.it/lavorazioni-carpenteria-metallica/",
            ],
        }
        self.assertEqual(_queued_sources(
            item, "https://officineruboni.it/", "officineruboni.it"
        ), ["https://officineruboni.it/lavorazioni-carpenteria-metallica/"])


    def test_tube_cutting_does_not_claim_tube_manufacturing(self):
        rows = source_backed_facts(page(
            "Realizziamo taglio laser su tubi e profili in acciaio, "
            "con lavorazioni su disegno dei clienti."
        ))
        self.assertEqual([r["field_key"] for r in rows],
                         ["description", "services"])
        self.assertEqual(rows[-1]["field_value"], ["Taglio laser"])

    def test_product_end_use_does_not_become_another_manufactured_family(self):
        cases = {
            "Produciamo lamiere per strutture metalliche e carpenteria industriale.":
                ["Lamiere"],
            "Produciamo stampi per tubi e condotte industriali.":
                ["Stampi e portastampi"],
            "Produciamo profilati in acciaio destinati a strutture metalliche.":
                ["Profilati in acciaio"],
            "Produciamo tubi e lamiere per applicazioni industriali.":
                ["Tubi e condotte", "Lamiere"],
        }
        for sentence, expected in cases.items():
            with self.subTest(sentence=sentence):
                facts = source_backed_facts(page(sentence))
                self.assertEqual(facts[0]["field_key"], "products")
                self.assertEqual(facts[0]["field_value"], expected)

    def test_working_end_use_is_not_a_separate_offered_working(self):
        facts = source_backed_facts(page(
            "Eseguiamo taglio laser e saldatura per carpenteria metallica "
            "e strutture industriali su specifica del cliente."
        ))
        self.assertEqual(facts[-1]["field_key"], "services")
        self.assertEqual(facts[-1]["field_value"], ["Taglio laser", "Saldatura"])
        self.assertNotIn("products", [x["field_key"] for x in facts])


    def test_moulds_for_tube_production_are_not_tube_products(self):
        rows = source_backed_facts(page(
            "Produciamo stampi e portastampi per la produzione di tubi "
            "ad uso industriale."
        ))
        self.assertEqual(rows[0]["field_value"], ["Stampi e portastampi"])
        self.assertNotIn("Tubi e condotte", rows[0]["field_value"])


    def test_isolated_menu_production_labels_never_prove_manufacturing(self):
        # Real canary 23 Nov: this is a menu flattened into page text,
        # previously (wrongly) cited as manufacturing evidence on /fresatura/.
        for navigation in (
            "Bonacina Officina Prodotti Barre filettate Cavallotti "
            "Tirafondi Produzione di viti testa a martello Produzione "
            "tirafondi DIN 529 Tiranti Tiranti per l'edilizia",
            "Prodotti Produzione di profilati in acciaio Lavorazioni Contatti",
            "Produzione di viti e bulloneria per applicazioni industriali.",
        ):
            with self.subTest(nav=navigation):
                self.assertEqual(source_backed_facts(page(navigation)), [])

    def test_passive_manufacturing_inside_explicit_company_clause(self):
        rows = source_backed_facts(page(
            "La nostra azienda è specializzata nella produzione di "
            "viti e bulloneria per strutture industriali."
        ))
        self.assertEqual(rows[0]["field_key"], "products")
        self.assertEqual(rows[0]["field_value"], ["Viti e bulloneria"])
        self.assertIn("produzione di viti", rows[0]["evidence_excerpt"])

    def test_third_person_produce_requires_exact_company_subject(self):
        self.assertEqual(source_backed_facts(page(
            "Il partner tecnologico produce tubi e condotte industriali."
        )), [])
        rows = source_backed_facts(page(
            "La nostra azienda produce tubi e condotte industriali."
        ))
        self.assertEqual(rows[0]["field_value"], ["Tubi e condotte"])

    def test_non_steel_profiles_and_bars_never_get_steel_family_labels(self):
        for phrase in (
            "Produciamo barre in ottone per applicazioni industriali.",
            "Produciamo barre tonde in alluminio e leghe leggere.",
            "Produciamo profilati in alluminio per serramenti.",
            "We manufacture aluminum profiles and brass bars.",
        ):
            with self.subTest(phrase=phrase):
                self.assertEqual(source_backed_facts(page(phrase)), [])

    def test_steel_labels_require_material_linked_to_product(self):
        cases = {
            "Produciamo profilati in acciaio per strutture industriali.":
                ["Profilati in acciaio"],
            "Produciamo barre in acciaio per applicazioni meccaniche.":
                ["Barre in acciaio"],
            "We manufacture steel profiles for industrial applications.":
                ["Profilati in acciaio"],
            "Produciamo barre in ottone e profilati in acciaio.":
                ["Profilati in acciaio"],
        }
        for phrase, expected in cases.items():
            with self.subTest(phrase=phrase):
                actual=source_backed_facts(page(phrase))
                self.assertTrue(actual)
                self.assertEqual(actual[0]["field_value"], expected)

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
            "I nostri fornitori producono tubi per applicazioni strutturali.",
            "Le aziende partner producono profilati e barre in acciaio.",
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

    async def test_real_product_subpages_discover_one_level_deeper(self):
        db = Mock()
        calls = []
        uid = "00000000-0000-0000-0000-000000000124"
        token = "00000000-0000-0000-0000-000000000457"

        def rpc(name, args):
            calls.append((name, args))
            if name.endswith("_seed"):
                data = {"contract": "netprofile-prod1b-seed-v1", "added": 0}
            elif name.endswith("_claim"):
                data = {"contract": "netprofile-prod1b-claim-v1", "items": [{
                    "company_id": uid, "lease_token": token,
                    "legal_name": "Officine Ruboni S.r.l.", "trading_name": None,
                    "site_url": "https://officineruboni.it/",
                    "canonical_domain": "officineruboni.it",
                    "product_urls": [
                        "https://officineruboni.it/lavorazioni/",
                    ],
                }]}
            else:
                data = {"contract": "netprofile-prod1b-complete-v1", "accepted": 2}
            response = Mock()
            response.execute.return_value.data = data
            return response
        db.rpc.side_effect = rpc
        found = []
        pages = {
            "https://officineruboni.it/": page(
                "Officine Ruboni: carpenteria e lavorazioni su richiesta.",
                url="https://officineruboni.it/",
                links=("/lavorazioni/", "https://evil.test/lavorazioni/"),
            ),
            "https://officineruboni.it/lavorazioni/": page(
                "Scopri i nostri reparti e tecnologie.",
                url="https://officineruboni.it/lavorazioni/",
                links=("/lavorazioni-carpenteria-metallica/",),
            ),
            "https://officineruboni.it/lavorazioni-carpenteria-metallica/": page(
                "Eseguiamo saldatura e lavorazioni meccaniche su componenti "
                "per l'industria.",
                url="https://officineruboni.it/lavorazioni-carpenteria-metallica/",
            ),
        }

        async def fake_fetch(_client, url, _site):
            found.append(url)
            return pages.get(url)

        with patch("app.net_profile_prod1b._fetch_page", side_effect=fake_fetch):
            result = await run_cycle(db, persist=True, limit=1)

        self.assertEqual(result["accepted_facts"], 2)
        self.assertEqual(found, list(pages.keys()))
        args = calls[-1][1]
        self.assertEqual(args["p_status"], "verified")
        self.assertEqual(args["p_source_url"],
                         "https://officineruboni.it/lavorazioni-carpenteria-metallica/")
        self.assertEqual([x["field_key"] for x in args["p_facts"]],
                         ["description", "services"])
        self.assertEqual(args["p_facts"][-1]["field_value"],
                         ["Saldatura", "Lavorazioni meccaniche"])

    async def test_production_page_beats_workings_page_without_mixing_sources(self):
        db = Mock()
        captured = []
        def rpc(name, args):
            captured.append((name, args))
            if name.endswith("_seed"):
                data = {"contract": "netprofile-prod1b-seed-v1", "added": 0}
            elif name.endswith("_claim"):
                data = {"contract": "netprofile-prod1b-claim-v1", "items": [{
                    "company_id": "00000000-0000-0000-0000-000000000126",
                    "lease_token": "00000000-0000-0000-0000-000000000459",
                    "legal_name": "Officine Ruboni S.r.l.",
                    "site_url": "https://officineruboni.it/",
                    "canonical_domain": "officineruboni.it",
                    "product_urls": [
                        "https://officineruboni.it/lavorazioni/",
                        "https://officineruboni.it/produzione/",
                    ]
                }]}
            else:
                data = {"contract": "netprofile-prod1b-complete-v1", "accepted": 2}
            result = Mock()
            result.execute.return_value.data = data
            return result
        db.rpc.side_effect = rpc
        pages = {
            "https://officineruboni.it/": page(
                "Benvenuti nel nostro sito industriale.", url="https://officineruboni.it/"),
            "https://officineruboni.it/lavorazioni/": page(
                "Eseguiamo taglio laser per commesse meccaniche su disegno.",
                url="https://officineruboni.it/lavorazioni/"),
            "https://officineruboni.it/produzione/": page(
                "Produciamo tubi per applicazioni industriali e strutture.",
                url="https://officineruboni.it/produzione/"),
        }
        with patch("app.net_profile_prod1b._fetch_page",
                   side_effect=lambda _client, url, _base: pages[url]):
            out = await run_cycle(db, persist=True, limit=1)
        self.assertEqual(out["accepted_facts"], 2)
        payload = captured[-1][1]
        self.assertEqual(payload["p_source_url"],
                         "https://officineruboni.it/produzione/")
        self.assertEqual([x["field_key"] for x in payload["p_facts"]],
                         ["products", "description"])
        self.assertEqual(payload["p_facts"][0]["field_value"], ["Tubi e condotte"])

    async def test_bounded_source_budget_and_no_implicit_product_claim(self):
        db = Mock()
        calls = []

        def rpc(name, args):
            calls.append((name, args))
            if name.endswith("_seed"):
                data = {"contract": "netprofile-prod1b-seed-v1", "added": 0}
            elif name.endswith("_claim"):
                data = {"contract": "netprofile-prod1b-claim-v1", "items": [{
                    "company_id": "00000000-0000-0000-0000-000000000125",
                    "lease_token": "00000000-0000-0000-0000-000000000458",
                    "legal_name": "Officine Ruboni S.r.l.",
                    "site_url": "https://officineruboni.it/",
                    "canonical_domain": "officineruboni.it",
                    "product_urls": [f"https://officineruboni.it/lavorazioni/{i}"
                                     for i in range(30)],
                }]}
            else:
                data = {"contract": "netprofile-prod1b-complete-v1", "accepted": 0}
            result = Mock()
            result.execute.return_value.data = data
            return result
        db.rpc.side_effect = rpc
        fetch = AsyncMock(side_effect=lambda _client, url, _base: page(
            "Produzione Lavorazioni Taglio laser Contattaci",
            url=url, links=("/certificazioni/",)
        ))
        with patch("app.net_profile_prod1b._fetch_page", fetch):
            out = await run_cycle(db, persist=True, limit=1)
        self.assertLessEqual(fetch.await_count, MAX_SOURCE_PAGES)
        self.assertEqual(out["accepted_facts"], 0)
        self.assertEqual(calls[-1][1]["p_status"], "no_evidence")


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
