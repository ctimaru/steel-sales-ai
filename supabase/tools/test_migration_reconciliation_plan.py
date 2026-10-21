"""SUPA-LEDGER5 fail-closed offline reconciliation unit tests."""
from __future__ import annotations

from hashlib import sha256
import unittest

from migration_reconciliation_plan import assess


def entry(version: str, name: str, sql: bytes) -> dict:
    return {
        "version": version,
        "name": name,
        "sha256": sha256(sql).hexdigest(),
        "bytes": len(sql),
    }


class ConservativeReconciliationTests(unittest.TestCase):
    def test_one_identical_version_is_retained_without_repair(self):
        src = entry("20261021010000", "known_good", b"SELECT 1;")
        plan = assess([src], [src])
        self.assertEqual(plan["local_assessment"][0]["decision"],
                         "RETAIN_EXACT_NO_ACTION")
        self.assertFalse(plan["safe_for_automatic_repair"])
        self.assertFalse(plan["history_mutations_allowed"])
        self.assertEqual(plan["repair_commands"], [])

    def test_same_sql_different_version_is_held(self):
        local = entry("20261021020000", "role_gate", b"CREATE TABLE x(id int);")
        remote = entry("20261021010000", "role_gate", b"CREATE TABLE x(id int);")
        row = assess([local], [remote])["local_assessment"][0]
        self.assertEqual(row["decision"], "HOLD_SAME_SQL_VERSION_MISMATCH")
        self.assertFalse(row["repair_authorized"])
        self.assertEqual(row["identical_sql_remote_versions"], [remote["version"]])

    def test_collision_takes_precedence_even_for_same_sql(self):
        local = entry("20261021030000", "policy_fix", b"SELECT 1;")
        existing = entry("20261021030000", "different_migration", b"SELECT 2;")
        same_name = entry("20261021010000", "policy_fix", b"SELECT 1;")
        result = assess([local], [same_name, existing])
        self.assertEqual(result["local_assessment"][0]["decision"], "HOLD_VERSION_COLLISION")
        self.assertEqual(result["local_assessment"][0]["remote_names_at_local_version"],
                         ["different_migration"])
        self.assertEqual(result["repair_commands"], [])

    def test_duplicate_names_both_sides_are_never_automatically_paired(self):
        local = [entry("20261021010000", "dup", b"A"),
                 entry("20261021020000", "dup", b"B")]
        remote = [entry("20261021010000", "dup", b"A"),
                  entry("20261021025000", "dup", b"C")]
        result = assess(local, remote)
        self.assertTrue(all(x["decision"] == "HOLD_AMBIGUOUS_NAME"
                            for x in result["local_assessment"]))
        self.assertEqual(result["summary"]["local_duplicate_names"], 1)
        self.assertEqual(result["summary"]["remote_duplicate_names"], 1)

    def test_semantic_change_and_orphans_are_held(self):
        local = [entry("20261021020000", "sql_change", b"SELECT 2;"),
                 entry("20261021030000", "local_only", b"SELECT 3;")]
        remote = [entry("20261021010000", "sql_change", b"SELECT 1;"),
                  entry("20261021050000", "remote_only", b"SELECT 4;")]
        result = assess(local, remote)
        decision = {x["name"]: x["decision"] for x in result["local_assessment"]}
        self.assertEqual(decision["sql_change"], "HOLD_DIFFERENT_SQL")
        self.assertEqual(decision["local_only"], "HOLD_ONLY_LOCAL")
        self.assertEqual(result["summary"]["only_remote_entries"], 1)
        self.assertEqual(result["repair_commands"], [])

    def test_relative_timestamp_order_inversion_is_flagged(self):
        local = [entry("20261021010000", "first", b"SELECT 1;"),
                 entry("20261021020000", "second", b"SELECT 2;")]
        remote = [entry("20261021040000", "first", b"SELECT 1;"),
                  entry("20261021030000", "second", b"SELECT 2;")]
        result = assess(local, remote)
        self.assertEqual(result["summary"]["order_conflicts_indicated"], 1)
        self.assertEqual(result["order_conflicts"][0]["name"], "second")

    def test_remote_only_different_name_same_sql_is_not_a_repair(self):
        local = [entry("20261021010000", "renamed", b"SELECT 1;")]
        remote = [entry("20261021020000", "original", b"SELECT 1;")]
        result = assess(local, remote)
        self.assertEqual(result["summary"]["remote_only_identical_sql_different_name"], 1)
        self.assertEqual(result["remote_only_with_identical_sql_under_another_local_name"][0]
                         ["repair_authorized"], False)
        self.assertEqual(result["repair_commands"], [])


if __name__ == "__main__":
    unittest.main()
