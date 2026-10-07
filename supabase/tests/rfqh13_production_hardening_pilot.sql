begin;

do $$
declare
  v_def text;
begin
  if to_regclass('public.buyer_procurement_governance') is null then
    raise exception 'RFQH13 governance table missing';
  end if;
  if to_regclass('public.buyer_rfq_team_members') is null then
    raise exception 'RFQH13 team table missing';
  end if;
  if to_regclass('public.buyer_procurement_approvals') is null then
    raise exception 'RFQH13 approval table missing';
  end if;

  if not exists(
    select 1 from pg_class c
    where c.oid='public.buyer_procurement_governance'::regclass
      and c.relrowsecurity
  ) then raise exception 'RFQH13 governance RLS disabled'; end if;

  if has_function_privilege('anon','public.rfqh13_governance_state(uuid)','EXECUTE') then
    raise exception 'anon must not execute RFQH13 governance state';
  end if;
  if not has_function_privilege('authenticated','public.rfqh13_governance_state(uuid)','EXECUTE') then
    raise exception 'authenticated must execute RFQH13 governance state';
  end if;
  if has_function_privilege('anon','public.rfqh13_export_audit(uuid)','EXECUTE') then
    raise exception 'anon must not execute RFQH13 audit export';
  end if;

  v_def:=pg_get_functiondef('private.rfqh7_confirm_award_impl(uuid,text,jsonb)'::regprocedure);
  if position('rfqh13_assert_award_approval' in v_def)=0
     or position('rfqh13_consume_approval' in v_def)=0 then
    raise exception 'RFQH13 award gate missing from core';
  end if;

  v_def:=pg_get_functiondef(
    'private.rfqh9_prepare_issue_impl(uuid,text,text,text,timestamptz)'::regprocedure
  );
  if position('rfqh13_assert_po_approval' in v_def)=0
     or position('rfqh13_consume_approval' in v_def)=0 then
    raise exception 'RFQH13 PO gate missing from core';
  end if;

  v_def:=pg_get_functiondef('private.rfqh13_mark_stale_dispatch_failed_impl(uuid,text)'::regprocedure);
  if position('provider_message_id is not null' in lower(v_def))=0
     or position('15 minutes' in v_def)=0 then
    raise exception 'RFQH13 safe recovery guard missing';
  end if;

  v_def:=pg_get_functiondef('private.rfqh13_export_audit_impl(uuid)'::regprocedure);
  if position('RFQH13-audit-export-v1' in v_def)=0
     or position('token_hash' in v_def)=0
     or position('provider_message_id' in v_def)=0 then
    raise exception 'RFQH13 audit sanitization contract missing';
  end if;
end $$;

rollback;
