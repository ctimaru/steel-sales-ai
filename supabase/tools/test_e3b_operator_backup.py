"""E3.B offline contract tests: no production connections, tokens or bytes."""
from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import e3b_production_backup as backup
import e3b_isolated_restore as recovery


class TestBackupGuards(unittest.TestCase):
    def test_ci_must_refuse_real_export(self):
        with patch.dict(os.environ, {"CI": "true"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "CI"):
                backup.safe_config()

    def test_missing_human_approval_fails_closed(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "human approval"):
                backup.safe_config()

    def test_quote_storage_object_key(self):
        self.assertEqual(
            backup.storage_path("docs", "2026/private file#1.pdf"),
            "/storage/v1/object/authenticated/docs/2026/private%20file%231.pdf"
        )
        with self.assertRaises(RuntimeError):
            backup.storage_path("docs", "")

    def test_s3_requires_versioning_and_public_access_block(self):
        response = [
            json.dumps({"Status": "Suspended"}),
            json.dumps({"PublicAccessBlockConfiguration": {
                "BlockPublicAcls": True, "IgnorePublicAcls": True,
                "BlockPublicPolicy": True, "RestrictPublicBuckets": True
            }}),
            json.dumps({"ServerSideEncryptionConfiguration": {}})
        ]
        with patch.object(backup, "run_checked", side_effect=response):
            with self.assertRaisesRegex(RuntimeError, "versioned"):
                backup.s3_preflight("backup-bucket-1")

    def test_target_never_production_or_staging(self):
        example = {"buckets": [], "objects": []}
        for ref in recovery.RESTRICTED_REFS:
            with patch.dict(os.environ, {
                "E3B_ISOLATED_TARGET_REF": ref,
                "E3B_ISOLATED_TARGET_SERVICE_ROLE_KEY": "not-a-real-key",
                "E3B_ISOLATED_RESTORE_ACK": "restore-to-empty-" + ref
            }, clear=True):
                with self.assertRaisesRegex(RuntimeError, "Refuse production/validation"):
                    recovery.restore_storage(example, Path("/nonexistent"))

    def test_db_restore_requires_explicit_local_ack(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "not approved"):
                recovery.restore_db(Path("/nonexistent"), {"objects": []})


class TestSealedArchiveValidation(unittest.TestCase):
    def make_archive(self, folder: Path, tamper: bool = False):
        source = folder / "plaintext"
        (source / "database").mkdir(parents=True)
        (source / "objects").mkdir()
        db_files = {}
        for name in (
            "roles.sql", "schema.sql", "data.sql", "auth_data.sql",
            "storage_metadata.sql", "history_schema.sql", "history_data.sql"
        ):
            content = ("-- SYNTHETIC CI " + name + "\n").encode()
            (source / "database" / name).write_bytes(content)
            db_files[name] = {
                "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()
            }
        blob = b"E3.B synthetic object, NEVER customer content"
        (source / "objects" / "000000.blob").write_bytes(blob)
        manifest = {
            "schema": backup.SCHEMA, "source_ref": backup.PRODUCTION_REF,
            "database_files": db_files,
            "buckets": [{"id": "synthetic", "public": False}],
            "objects": [{
                "bucket_id": "synthetic", "key": "test fixture.txt",
                "file": "000000.blob", "bytes": len(blob),
                "sha256": "0000000000000000" if tamper else hashlib.sha256(blob).hexdigest(),
                "mimetype": "text/plain"
            }]
        }
        (source / "manifest.json").write_text(json.dumps(manifest))
        packed = folder / "test-archive.tar"
        with tarfile.open(packed, "w") as archive:
            archive.add(source / "manifest.json", arcname="manifest.json")
            for path in sorted((source / "database").iterdir()):
                archive.add(path, arcname="database/" + path.name)
            archive.add(source / "objects" / "000000.blob", arcname="objects/000000.blob")
        return packed

    def fake_age(self, original: Path):
        def run(args):
            self.assertEqual(args[0], "age")
            dest = Path(args[args.index("--output") + 1])
            shutil.copyfile(original, dest)
            return ""
        return run

    def test_offline_archive_integrity_before_any_restore(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            packed = self.make_archive(root)
            encrypted_placeholder = root / "dummy.age"
            encrypted_placeholder.write_bytes(b"synthetic")
            identity_placeholder = root / "dummy.identity"
            identity_placeholder.write_bytes(b"synthetic")
            work = root / "work"
            work.mkdir()
            with patch.object(recovery, "run_checked", self.fake_age(packed)):
                manifest, restored = recovery.extract_verified(
                    encrypted_placeholder, identity_placeholder, work)
            self.assertEqual(len(manifest["database_files"]), 7)
            self.assertEqual(len(manifest["objects"]), 1)
            self.assertEqual(
                (restored / "objects" / "000000.blob").read_bytes(),
                b"E3.B synthetic object, NEVER customer content"
            )

    def test_corrupt_manifest_blocks_restore(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            packed = self.make_archive(root, tamper=True)
            encrypted_placeholder = root / "dummy.age"
            encrypted_placeholder.write_bytes(b"synthetic")
            identity_placeholder = root / "dummy.identity"
            identity_placeholder.write_bytes(b"synthetic")
            work = root / "work"
            work.mkdir()
            with patch.object(recovery, "run_checked", self.fake_age(packed)):
                with self.assertRaisesRegex(RuntimeError, "integrity mismatch"):
                    recovery.extract_verified(encrypted_placeholder, identity_placeholder, work)


if __name__ == "__main__":
    unittest.main()
