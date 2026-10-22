"""Offline-only synthetic XML parser regression test for RNA candidate extraction."""
import tempfile
import unittest
from pathlib import Path

from app.rna_corporate_candidates import export_rna_candidates, safe_rna_url


class RnaOfflineSmoke(unittest.TestCase):
    def test_synthetic_corporate_candidate_summary(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<LISTA_AIUTI>
  <AIUTO>
    <DENOMINAZIONE_BENEFICIARIO>AZIENDA FITTIZIA S.R.L.</DENOMINAZIONE_BENEFICIARIO>
    <CODICE_FISCALE_BENEFICIARIO>00000000000</CODICE_FISCALE_BENEFICIARIO>
    <COR>DEMO-ONLY-1</COR>
    <SETTORE_ATTIVITA>46.72</SETTORE_ATTIVITA>
  </AIUTO>
  <AIUTO>
    <DENOMINAZIONE_BENEFICIARIO>IMPIANTI ESEMPIO S.P.A.</DENOMINAZIONE_BENEFICIARIO>
    <CODICE_FISCALE_BENEFICIARIO>11111111111</CODICE_FISCALE_BENEFICIARIO>
    <COR>DEMO-ONLY-2</COR>
    <SETTORE_ATTIVITA>25.11</SETTORE_ATTIVITA>
  </AIUTO>
</LISTA_AIUTI>"""
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "fixture.xml"
            source.write_text(xml, encoding="utf-8")
            result = export_rna_candidates(source, None, "both", 200)
        self.assertEqual(result["candidates"], 2)
        self.assertEqual(result["traders"], 1)
        self.assertEqual(result["potential_buyers"], 1)
        self.assertEqual(result["supabase_writes"], 0)

    def test_url_allowlist_rejects_third_party_and_redirect_trick(self):
        for url in ("https://example.com/file.xml", "https://www.rna.gov.it.evil.test/"):
            with self.assertRaises(ValueError):
                safe_rna_url(url)


if __name__ == "__main__":
    unittest.main()
