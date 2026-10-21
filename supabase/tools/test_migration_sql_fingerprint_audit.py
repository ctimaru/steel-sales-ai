from __future__ import annotations

import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from migration_sql_fingerprint_audit import classify, load_local, load_remote, _normalize_cosmetic_prefix_and_suffix


def item(version: str, name: str, sql: bytes) -> dict:
    return {"name":name, "version":version,"sha256":hashlib.sha256(sql).hexdigest(),"bytes":len(sql)}


class SqlFingerprintAuditTests(unittest.TestCase):
    def test_identical_sql_different_version_is_not_automatically_repairable(self):
        sql=b"BEGIN;\nCREATE TABLE private.example (id uuid);\nCOMMIT;\n"
        local=[item("20261020160000","research",sql)]
        remote=[item("20261020110925","research",sql)]
        out=classify(local,remote)
        self.assertEqual(out["summary"]["identical_sql_different_version"],1)
        self.assertEqual(out["summary"]["different_sql_same_name"],0)
        self.assertFalse(out["safe_for_automatic_repair"])

    def test_text_difference_rejected_even_when_name_and_version_equal(self):
        local=[item("20261020200000","research",b"select 1;")]
        remote=[item("20261020200000","research",b"select 2;")]
        out=classify(local,remote)
        self.assertEqual(out["summary"]["different_sql_same_name"],1)
        self.assertEqual(out["summary"]["exact_version_and_sql"],0)

    def test_orphan_and_duplicate_names_stay_ambiguous(self):
        local=[item("20261020200000","research",b"select 1;"),
               item("20261020233000","new",b"select 3;")]
        remote=[item("20261020200000","research",b"select 1;"),
                item("20261020110000","research",b"select 2;"),
                item("20261019110000","legacy",b"select 4;")]
        out=classify(local,remote)
        self.assertEqual(out["summary"]["ambiguous_duplicate_name"],1)
        self.assertEqual(out["summary"]["only_in_local"],1)
        self.assertEqual(out["summary"]["only_in_remote"],1)
        self.assertEqual(out["summary"]["remote_duplicate_names"],1)

    def test_comment_prefix_and_trailing_newline_are_diagnostic_only(self):
        local_raw=b"-- source header\n-- legal note\n\nCREATE TABLE t(a integer);\n"
        remote_raw=b"\nCREATE TABLE t(a integer);"
        normalized_local=_normalize_cosmetic_prefix_and_suffix(local_raw)
        normalized_remote=_normalize_cosmetic_prefix_and_suffix(remote_raw)
        self.assertEqual(normalized_local,normalized_remote)
        local=[item("20261020090000","t",local_raw)]
        remote=[item("20261020081000","t",remote_raw)]
        local[0]["normalized_sha256"]=hashlib.sha256(normalized_local).hexdigest()
        local[0]["normalized_bytes"]=len(normalized_local)
        remote[0]["normalized_sha256"]=hashlib.sha256(normalized_remote).hexdigest()
        remote[0]["normalized_bytes"]=len(normalized_remote)
        report=classify(local,remote)
        self.assertEqual(report["summary"]["cosmetic_prefix_or_trailing_space_difference"],1)
        self.assertEqual(report["summary"]["different_sql_same_name"],0)
        self.assertFalse(report["safe_for_automatic_repair"])

    def test_hashes_from_original_bytes_and_invalid_remote_rejected(self):
        with TemporaryDirectory() as dirname:
            root=Path(dirname)
            source=root/"migrations"
            source.mkdir()
            data="-- Société européenne\nSELECT 'tubi';\n".encode("utf-8")
            (source/"20261020160000_steel.sql").write_bytes(data)
            local=load_local(source)
            self.assertEqual(local[0]["sha256"],hashlib.sha256(data).hexdigest())
            self.assertEqual(local[0]["bytes"],len(data))
            remote=root/"remote.json"
            remote.write_text(json.dumps({"contract":"supa-ledger2-sql-sha256-v1",
                                          "migrations":[item("20261020110925","steel",data)]}))
            self.assertEqual(load_remote(remote)[0]["sha256"],local[0]["sha256"])
            remote.write_text(json.dumps({"contract":"supa-ledger2-sql-sha256-v1",
                                          "migrations":[{"version":"oops","name":"steel",
                                          "sha256":"abc","bytes":4}]}))
            with self.assertRaises(ValueError):
                load_remote(remote)


if __name__=="__main__":
    unittest.main()
