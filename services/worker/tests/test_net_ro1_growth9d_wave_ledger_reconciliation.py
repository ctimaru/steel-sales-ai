"""NET-RO1.GROWTH9.D: no company duplication when correcting an already-published wave."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
MIG=ROOT/"supabase/migrations/20261108163500_net_ro1_growth9d_fab9_existing_wave_ledger_reconcile.sql"
MAN=ROOT/"services/worker/data/net_ro1_growth9d_fabricators9_20261108.json"

def test_ledger_reconciliation_matches_nine_source_pinned_public_profiles():
    sql=MIG.read_text(encoding="utf8")
    cohort=json.loads(MAN.read_text(encoding="utf8"))["companies"]
    assert len(cohort)==9 and len({c["canonical_domain"] for c in cohort})==9
    assert "v_old_wave constant text := 'NET-RO1.GROWTH9.D-FAB15'" in sql
    assert "v_correct_wave constant text := 'NET-RO1.GROWTH9.D-FAB9'" in sql
    assert "v_old_count<>9 OR v_correct_count<>0" in sql
    assert "v_matching<>9" in sql and "v_updated<>9" in sql
    assert "v_correct_count<>9 OR v_old_count<>0" in sql
    assert "LOCK TABLE private.network_ro14c_publication_links IN SHARE ROW EXCLUSIVE MODE" in sql
    assert "WHERE publication_wave IN (v_old_wave,v_correct_wave)" in sql
    assert ") <> 220 THEN" in sql
    assert "RETURN;" in sql
    assert "pg_advisory_xact_lock" in sql
    assert "SET publication_wave=v_correct_wave" in sql
    assert "m.source_url=l.published_source_url" in sql
    assert "da.field_path='netro_growth9d_fabricator_web'" in sql
    assert "fac.eu_nuts2024_code=m.nuts" in sql
    assert "a.is_primary=true" in sql
    assert "s.batch_key='NET-RO1-G9D-FAB9'" in sql
    assert "<> 220" in sql and "<> 313" in sql
    for c in cohort:
        assert c["canonical_domain"] in sql
        assert c["research_id"] in sql

def test_original_publication_rows_ids_and_timestamps_are_untouched():
    sql=MIG.read_text(encoding="utf8")
    assert sql.count("UPDATE private.network_ro14c_publication_links")==1
    assert "published_at=" not in sql
    assert "SET publication_wave=v_correct_wave" in sql
    for forbidden in (
        "INSERT INTO public.", "UPDATE public.network_companies",
        "UPDATE private.network_web_research_seeds",
        "UPDATE public.network_data_assertions",
        "DELETE FROM", "TRUNCATE", "CREATE OR REPLACE FUNCTION",
        "SELECT private.netro_growth9d_publish_fab9(true)"
    ):
        assert forbidden not in sql
