"""Offline SUPA-LEDGER5B provenance analysis never approves history repair."""
from __future__ import annotations

from hashlib import sha256
import unittest

from migration_orphan_duplicate_provenance import analyze


def row(version: str, name: str, sql: bytes) -> dict:
    return {"version": version, "name": name,
            "sha256": sha256(sql).hexdigest(), "bytes": len(sql)}


class OrphanDuplicateProvenanceTests(unittest.TestCase):
    def test_same_sql_different_name_is_evidence_not_repair(self):
        local = [row("20261021020000", "add_human_correction", b"SELECT 1;")]
        remote = [row("20261021010000", "human_correction", b"SELECT 1;")]
        doc = analyze(local, remote)
        self.assertEqual(doc["counts"]["local_only_entries"], 1)
        self.assertEqual(doc["counts"]["remote_only_entries"], 1)
        self.assertEqual(doc["counts"]["remote_only_byte_matches_differently_named_local_file"], 1)
        self.assertFalse(doc["remote_only"][0]["can_remove_remote_record"])
        self.assertEqual(doc["repair_commands"], [])

    def test_duplicate_remote_identical_sql_kept_as_two_versions(self):
        remote = [row("20261021010000", "identity", b"CREATE TABLE x(id int);"),
                  row("20261021020000", "identity", b"CREATE TABLE x(id int);")]
        doc = analyze([], remote)
        self.assertEqual(doc["counts"]["identical_sql_remote_duplicate_groups"], 1)
        self.assertEqual(doc["remote_duplicate_groups"][0]["status"],
                         "HOLD_DUPLICATE_SQL_IDENTICAL")
        self.assertEqual(len(doc["remote_duplicate_groups"][0]["remote_versions"]), 2)
        self.assertFalse(doc["remote_duplicate_groups"][0]["repair_authorized"])

    def test_duplicate_remote_different_sql_is_critical_hold(self):
        remote = [row("20261021010000", "pa1_claim", b"SELECT 1;"),
                  row("20261021020000", "pa1_claim", b"SELECT 2;")]
        doc = analyze([], remote)
        self.assertEqual(doc["counts"]["divergent_sql_remote_duplicate_groups"], 1)
        self.assertEqual(doc["remote_duplicate_groups"][0]["status"],
                         "HOLD_DUPLICATE_SQL_DIVERGENT")

    def test_local_duplicate_not_collapsed_and_pairs_checked(self):
        local = [row("20261021010000", "rfqh13_gate", b"SELECT 1;"),
                 row("20261021020000", "rfqh13_gate", b"SELECT 2;")]
        remote = [row("20261021010000", "rfqh13_gate", b"SELECT 2;"),
                  row("20261021020000", "rfqh13_gate", b"SELECT 2;")]
        doc = analyze(local, remote)
        self.assertEqual(doc["counts"]["local_duplicate_name_groups"], 1)
        self.assertEqual(doc["local_duplicate_groups"][0]["distinct_local_content_variants"], 2)
        self.assertFalse(doc["remote_duplicate_groups"][0]["local_version_pairs"][0]
                         ["matched_remote_version_and_sql"])
        self.assertTrue(doc["remote_duplicate_groups"][0]["local_version_pairs"][1]
                        ["matched_remote_version_and_sql"])

    def test_no_orphans_and_clean_history_still_prohibit_repair(self):
        x = row("20261021010000", "clean", b"SELECT 1;")
        doc = analyze([x], [x])
        self.assertEqual(doc["counts"]["local_only_entries"], 0)
        self.assertEqual(doc["counts"]["remote_only_entries"], 0)
        self.assertFalse(doc["safe_for_automatic_repair"])
        self.assertFalse(doc["history_mutations_allowed"])
        self.assertEqual(doc["repair_commands"], [])

    def test_no_sql_contents_enter_report(self):
        secret = b"SELECT 'sensitive source text';"
        x = row("20261021010000", "private", secret)
        doc = analyze([x], [])
        self.assertNotIn("sensitive source text", str(doc))
        self.assertIn(x["sha256"], str(doc))

    def test_unknown_name_defaults_to_manual_review(self):
        doc = analyze([row("20261021010000", "not_recognized", b"SELECT 1;")], [])
        self.assertEqual(doc["local_only"][0]["impact_hint"], "P1_PROVENANCE")
        self.assertFalse(doc["local_only"][0]["repair_authorized"])


if __name__ == "__main__":
    unittest.main()
