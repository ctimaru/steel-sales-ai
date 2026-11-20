"""No-network contract tests for the Romania Overture discovery gate."""
from __future__ import annotations

import unittest
import os
from unittest.mock import patch
from app.net_ro_overture1_feed import (
    canonical_website, parse_place, stage_batches, RELEASE, CATEGORIES, MAX_BATCH, tile_for, MAX_PER_TILE, NAME_HINT_CATEGORY, NAME_HINT
)


class RomaniaOvertureTests(unittest.TestCase):
    def test_public_company_website_only(self) -> None:
        self.assertEqual(
            canonical_website("https://www.example-steel.ro/produse"),
            ("example-steel.ro", "https://example-steel.ro/")
        )
        self.assertIsNone(canonical_website("http://example-steel.ro/"))
        self.assertIsNone(canonical_website("https://facebook.com/brand"))
        self.assertIsNone(canonical_website("https://instagram.com/brand"))
        self.assertIsNone(canonical_website("https://a.example.com.evil/"))
        self.assertIsNone(canonical_website("https://example..ro/"))
        self.assertIsNone(canonical_website("https://username:pass@site.ro/"))

    def test_valid_industrial_private_lead(self) -> None:
        row = (
            "00000000-0000-4000-8000-000000000001",
            "ATELIER TUBURI SRL", "https://www.ateliertuburi.ro/",
            "metal_fabricator", "meta", None, 24.4, 45.9, 0.91,
        )
        parsed = parse_place(row)
        assert parsed is not None
        self.assertEqual(parsed["country"], "RO")
        self.assertEqual(parsed["domain"], "ateliertuburi.ro")
        self.assertEqual(parsed["license"], "CDLA-Permissive-2.0")
        self.assertNotIn("role_checked", parsed)
        self.assertNotIn("published", parsed)

    def test_reject_nonindustrial_and_unlicensed(self) -> None:
        base = [
            "00000000-0000-4000-8000-000000000001",
            "METAL LAB", "https://metal-lab.ro/",
            "metal_fabricator", "meta", None, 24.4, 45.9, 0.91,
        ]
        for index, replacement in [(3, "restaurant"), (5, "ODbL-1.0"),
                                   (6, 16.7), (7, 52.0), (8, 0.45)]:
            invalid = list(base)
            invalid[index] = replacement
            self.assertIsNone(parse_place(tuple(invalid)))

    def test_keyword_hints_never_verify_a_company(self) -> None:
        # Overture may misclassify a genuinely industrial company. Accept
        # only its name as a private research hint, not as an industrial proof.
        row = (
            "00000000-0000-4000-8000-000000000042",
            "SIDER METAL CNC SRL", "https://sidermetal-test.ro/",
            NAME_HINT_CATEGORY, "meta", None, 25.1, 46.2, 0.9,
        )
        candidate = parse_place(row)
        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate["category"], NAME_HINT_CATEGORY)
        self.assertNotIn("identity_checked", candidate)
        self.assertNotIn("published", candidate)
        self.assertTrue(NAME_HINT.search("METAL FABRICA"))
        nonindustrial = list(row)
        nonindustrial[1] = "Restaurant Cafe"
        self.assertIsNone(parse_place(tuple(nonindustrial)))

    def test_no_hotel_motel_or_bare_otel_keyword_leads(self) -> None:
        row = (
            "00000000-0000-4000-8000-000000000043",
            "Hotel Continental", "https://continentalhotels.ro/",
            NAME_HINT_CATEGORY, "meta", None, 23.1, 46.2, 0.99,
        )
        self.assertIsNone(parse_place(row))
        for label in (
            "Motel Steel Bar", "Cushman Echinox",
            "Aftar Stube", "Teaverse.bubbletea",
            "Epilare Laser Salon", "Muzeul Portilor de Fier",
        ):
            updated = list(row)
            updated[1] = label
            self.assertIsNone(parse_place(tuple(updated)), label)
        good = list(row)
        good[1] = "Rheinmetall Automecanica SRL"
        self.assertIsNotNone(parse_place(tuple(good)))
        good[1] = "Inoxprim SRL"
        self.assertIsNotNone(parse_place(tuple(good)))

    def test_not_a_manufacturing_laser_or_steel_name(self) -> None:
        # True false positives found during Romania Overture live canary.
        row = [
            "00000000-0000-4000-8000-000000000044",
            "", "https://sample-metal.ro/",
            NAME_HINT_CATEGORY, "meta", None, 24.5, 45.0, 0.95,
        ]
        for label in (
            "Laser Time", "Laser Dent Center", "Profiladent",
            "Clinica Estet Laser", "Metalul Buzau",
            "Metal Print Toner", "Rodetectors - Detectoare de Metale",
        ):
            row[1] = label
            self.assertIsNone(parse_place(tuple(row)), label)

        for label in ("Prodmetal I&S SRL", "TERRA CYCLE Kromm Metal",
                      "Dumitriu Metal", "Inoxprim SRL",
                      "Carpenterie Sudura Industrial"):
            row[1] = label
            self.assertIsNotNone(parse_place(tuple(row)), label)

    def test_eight_spatial_search_tiles(self) -> None:
        # Romanian bounding-box points are divided into eight nonoverlapping
        # retrieval tiles. The tiles are not legal administrative regions.
        tiles = {
            tile_for(x, y)
            for y in (44.5, 47.0)
            for x in (21.3, 23.5, 26.0, 29.0)
        }
        self.assertEqual(len(tiles), 8)
        self.assertEqual(tile_for(26.2, 44.7), "south-2")
        self.assertEqual(tile_for(22.4, 46.2), "north-0")
        self.assertGreater(MAX_PER_TILE, 0)
        self.assertLessEqual(MAX_PER_TILE, 200)

    def test_bounded_contract(self) -> None:
        self.assertIn("metal_fabricator", CATEGORIES)
        self.assertEqual(RELEASE, "2026-11-18.0")
        self.assertLessEqual(MAX_BATCH, 200)


    def test_stage_isolates_one_rejected_poi_without_bypassing_rpc(self) -> None:
        class Response:
            def __init__(self, status, body):
                self.status_code = status
                self.body = body

            def json(self):
                return self.body

        class Client:
            def __init__(self):
                self.calls = []

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def post(self, url, headers, json):
                domains = [item["domain"] for item in json["p_items"]]
                self.calls.append(domains)
                if "unrelated-retail.ro" in domains:
                    return Response(400, {
                        "message": "RO Overture stage: invalid source/country/domain/item"
                    })
                return Response(200, {
                    "contract": "net-ro-overture1-v1",
                    "release": RELEASE,
                    "received": len(domains),
                    "new_leads": len(domains),
                    "new_private_seeds": len(domains),
                    "published": 0,
                })

        client = Client()
        rows = [
            {"domain": "real-steel.ro"},
            {"domain": "unrelated-retail.ro"},
            {"domain": "welding-industrial.ro"},
        ]
        with patch.dict(os.environ, {
            "CRAWL_IT65B_SUPABASE_URL": "https://ecrafjdummcdfycznitx.supabase.co",
            "CRAWL_IT65B_SUPABASE_SECRET_KEY": "sb_secret_test",
        }), patch("httpx.Client", return_value=client):
            summary = stage_batches(rows)
        self.assertEqual(summary["received"], 2)
        self.assertEqual(summary["new_private_seeds"], 2)
        self.assertEqual(summary["new_leads"], 2)
        self.assertEqual(summary["rejected_invalid"], 1)
        self.assertEqual(summary["rejected_domains_sample"], ["unrelated-retail.ro"])
        self.assertGreater(len(client.calls), 1)

    def test_stage_fails_closed_on_other_database_error(self) -> None:
        class InvalidClient:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def post(self, *args, **kwargs):
                class Response:
                    status_code = 400

                    def json(self):
                        return {"message": "permission denied"}
                return Response()

        with patch.dict(os.environ, {
            "CRAWL_IT65B_SUPABASE_URL": "https://ecrafjdummcdfycznitx.supabase.co",
            "CRAWL_IT65B_SUPABASE_SECRET_KEY": "sb_secret_test",
        }), patch("httpx.Client", return_value=InvalidClient()):
            with self.assertRaisesRegex(RuntimeError, "RO Overture stage HTTP 400"):
                stage_batches([{"domain": "steel.ro"}])


if __name__ == "__main__":
    unittest.main()
