"""SUPA-LEDGER5F — offline candidate verification, sanitization and fail-closed tests."""
import hashlib
import json
import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

import prepare_original_foundation_candidate as p


class PrivateCandidateTests(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.private = self.base / "authorized-private"
        self.private.mkdir()
        self.supabase = self.base / "checked-in" / "supabase"
        (self.supabase / "migrations").mkdir(parents=True)
        (self.supabase / "config.toml").write_text("project_id = 'isolated'\n")
        (self.supabase / "migrations" / "20260909160700_first.sql").write_text(
            "CREATE TABLE public.worker_jobs (id uuid);\n"
        )
        self.sample_prefix = (
            b"create table staging.archive_import_tokens (token text);\n"
            b"revoke all on staging.archive_import_tokens from anon, authenticated;\n"
        )
        self.sample_source = (
            self.sample_prefix +
            b"insert into staging.archive_import_tokens(token) values ('never-export');"
        )
        self.rows = []
        self.snapshot_rows = []
        for k in range(20):
            version = f"2026090714{k:04d}"
            name = f"original_{k:02d}"
            sql = f"create table staging.sample_{k} (id int);\n".encode()
            if k == 9:
                version = p.EXCLUDED_DML_VERSION
                name = p.EXCLUDED_DML_NAME
                sql = self.sample_source
            rec = {"version": version, "name": name,
                   "sql_sha256": hashlib.sha256(sql).hexdigest(),
                   "sql_bytes": len(sql), "creates_tables": []}
            self.rows.append(rec)
            self.snapshot_rows.append({
                "version": version, "name": name,
                "sha256": rec["sql_sha256"], "bytes": rec["sql_bytes"]
            })
            (self.private / f"{version}_{name}.sql").write_bytes(sql)
        self.rows.sort(key=lambda x: x["version"])
        self.manifest = {"project_ref": p.PROJECT,
                         "applied_migrations": self.rows}
        self.snapshot = {"production_project_id": p.PROJECT,
                         "migrations": self.snapshot_rows}
        self.out = self.base / "new-disposable"

    def _inspect(self):
        with patch.object(p, "EXCLUDED_DML_PREFIX_SHA",
                          hashlib.sha256(self.sample_prefix).hexdigest()):
            return p.inspect_private_sources(self.private,self.manifest,self.snapshot)

    def test_all_20_verifiably_private_and_token_dml_omitted(self):
        reviewed = self._inspect()
        self.assertEqual(len(reviewed), 20)
        sanitized = next(x for x in reviewed if x["dml_sanitized"])
        self.assertNotIn(b"never-export", sanitized["candidate_sql"])
        self.assertIn(b"historical token INSERT deliberately omitted", sanitized["candidate_sql"])
        self.assertEqual(sum(x["dml_sanitized"] for x in reviewed), 1)

    def test_candidates_created_only_outside_checked_in_migrations(self):
        with patch.object(p,"EXCLUDED_DML_PREFIX_SHA",
                          hashlib.sha256(self.sample_prefix).hexdigest()):
            report = p.prepare_candidate(
                self.private,self.supabase,self.out,self.manifest,self.snapshot
            )
        self.assertEqual(report["original_sources_verified"],20)
        self.assertEqual(len(list((self.out / "supabase" / "migrations").glob("*.sql"))),21)
        self.assertFalse(report["strict_repo_only_rebuild_fixed"])
        self.assertFalse(report["release_authorized"])
        self.assertFalse(report["final_schema_equivalence_verified"])
        self.assertFalse(report["history_mutations_allowed"])

    def test_changed_original_sql_fails_before_replay(self):
        item = self.rows[0]
        path=self.private / f"{item['version']}_{item['name']}.sql"
        path.write_text("create table public.unauthorized(id int);")
        with self.assertRaisesRegex(ValueError,"checksum mismatch"):
            self._inspect()

    def test_snapshot_mismatch_fails(self):
        self.snapshot["migrations"][0]["sha256"] = "tampered"
        with self.assertRaisesRegex(ValueError,"frozen snapshot"):
            self._inspect()

    def test_wrong_project_ref_rejected(self):
        self.manifest["project_ref"]="wrong"
        with self.assertRaisesRegex(ValueError,"Wrong provenance project"):
            self._inspect()

    def test_refuses_outside_to_inside_project_copy(self):
        with patch.object(p,"EXCLUDED_DML_PREFIX_SHA",
                          hashlib.sha256(self.sample_prefix).hexdigest()):
            with self.assertRaisesRegex(ValueError,"Refuse to write"):
                p.prepare_candidate(self.private,self.supabase,
                                    self.supabase/"candidate",self.manifest,self.snapshot)

    def test_refuses_version_collision(self):
        self.rows[0]["version"]="20260909160700"
        # Hash mismatch will fail closed before any files can be written.
        with patch.object(p,"EXCLUDED_DML_PREFIX_SHA",
                          hashlib.sha256(self.sample_prefix).hexdigest()):
            with self.assertRaises(ValueError):
                p.prepare_candidate(self.private,self.supabase,
                                    self.out,self.manifest,self.snapshot)

    def test_requires_exactly_twenty_predecessors(self):
        self.rows.pop()
        with self.assertRaisesRegex(ValueError,"Exactly 20"):
            self._inspect()

    def test_refuses_symlink_source(self):
        item=next(x for x in self.rows if x["version"]!=p.EXCLUDED_DML_VERSION)
        name=f"{item['version']}_{item['name']}.sql"
        path=self.private/name
        target=self.base/"other.sql"
        target.write_bytes(path.read_bytes())
        path.unlink()
        path.symlink_to(target)
        with self.assertRaises(FileNotFoundError):
            self._inspect()


if __name__=="__main__":
    import unittest
    unittest.main()
