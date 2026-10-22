#!/usr/bin/env python3
"""Offline guard tests: no network/database or secrets used."""
import importlib.util
import pathlib
import unittest

BASE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("c4b_accept", BASE / "c4b_accept_promotion.py")
assert spec is not None and spec.loader is not None
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


class C4BPromotionGuardTests(unittest.TestCase):
    def test_staging_direct_and_pooler(self):
        direct = "postgresql://postgres:pw%40test@db.lwrrrphakpbjhbzljqhn.supabase.co:5432/postgres?sslmode=require"
        pooler = "postgresql://postgres.lwrrrphakpbjhbzljqhn:pw%40test@aws-0-eu-west-3.pooler.supabase.com:6543/postgres"
        self.assertEqual(tool.validate_connection(direct, "staging"), direct)
        self.assertEqual(tool.validate_connection(pooler, "staging"), pooler)

    def test_production_target_never_accepted_as_staging(self):
        production = "postgresql://postgres:secret@db.ecrafjdummcdfycznitx.supabase.co:5432/postgres"
        with self.assertRaises(ValueError):
            tool.validate_connection(production, "staging")
        self.assertEqual(tool.validate_connection(production, "production"), production)

    def test_cross_env_and_bad_urls_fail_closed(self):
        failures = ["", "http://example.org", "postgresql://postgres:pw@evil.example.org:5432/postgres",
                    "postgresql://postgres:pw@db.lwrrrphakpbjhbzljqhn.supabase.co:5433/postgres",
                    "postgresql://postgres:[password]@db.lwrrrphakpbjhbzljqhn.supabase.co:5432/postgres",
                    "postgresql://postgres:pw@db.lwrrrphakpbjhbzljqhn.supabase.co:5432/template1"]
        for value in failures:
            with self.subTest(url=value), self.assertRaises(ValueError):
                tool.validate_connection(value, "staging")

    def test_atomic_one_version_one_migration_only(self):
        sql = "create table public.c4b_example (id uuid);"
        statement = tool.promotion_transaction(sql)
        self.assertTrue(statement.startswith("begin;"))
        self.assertTrue(statement.rstrip().endswith("commit;"))
        self.assertIn("pg_advisory_xact_lock", statement)
        self.assertIn(tool.MIGRATION_VERSION, statement)
        self.assertIn(tool.MIGRATION_NAME, statement)
        self.assertIn("supabase_migrations.schema_migrations", statement)
        self.assertIn(sql, statement)
        self.assertNotIn("supabase db push", statement.lower())


if __name__ == "__main__":
    unittest.main()
