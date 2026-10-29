-- PROD-NEXT1.E3 — safe live-preflight for an explicitly NO-GO pilot.
-- Read-only. Works on production, validation and disposable local Supabase.
-- A FAIL does not authorize a repair, migration, activation or any write.
begin transaction read only;
do $e3$
declare
  v_gate private.pilot_activation_release_gate%rowtype;
  v_active bigint;
  v_approved bigint;
  v_optins bigint;
begin
  select * into v_gate from private.pilot_activation_release_gate where singleton=true;
  if not found or coalesce(v_gate.enabled,true) or
     coalesce(v_gate.legal_approved,true) or
     coalesce(v_gate.restore_approved,true) or
     coalesce(v_gate.support_approved,true) or v_gate.approved_at is not null then
    raise exception 'E3 NO-GO violated: release prerequisites must remain false';
  end if;

  select count(*) into v_active from public.marketplace_pilot_participants where status='active';
  select count(*) into v_approved from public.pilot_activation_admissions where state='approved';
  select count(*) into v_optins from public.pilot_activation_preferences where decision='granted';
  if v_active<>0 or v_approved<>0 or v_optins<>0 then
    raise exception 'E3 NO-GO violated: live participants, approvals or analytic grants present';
  end if;

  if not exists(
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where t.tgname='prod_next1e_guard_activation'
      and c.relname='marketplace_pilot_participants' and n.nspname='public' and t.tgenabled='O'
  ) or not exists(
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    where t.tgname='prod_next1e_preference_receipts_append_only'
      and c.relname='pilot_activation_preference_receipts' and t.tgenabled='O'
  ) then
    raise exception 'E3 NO-GO violated: a database safety trigger is disabled';
  end if;

  if has_table_privilege('anon','private.pilot_activation_release_gate','SELECT')
     or has_table_privilege('authenticated','private.pilot_activation_release_gate','UPDATE')
     or has_table_privilege('authenticated','public.pilot_activation_admissions','SELECT')
     or has_function_privilege('anon','public.prod_next1e_governance()','EXECUTE')
     or has_function_privilege('anon','public.prod_next1e_my_privacy()','EXECUTE') then
    raise exception 'E3 security violation: anonymous or direct gate access';
  end if;

  raise notice 'E3 live NO-GO verified read-only: no cohorts or analytics authorized';
end $e3$;
rollback;
