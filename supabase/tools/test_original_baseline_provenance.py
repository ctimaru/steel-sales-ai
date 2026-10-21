"""No-repair provenance plus sanitized SQL failure diagnostics, offline only."""
from __future__ import annotations
import unittest

from original_baseline_provenance import inspect
from strict_rebuild_probe import sanitized_dependency


class OriginalFoundationProvenanceTests(unittest.TestCase):
    def setUp(self):
        self.manifest = {
            "project_ref": "ecrafjdummcdfycznitx",
            "applied_migrations": [
                {"version": "20260907145044", "name": "initial_schema",
                 "sql_sha256": "abc123", "sql_bytes": 20,
                 "creates_tables": ["public.companies", "public.contacts"]},
                {"version": "20260907150818", "name": "staging_schema",
                 "sql_sha256": "def456", "sql_bytes": 10,
                 "creates_tables": ["staging.import_batches"]},
            ],
        }
        self.snapshot = {
            "production_project_id": "ecrafjdummcdfycznitx",
            "migrations": [
                {"version": "20260907145044", "name": "initial_schema",
                 "sha256": "abc123", "bytes": 20},
                {"version": "20260907150818", "name": "staging_schema",
                 "sha256": "def456", "bytes": 10},
            ],
        }

    def run_case(self, manifest=None, snapshot=None, baselines=None, local=None):
        return inspect(manifest or self.manifest, snapshot or self.snapshot,
                       baselines or ["create table public.companies(id uuid);"],
                       local or ["20260909160700_worker_jobs_staging.sql"])

    def test_early_remote_history_and_ci_subset_detected(self):
        result = self.run_case()
        self.assertTrue(result["original_sql_hashes_match_snapshot"])
        self.assertTrue(result["historical_foundations_before_first_local"])
        self.assertEqual(result["historical_table_names_not_created_by_ci_baselines"],
                         ["public.contacts", "staging.import_batches"])
        self.assertFalse(result["self_contained_migrations_proven"])
        self.assertEqual(result["repair_commands"], [])

    def test_changed_ledger_sha_denies_provenance(self):
        snapshot = dict(self.snapshot)
        snapshot["migrations"] = [dict(x) for x in self.snapshot["migrations"]]
        snapshot["migrations"][0]["sha256"] = "tampered"
        result = self.run_case(snapshot=snapshot)
        self.assertFalse(result["original_sql_hashes_match_snapshot"])
        self.assertFalse(result["history_mutations_allowed"])

    def test_local_timestamp_predating_remote_history_blocks(self):
        result = self.run_case(local=["20260906100000_early.sql"])
        self.assertFalse(result["historical_foundations_before_first_local"])

    def test_wrong_project_rejected(self):
        bad = dict(self.manifest, project_ref="a-different-project")
        with self.assertRaises(AssertionError):
            self.run_case(manifest=bad)

    def test_strict_probe_extracts_only_identifiers(self):
        trace = (
            "Applying migration 20260909160700_worker_jobs_staging.sql...\n"
            "ERROR: relation \"public.companies\" does not exist "
            "(SQLSTATE 42P01)\n"
            "Sensitive comment: password=not-allowed-in-report\n"
        )
        result = sanitized_dependency(trace)
        self.assertEqual(result["missing_object"], "public.companies")
        self.assertEqual(result["last_migration"],
                         "20260909160700_worker_jobs_staging.sql")
        self.assertNotIn("password", str(result))

    def test_strict_probe_no_raw_sql_or_secrets_on_undefined_error(self):
        result = sanitized_dependency(
            'failed to apply migration\nhost=sensitive.example key=abcd')
        self.assertIsNone(result["missing_object"])
        self.assertIsNone(result["last_migration"])


if __name__ == "__main__":
    unittest.main()
