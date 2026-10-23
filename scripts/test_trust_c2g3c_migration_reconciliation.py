import copy
import json
import tempfile
import unittest
from pathlib import Path

from trust_c2g3c_migration_reconciliation import reconcile

SNAPSHOT=Path(__file__).resolve().parents[1]/"supabase/audits/20261023_trust_c2g3c_catalog_and_ledger_snapshot.json"

class ReconciliationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot=json.loads(SNAPSHOT.read_text())

    def test_scoped_parity_does_not_override_reconciliation_and_release_gates(self):
        mdir=Path(__file__).resolve().parents[1]/"supabase/migrations"
        report=reconcile(self.snapshot,mdir)
        self.assertEqual(report["catalog"]["same_definition"],25)
        self.assertEqual(len(report["catalog"]["text_differences"]),2)
        self.assertTrue(report["scoped_catalog_parity_tested"])
        self.assertEqual(report["migrations"]["canonical_repo_files_present"],8)
        self.assertEqual(report["migrations"]["staging"],9)
        self.assertEqual(report["migrations"]["production"],8)
        self.assertFalse(report["release_ready"])
        self.assertFalse(report["automatic_schema_migration_repair_allowed"])

    def test_new_object_drift_must_fail_scoped_parity(self):
        obj=copy.deepcopy(self.snapshot)
        obj["staging"]["catalog"][0]["digest"]="0"*32
        report=reconcile(obj,Path(__file__).resolve().parents[1]/"supabase/migrations")
        self.assertFalse(report["scoped_catalog_parity_tested"])
        self.assertIn("unreviewed_catalog_or_behavioral_drift",report["blockers"])

    def test_missing_canonical_file_blocks_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            report=reconcile(self.snapshot,Path(tmp))
            self.assertEqual(report["migrations"]["canonical_repo_files_present"],0)
            self.assertIn("canonical_migration_files_not_unique",report["blockers"])

    def test_unapproved_drift_cannot_be_explained_away_by_notes(self):
        obj=copy.deepcopy(self.snapshot)
        obj["reviewed_textual_differences"]={}
        result=reconcile(obj,Path(__file__).resolve().parents[1]/"supabase/migrations")
        self.assertEqual(len(result["catalog"]["unreviewed_differences"]),2)
        self.assertFalse(result["scoped_catalog_parity_tested"])

if __name__=="__main__":
    unittest.main()
