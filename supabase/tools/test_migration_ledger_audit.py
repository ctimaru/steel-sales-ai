"""Offline unit acceptance for SUPA-LEDGER1 history forensics (no database)."""
from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from migration_ledger_audit import classify, read_local, read_remote


def item(version: str, name: str):
    return {"version": version, "name": name}


class MigrationLedgerAuditTests(unittest.TestCase):
    def test_exact_version_and_missing_names(self):
        local = [item("20261020160000", "research"), item("20261020201000", "review"),
                 item("20261020233000", "live")]
        remote = [item("20261020110925", "research"), item("20261020201000", "review"),
                  item("20261020120000", "untracked")]
        result = classify(local,remote)
        self.assertFalse(result["clean"])
        self.assertEqual(result["summary"]["exact_name_version"],1)
        self.assertEqual(result["summary"]["same_name_version_mismatch"],1)
        self.assertEqual(result["summary"]["local_only"],1)
        self.assertEqual(result["summary"]["remote_only"],1)
        self.assertEqual(result["same_name_version_mismatch"][0]["name"],"research")

    def test_clean_only_if_complete_bijection(self):
        local = [item("20261020160000", "research"), item("20261020201000", "review")]
        remote = list(reversed(local))
        result = classify(local, remote)
        self.assertTrue(result["clean"])
        self.assertEqual(result["summary"]["exact_name_version"], 2)

    def test_duplicates_require_review_even_if_exact_version_exists(self):
        local = [item("20261020201000","review")]
        remote = [item("20261020201000","review"), item("20261020111030","review")]
        result = classify(local,remote)
        self.assertFalse(result["clean"])
        self.assertEqual(result["summary"]["remote_duplicate_names"],1)
        self.assertEqual(result["duplicates"]["remote_names"]["review"],
                         ["20261020111030","20261020201000"])

    def test_local_files_must_be_versioned_and_remote_payload_bounded_by_schema(self):
        with tempfile.TemporaryDirectory() as root:
            directory=Path(root)
            (directory/"20261020160000_research.sql").write_text("BEGIN; COMMIT;")
            (directory/"notes.sql").write_text("select 1;")
            with self.assertRaises(ValueError):
                read_local(directory)
            (directory/"notes.sql").unlink()
            self.assertEqual(read_local(directory),[item("20261020160000","research")])
            snap=directory/"remote.json"
            snap.write_text(json.dumps({"migrations":[item("20261020110925","research")]}))
            self.assertEqual(read_remote(snap),[item("20261020110925","research")])
            snap.write_text(json.dumps({"migrations":[{"version":"broken","name":"research"}]}))
            with self.assertRaises(ValueError):
                read_remote(snap)


if __name__=="__main__":
    unittest.main()
