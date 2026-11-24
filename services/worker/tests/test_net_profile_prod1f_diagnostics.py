"""NET-PROFILE-PROD1.F — private evidence metrics and conservative acronym IDs."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from app.net_profile_prod1b import (
    _diagnostic_reason, _page_diagnostics, identity_matches_domain, run_cycle,
)


def page(*, blocks=(), text="", url="https://omospa.it/"):
    return SimpleNamespace(
        url=url, text=text or " ".join(blocks), title="Prodotti",
        meta_description=None, h1=None, evidence_blocks=tuple(blocks),
        links=(),
    )


class LegalInitialismTest(unittest.TestCase):
    def test_dotted_and_strict_corporate_acronym_domains(self):
        cases = (
            ("O.M.O. S.p.A.", "omospa.it"),
            ("SGP S.r.l.", "sgp.it"),
            ("IMS S.p.A.", "ims.it"),
            ("CEM S.r.l.", "cemsrl.it"),
            ("FAR S.p.A.", "farspa.com"),
            ("GRA.BER. S.r.l.", "gra-ber.it"),
            ("So.Pu.Me.V Snc", "sopumev.com"),
            ("OFF.M.A. S.r.l.", "offma.net"),
        )
        for legal, domain in cases:
            with self.subTest(legal=legal, domain=domain):
                self.assertTrue(identity_matches_domain(legal, None, domain))

    def test_crosslinked_and_brand_expansion_must_remain_blocked(self):
        cases = (
            ("O.M.O. S.p.A.", "omopartner.it"),
            ("O.M.O. S.p.A.", "omotechnologies.it"),
            ("O.M.O. S.p.A.", "othercompany.it"),
            ("ABS S.r.l.", "abstagliotubi.it"),
            ("C.F.G. Srl", "cfgbari.it"),
            ("M.C.R. S.r.l.", "mcrmetalli.it"),
            ("CERTIFICATO ISO 9001 SCF SRL", "scfstampaggio.com"),
            ("Ing. Nevio Bigollo Quality Manager SBE-VARVIT S.p.A.",
             "dectestingmachines.it"),
            ("FILIERE Srl", "vassena.it"),
            ("Comax S.R.L.", "trafilatirocca.it"),
        )
        for legal, domain in cases:
            with self.subTest(legal=legal, domain=domain):
                self.assertFalse(identity_matches_domain(legal, None, domain))

    def test_standard_domain_matches_unchanged(self):
        self.assertTrue(identity_matches_domain(
            "Tomatis Lamiere S.r.l.", None, "tomatislamiere.it"
        ))
        self.assertTrue(identity_matches_domain(
            "Tubifaber S.p.A.", None, "tubifaber.it"
        ))


class PageDiagnosticsTest(unittest.TestCase):
    def test_counts_blocks_positive_relations_and_rejections_without_text(self):
        text = (
            "La nostra azienda produce tubi e condotte per industria. "
            "I nostri partner producono lamiere per applicazioni strutturali. "
            "Eseguiamo taglio laser per componenti industriali. "
            "Macchinari per saldatura e taglio al plasma."
        )
        d = _page_diagnostics(page(blocks=(text,)))
        self.assertEqual(d["html_pages"], 1)
        self.assertEqual(d["editorial_blocks"], 1)
        self.assertEqual(d["pages_without_editorial"], 0)
        self.assertGreaterEqual(d["product_verb_segments"], 2)
        self.assertGreaterEqual(d["product_relation_segments"], 1)
        self.assertGreaterEqual(d["rejected_product_segments"], 1)
        self.assertEqual(d["working_relation_segments"], 1)
        self.assertTrue(all(isinstance(v, int) for v in d.values()))
        self.assertNotIn("tubi", str(d).lower())
        self.assertNotIn("partner", str(d).lower())

    def test_missing_prose_does_not_use_flat_menu_as_evidence(self):
        d = _page_diagnostics(page(
            blocks=(), text="Produciamo tubi per l'industria. Eseguiamo saldatura."
        ))
        self.assertEqual(d["editorial_blocks"], 0)
        self.assertEqual(d["product_verb_segments"], 0)
        self.assertEqual(d["working_verb_segments"], 0)
        self.assertEqual(_diagnostic_reason("no_evidence", "", d, 0),
                         "no_editorial_blocks")

    def test_discard_reason_buckets_not_ad_hoc_source_quotes(self):
        empty = _page_diagnostics(page(blocks=()))
        self.assertEqual(
            _diagnostic_reason("blocked", "canonical_identity_or_domain_mismatch",
                               empty, 0), "identity_mismatch")
        self.assertEqual(
            _diagnostic_reason("blocked", "robots_or_source_unavailable",
                               empty, 0), "source_unavailable")
        unclassified = _page_diagnostics(page(blocks=(
            "Produciamo macchine per la produzione di tubi in acciaio.",)))
        self.assertEqual(
            _diagnostic_reason("no_evidence", "", unclassified, 0),
            "rejected_or_unclassified_relation")


class DiagnosticRecordFlowTest(unittest.IsolatedAsyncioTestCase):
    async def test_metrics_are_written_after_completion_only_with_flag(self):
        db = Mock()
        calls = []
        uid = "00000000-0000-0000-0000-000000000123"
        token = "00000000-0000-0000-0000-000000000456"

        def rpc(name, payload):
            calls.append((name, payload))
            if name.endswith("_seed"):
                response = {"contract": "netprofile-prod1b-seed-v1", "added": 0}
            elif name.endswith("_claim"):
                response = {"contract": "netprofile-prod1b-claim-v1", "items": [{
                    "company_id": uid, "lease_token": token,
                    "legal_name": "O.M.O. S.p.A.", "trading_name": None,
                    "site_url": "https://omospa.it/",
                    "canonical_domain": "omospa.it",
                    "product_urls": [],
                }]}
            elif name.endswith("_complete"):
                response = {"contract": "netprofile-prod1b-complete-v1",
                            "accepted": 2}
            else:
                self.assertEqual(name, "netprofile_prod1f_record_diagnostics")
                response = {"contract": "netprofile-prod1f-record-v1",
                            "saved": True}
            wrapped = Mock()
            wrapped.execute.return_value.data = response
            return wrapped

        db.rpc.side_effect = rpc
        good = page(blocks=(
            "La nostra azienda produce tubi e condotte per "
            "applicazioni strutturali e industriali.",))
        with (
            patch("app.net_profile_prod1b._fetch_page",
                  new=AsyncMock(return_value=good)),
            patch.dict("os.environ",
                       {"NETPROFILE_PROD1F_DIAGNOSTICS_ENABLED": "true"}),
        ):
            result = await run_cycle(db, persist=True, limit=1)
        self.assertEqual([x[0] for x in calls], [
            "netprofile_prod1b_seed", "netprofile_prod1b_claim",
            "netprofile_prod1b_complete",
            "netprofile_prod1f_record_diagnostics",
        ])
        self.assertEqual(result["accepted_facts"], 2)
        self.assertEqual(result["diagnostics_saved"], 1)
        metric = calls[-1][1]["p_diagnostics"]
        self.assertEqual(metric["reason_bucket"], "accepted")
        self.assertGreaterEqual(metric["editorial_blocks"], 1)
        self.assertEqual(metric["html_pages"], 1)
        self.assertNotIn("azienda produce tubi", str(metric))
        self.assertEqual(calls[-1][1]["p_company_id"], uid)

    async def test_disabled_metrics_does_not_call_new_rpc(self):
        db = Mock()
        def rpc(name, args):
            if name.endswith("_seed"):
                payload = {"contract": "netprofile-prod1b-seed-v1", "added": 0}
            else:
                payload = {"contract": "netprofile-prod1b-claim-v1", "items": []}
            wrapped = Mock()
            wrapped.execute.return_value.data = payload
            return wrapped
        db.rpc.side_effect = rpc
        with patch.dict("os.environ",
                        {"NETPROFILE_PROD1F_DIAGNOSTICS_ENABLED": "false"}):
            result = await run_cycle(db, persist=True, limit=1)
        self.assertEqual(result["diagnostics_saved"], 0)
        self.assertEqual(result["processed"], 0)
