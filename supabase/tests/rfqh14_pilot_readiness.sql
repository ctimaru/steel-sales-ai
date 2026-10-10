-- RFQH14.1: contract and production/synthetic baseline verification.
-- Safe in production: transaction is READ ONLY; no persistent test data or supplier messaging.
-- Passing this file means TECHNICAL CONTRACT READY, not REAL PILOT ACCEPTED.
begin transaction read only;

do $rfqh14$
declare
  v_table text;
  v_policy boolean;
  v_api record;
begin
  foreach v_table in array array[
    'buyer_distintas',
    'buyer_distinta_lines',
    'buyer_rfq_campaigns',
    'buyer_rfq_suppliers',
    'buyer_rfq_dispatches',
    'buyer_rfq_quotes',
    'buyer_rfq_quote_lines',
    'buyer_rfq_awards',
    'buyer_rfq_award_allocations',
    'buyer_purchase_order_drafts',
    'buyer_purchase_order_versions',
    'buyer_purchase_order_supplier_responses',
    'buyer_supplier_profiles',
    'buyer_procurement_approvals',
    'buyer_rfq_team_members'
  ] loop
    if to_regclass(format('public.%I',v_table)) is null then
      raise exception 'RFQH14: missing expected object: %',v_table;
    end if;
    select c.relrowsecurity into v_policy
      from pg_class c where c.oid = to_regclass(format('public.%I',v_table));
    if v_policy is distinct from true then
      raise exception 'RFQH14: RLS is not enabled: %',v_table;
    end if;
  end loop;

  -- This hidden schema hosts implementation functions; exposing it breaks the
  -- anonymous capability boundary even if public wrappers enforce scoped tokens.
  if has_schema_privilege('anon','private','USAGE') then
    raise exception 'RFQH14: anonymous role has USAGE on private implementation schema';
  end if;

  -- Buyer APIs never grant anon EXECUTE. Guest supplier portals require
  -- anonymous *capability-scoped* access, not access to buyer data tables.
  for v_api in
    select * from (values
      ('public.rfqh3_launch_campaign(uuid,timestamptz,text,jsonb)',false),
      ('public.rfqh5_quote_comparison(uuid)',false),
      ('public.rfqh7_confirm_award(uuid,text,jsonb)',false),
      ('public.rfqh9_po_state(uuid)',false),
      ('public.rfqh13_governance_state(uuid)',false),
      ('public.rfqh13_export_audit(uuid)',false),
      ('public.rfqh4_get_portal(text)',true),
      ('public.rfqh4_save_quote(text,jsonb,jsonb)',true),
      ('public.rfqh4_submit_quote(text)',true),
      ('public.rfqh9_supplier_portal(text)',true)
    ) as declared(signature,allow_anonymous)
  loop
    if to_regprocedure(v_api.signature) is null then
      raise exception 'RFQH14: missing API %',v_api.signature;
    end if;
    if has_function_privilege('anon',to_regprocedure(v_api.signature),'EXECUTE')
      is distinct from v_api.allow_anonymous then
      raise exception 'RFQH14: unexpected anonymous execute on %',v_api.signature;
    end if;
  end loop;

  if to_regclass('public.rfqh11_supplier_directory') is null
    or to_regclass('public.rfqh11_supplier_detail') is null then
    raise exception 'RFQH14: Supplier CRM read models not available';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='rfqh12_procurement_intelligence'
  ) then
    raise exception 'RFQH14: Procurement Intelligence API not available';
  end if;
end;
$rfqh14$;

-- This intentionally reports aggregate activity only: no email, quote,
-- token, target price, supplier identity or tenant-specific business data.
select
  current_timestamp as observed_at_utc,
  (select count(*) from public.buyer_rfq_campaigns) as rfq_campaigns,
  (select count(*) from public.buyer_rfq_suppliers) as rfq_supplier_targets,
  (select count(*) from public.buyer_rfq_dispatches) as dispatches,
  (select count(*) from public.buyer_rfq_quotes) as supplier_quotes,
  (select count(*) from public.buyer_rfq_awards) as awards,
  (select count(*) from public.buyer_purchase_order_drafts) as po_drafts,
  (select count(*) from public.buyer_purchase_order_versions) as po_versions,
  (select count(*) from public.buyer_purchase_order_supplier_responses) as supplier_po_responses,
  (select count(*) from public.buyer_supplier_profiles) as supplier_crm_profiles,
  (select count(*) from public.buyer_procurement_approvals) as approval_records;

rollback;
