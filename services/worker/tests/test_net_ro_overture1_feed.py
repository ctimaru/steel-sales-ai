"""No-network contract tests for the Romania Overture discovery gate."""
from __future__ import annotations

import unittest
from app.net_ro_overture1_feed import (
    canonical_website, parse_place, RELEASE, CATEGORIES, MAX_BATCH, tile_for, MAX_PER_TILE
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


if __name__ == "__main__":
    unittest.main()
