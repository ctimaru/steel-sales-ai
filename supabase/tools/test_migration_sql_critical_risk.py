import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from migration_sql_critical_risk import prioritize


def report(rows):
    return {
        "contract": "supa-ledger3-divergence-triage-v1",
        "safe_for_automatic_repair": False,
        "baseline_summary": {"local_total": 3, "remote_total": 3},
        "divergence_summary": {"substantive_text_divergence_or_comments": len(rows)},
        "divergences": rows,
    }


def entry(name, version):
    return {"name": name, "local_version": version, "remote_version": "20261020110925",
            "local_bytes": 100, "remote_bytes": 101,
            "category": "substantive_text_divergence_or_comments"}


class RiskIndexTests(unittest.TestCase):
    def test_sorting_priorities_and_no_auto_approval(self):
        with TemporaryDirectory() as d:
            folder = Path(d)
            names = [
                ("generic", "SELECT 1;"),
                ("network", "INSERT INTO public.network_companies VALUES (1);"),
                ("permissions", "REVOKE EXECUTE ON FUNCTION public.f() FROM anon;"),
            ]
            rows = []
            for i, (name, sql) in enumerate(names):
                version = "2026102016" + str(i).zfill(4)
                (folder / f"{version}_{name}.sql").write_text(sql)
                rows.append(entry(name, version))
            result = prioritize(report(rows), folder)
            self.assertFalse(result["safe_for_automatic_repair"])
            self.assertEqual([r["name"] for r in result["queue"]],
                             ["permissions", "network", "generic"])
            self.assertEqual(result["summary"]["P0_SECURITY_OR_OWNERSHIP"], 1)
            self.assertEqual(result["summary"]["P1_NETWORK_OR_DML"], 1)
            self.assertEqual(result["summary"]["P2_GENERAL_SQL_OR_COMMENTS"], 1)
            self.assertTrue(all(x["remote_executable_sql_compared"] is False
                                for x in result["queue"]))

    def test_comments_cannot_be_used_as_equivalence_proof(self):
        with TemporaryDirectory() as d:
            directory = Path(d)
            (directory / "20261020160000_comment.sql").write_text(
                "-- security definer appears only in comment\nSELECT 1;")
            result = prioritize(report([entry("comment", "20261020160000")]), directory)
            self.assertEqual(result["queue"][0]["priority"], "P0_SECURITY_OR_OWNERSHIP")
            self.assertFalse(result["safe_for_automatic_repair"])

    def test_disallow_missing_files_and_inconsistent_unresolved_count(self):
        with TemporaryDirectory() as d:
            with self.assertRaises(ValueError):
                prioritize(report([entry("absent", "20261020160000")]), Path(d))
            bad = report([])
            bad["divergence_summary"]["substantive_text_divergence_or_comments"] = 1
            with self.assertRaises(ValueError):
                prioritize(bad, Path(d))


if __name__ == "__main__":
    unittest.main()
