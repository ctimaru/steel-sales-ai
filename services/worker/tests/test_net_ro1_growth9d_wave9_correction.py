"""NET-RO1.GROWTH9.D publisher must use its own nine-company crosswalk wave."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
NEW=ROOT/"supabase/migrations/20261108162500_net_ro1_growth9d_fab9_wave_id_correction.sql"

def test_exact_nine_company_wave_and_no_autopublication():
    sql=NEW.read_text(encoding="utf8")
    assert "v_wave constant text := 'NET-RO1.GROWTH9.D-FAB9';" in sql
    assert "NET-RO1.GROWTH9.D-FAB15" not in sql
    assert "v_expected constant integer := 9" in sql
    assert "p_commit boolean DEFAULT false" in sql
    assert "v_existing<>211" in sql
    assert "v_research<>313" in sql
    assert "'expected_total_public_ro',220" in sql
    assert "REVOKE ALL ON FUNCTION private.netro_growth9d_publish_fab9(boolean)" in sql
    assert "TO service_role" in sql
    assert "SELECT private.netro_growth9d_publish_fab9(true)" not in sql
    assert "INSERT INTO public.network_contacts" not in sql
    assert "INSERT INTO public.network_company_certifications" not in sql
