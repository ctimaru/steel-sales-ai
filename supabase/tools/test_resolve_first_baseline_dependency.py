"""SUPA-LEDGER5E: first missing relation provenance must fail closed."""
from __future__ import annotations
import unittest
from resolve_first_baseline_dependency import resolve


class FirstDependencyTests(unittest.TestCase):
    def setUp(self):
        self.m = {
            "project_ref": "ecrafjdummcdfycznitx",
            "applied_migrations": [
                {"version": "20260907192936",
                 "name": "create_app_facing_commercial_read_models",
                 "sql_sha256": "originalsha256",
                 "adds_rls": True, "creates_policies": True, "contains_grants": True,
                 "creates_tables": ["public.commercial_datasets", "public.commercial_threads"]},
            ],
        }
        self.d = {
            "strict_rebuild_passed": False,
            "missing_object": "public.commercial_datasets",
            "last_migration": "20260912150428_promote_worker_jobs_to_commercial_dataset.sql",
        }

    def test_maps_original_creator_without_repair(self):
        r = resolve(self.d,self.m,
            "alter table public.worker_jobs add column dataset_id uuid references public.commercial_datasets(id);")
        self.assertTrue(r["original_sql_source_and_dependency_identified"])
        self.assertTrue(r["missing_object_referenced_in_local_sql"])
        self.assertEqual(r["original_remote_creators"][0]["version"],"20260907192936")
        self.assertTrue(r["original_remote_creators"][0]["contains_policies"])
        self.assertFalse(r["strict_rebuild_recovered"])
        self.assertFalse(r["history_mutations_allowed"])
        self.assertEqual(r["repair_commands"],[])

    def test_missing_creator_cannot_authorize_history(self):
        r = resolve({**self.d,"missing_object":"staging.no_object"},self.m)
        self.assertFalse(r["original_sql_source_and_dependency_identified"])
        self.assertEqual(r["original_remote_creators"],[])
        self.assertFalse(r["future_baseline_replay_authorized"])

    def test_chronological_inversion_does_not_claim_source(self):
        d = {**self.d,"last_migration":"20260901100000_old.sql"}
        r = resolve(d,self.m)
        self.assertFalse(r["original_creator_precedes_local_consumer"])

    def test_unsanitized_object_rejected(self):
        with self.assertRaises(ValueError):
            resolve({**self.d,"missing_object":"public.x;DROP TABLE users"},self.m)

    def test_migration_filename_not_whitelisted(self):
        with self.assertRaises(ValueError):
            resolve({**self.d,"last_migration":"../../secrets.sql"},self.m)


if __name__ == "__main__":
    unittest.main()
