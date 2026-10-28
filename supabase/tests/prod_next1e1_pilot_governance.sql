-- PROD-NEXT1.E1 read-only database safety acceptance.
-- Run after Supabase migrations. Never activates a pilot, writes customers or enables metrics.
begin transaction read only;
do $check$
declare v_gate private.pilot_activation_release_gate%rowtype;
begin
  select * into v_gate from private.pilot_activation_release_gate where singleton;
  if not found or v_gate.enabled or v_gate.legal_approved or
     v_gate.restore_approved or v_gate.support_approved or
     v_gate.approved_notice_version is not null then
    raise exception 'E1 FAIL: pilot live gate must be disabled by default';
  end if;
  if has_table_privilege('anon','public.pilot_activation_admissions','SELECT')
    or has_table_privilege('authenticated','public.pilot_activation_admissions','SELECT')
    or has_table_privilege('authenticated','public.pilot_activation_preferences','SELECT')
    or has_table_privilege('authenticated','public.pilot_activation_preference_receipts','SELECT')
    or has_table_privilege('authenticated','private.pilot_activation_release_gate','UPDATE')
    or has_function_privilege('anon','public.prod_next1e_review_admission(uuid,text,text,text,text)','EXECUTE')
    or has_function_privilege('anon','public.prod_next1e_set_analytics_preference(uuid,text,text)','EXECUTE')
    or has_function_privilege('anon','public.prod_next1e_my_privacy()','EXECUTE') then
    raise exception 'E1 FAIL: direct table access or anonymous RPC execution exposed';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname='prod_next1e_guard_activation' and tgenabled='O'
  ) then
    raise exception 'E1 FAIL: P5.6 database activation trigger missing';
  end if;
  if not exists(select 1 from pg_trigger where tgname='prod_next1e_preference_receipts_append_only' and tgenabled='O') then
    raise exception 'E1 FAIL: receipt immutable trigger missing';
  end if;
  raise notice 'PROD-NEXT1.E1 PASS: no live telemetry, restricted rows, activation trigger installed';
end $check$;
rollback;
