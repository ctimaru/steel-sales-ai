from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
import tempfile
import unittest

from migration_sql_divergence_audit import (
    classify, read_normalized_snapshot, signatures,
)


def remote_entry(version: str, name: str, value: bytes):
    normalized = signatures(value)
    return {
        "version":version, "name":name,
        "bytes":len(value), "sha256":sha256(value).hexdigest(),
        **normalized,
    }


class DivergenceAuditTests(unittest.TestCase):
    def test_four_conflict_classes_are_mutually_exclusive_and_non_authorizing(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp)
            folder=base/"migrations"
            folder.mkdir()
            examples=[
                ("eol", b"SELECT 1;\r\n", b"SELECT 1;\n", "line_endings_only"),
                ("edge", b"SELECT 1;", b" \nSELECT 1;\n", "outer_whitespace_only"),
                ("space", b"SELECT    1;", b"SELECT 1;", "global_whitespace_candidate_UNSAFE"),
                ("code", b"SELECT 2;", b"SELECT 1;", "substantive_text_divergence_or_comments"),
            ]
            remote=[]
            for idx,(name,applied,local,_) in enumerate(examples):
                (folder/f"2026102016{idx:04d}_{name}.sql").write_bytes(local)
                remote.append(remote_entry(f"2026102011{idx:04d}",name,applied))
            raw=base/"raw.json"
            normalized=base/"normalized.json"
            raw.write_text(json.dumps({"contract":"supa-ledger2-sql-sha256-v1",
                "migrations":[{k:row[k] for k in ("version","name","bytes","sha256")}
                              for row in remote]}))
            normalized.write_text(json.dumps({"contract":"supa-ledger3-normalized-sql-sha256-v1",
                "migrations":[{k:row[k] for k in ("version","name","lf_sha256",
                    "edge_trim_sha256","whitespace_collapse_sha256","lf_bytes")}
                              for row in remote]}))
            report=classify(folder,raw,normalized)
            self.assertFalse(report["safe_for_automatic_repair"])
            self.assertEqual(report["baseline_summary"]["different_sql_same_name"],4)
            for name,_,__,expected in examples:
                self.assertEqual(next(x["category"] for x in report["divergences"]
                    if x["name"]==name),expected)
            for count in report["divergence_summary"].values():
                self.assertEqual(count,1)

    def test_global_whitespace_collapse_is_not_semantic_proof(self):
        left=signatures(b"SELECT 'a  b';")
        right=signatures(b"SELECT 'a b';")
        self.assertEqual(left["whitespace_collapse_sha256"],
                         right["whitespace_collapse_sha256"])
        self.assertNotEqual(left["lf_sha256"],right["lf_sha256"])
        # This is WHY global whitespace equality must never be auto-approved.

    def test_rejects_bad_fingerprint_contract_and_cross_snapshot_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp)
            source=directory/"migrations"
            source.mkdir()
            (source/"20261020160000_example.sql").write_bytes(b"SELECT 1;")
            raw=directory/"raw.json"
            normalized=directory/"normalized.json"
            record=remote_entry("20261020110000","example",b"SELECT 2;")
            raw.write_text(json.dumps({"contract":"supa-ledger2-sql-sha256-v1",
                "migrations":[{k:record[k] for k in ("name","version","sha256","bytes") }]}))
            normalized.write_text(json.dumps({"contract":"invalid","migrations":[record]}))
            with self.assertRaises(ValueError):
                read_normalized_snapshot(normalized)
            normalized.write_text(json.dumps({
                "contract":"supa-ledger3-normalized-sql-sha256-v1",
                "migrations":[{**record,"name":"unrelated"}]}))
            with self.assertRaises(ValueError):
                classify(source,raw,normalized)

    def test_utf8_byte_lengths_and_safe_ascii_boundary_whitespace(self):
        original="-- Acciaio 🏗️\nSELECT 'Tubi';\n".encode("utf-8")
        variant=original.replace(b"\n",b"\r\n")
        self.assertNotEqual(sha256(original).digest(),sha256(variant).digest())
        self.assertEqual(signatures(original)["lf_sha256"],signatures(variant)["lf_sha256"])
        self.assertEqual(signatures(original)["lf_bytes"],len(original))


if __name__=="__main__":
    unittest.main()
