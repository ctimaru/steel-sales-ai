"""NET-CONTACT Romania: extend role mailboxes without exposing personal email."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "supabase/migrations/20261108140000_netcontact_ro_generic_company_inboxes.sql"

def inbox_regex():
    sql = MIGRATION.read_text(encoding="utf8")
    clause = sql.split("select lower(btrim(coalesce(p_local,''))) ~ (", 1)[1].split(");",1)[0]
    pieces = re.findall(r"'([^']*)'", clause)
    assert len(pieces) == 4
    pattern = "".join(pieces)
    return sql, re.compile(pattern)

def test_romania_role_inboxes_accepted_but_personal_names_denied():
    sql, rx = inbox_regex()
    for mailbox in ("info", "office", "segreteria", "secretariat", "vanzari",
                    "comercial", "commerciale", "sales", "office.ro", "secretariat2"):
        assert rx.fullmatch(mailbox), mailbox
    for personal in ("ion.popescu", "maria", "adrian", "dualman", "director.popa",
                     "vanzari.client", "secretariat.john", "fake@company.com"):
        assert not rx.fullmatch(personal), personal
    assert "REVOKE ALL ON FUNCTION private.netcontact1_generic_local_part(text)" in sql

def test_privacy_review_and_source_checks_are_not_changed():
    sql, _ = inbox_regex()
    assert "private.netcontact1_generic_local_part" in sql
    assert "GRANT EXECUTE ON FUNCTION" in sql
    assert "TO authenticated, service_role" in sql
    assert "netcontact1_stage_company_channel" not in sql
    assert "netcontact1_approve_company_channels" not in sql
    assert "UPDATE public.network_contacts" not in sql
    assert "INSERT INTO public.network_contacts" not in sql
