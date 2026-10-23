import json
import tempfile
import unittest
from pathlib import Path

from trust_c2g3b_stack_preflight import status

class StackPreflightTest(unittest.TestCase):
    def test_report_blocks_missing_migration_and_missing_main_ref(self):
        with tempfile.TemporaryDirectory() as td:
            snapshot={
                "audit":"TEST",
                "production_migrations":[["20261023120000","synthetic_test"]],
                "staging_migrations":[["20261023110000","synthetic_test"]],
                "acceptance_gates":{"real_signed_jwt_owner":"OPEN"},
            }
            out=status(snapshot,Path(td),git=lambda *args:(1,""))
            self.assertFalse(out["safe_to_merge"])
            self.assertTrue(any("canonical_repo_migration_missing" in x for x in out["blocking_findings"]))
            self.assertTrue(any("staging_prod_version_diverges" in x for x in out["blocking_findings"]))
            self.assertIn("main_ref_unavailable",out["blocking_findings"])

    def test_report_passes_only_when_all_gates_and_migrations_match(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/"20261023120000_synthetic_test.sql"
            path.write_text("SELECT 1;")
            snapshot={
                "audit":"TEST",
                "production_migrations":[["20261023120000","synthetic_test"]],
                "staging_migrations":[["20261023120000","synthetic_test"]],
                "acceptance_gates":{"real_signed_jwt_owner":"PASS"},
            }
            def git(*args):
                if args[0]=="rev-parse":return (0,"abc")
                if args[0]=="rev-list":return (0,"0\t5")
                return (1,"")
            result=status(snapshot,Path(td),git=git)
            self.assertTrue(result["safe_to_merge"])
            self.assertEqual(result["production_migration_files_present"],1)

if __name__ == "__main__":
    unittest.main()
