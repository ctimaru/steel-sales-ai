-- NET-PROFILE-PROD1.F: counters are private, service-only, bounded,
-- and may not contain scraped HTML or arbitrary source strings.
begin;
create or replace function pg_temp.prod1f_assert(ok boolean,msg text)
returns void language plpgsql as $$
begin
 if coalesce(ok,false) is not true then
   raise exception 'PROD1.F assertion failed: %',msg;
 end if;
end $$;

select pg_temp.prod1f_assert(
  exists (
    select 1 from information_schema.columns
    where table_schema='private'
      and table_name='network_profile_producer_activity_events'
      and column_name='diagnostics' and data_type='jsonb'
  ),'private event ledger requires numeric diagnostics column'
);
select pg_temp.prod1f_assert(
  not has_function_privilege('anon',
    'public.netprofile_prod1f_record_diagnostics(uuid,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated',
    'public.netprofile_prod1f_record_diagnostics(uuid,jsonb)','EXECUTE')
  and has_function_privilege('service_role',
    'public.netprofile_prod1f_record_diagnostics(uuid,jsonb)','EXECUTE'),
  'diagnostic RPC must be service-role only'
);
select pg_temp.prod1f_assert(
  not has_table_privilege('anon',
      'private.network_profile_producer_activity_events','SELECT')
  and not has_table_privilege('authenticated',
      'private.network_profile_producer_activity_events','SELECT')
  and (select relrowsecurity from pg_class
       where oid='private.network_profile_producer_activity_events'::regclass),
  'metrics cannot bypass existing private RLS'
);
select pg_temp.prod1f_assert(
  (select prosecdef from pg_proc
   where oid='public.netprofile_prod1f_record_diagnostics(uuid,jsonb)'::regprocedure),
  'service-only audit function must use pinned security definer'
);

do $$
declare
  v_input jsonb := '{
    "html_pages":0,"editorial_blocks":0,"sentence_segments":0,
    "pages_without_editorial":0,"product_verb_segments":0,
    "working_verb_segments":0,"product_relation_segments":0,
    "working_relation_segments":0,"rejected_product_segments":0,
    "rejected_working_segments":0,"fetch_failures":0,
    "reason_bucket":"no_editorial_blocks"
  }'::jsonb;
  v_reply jsonb;
begin
  v_reply := public.netprofile_prod1f_record_diagnostics(
    '00000000-0000-0000-0000-000000000000'::uuid,v_input);
  if v_reply->>'contract' <> 'netprofile-prod1f-record-v1'
    or v_reply->>'saved' <> 'false' then
    raise exception 'Expected validation success and no matching recent event';
  end if;
  begin
    perform public.netprofile_prod1f_record_diagnostics(
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_input || '{"html_excerpt":"Produciamo tubi"}'::jsonb);
    raise exception 'HTML data was accepted by service-only telemetry';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.netprofile_prod1f_record_diagnostics(
      '00000000-0000-0000-0000-000000000000'::uuid,
      jsonb_set(v_input,'{editorial_blocks}','10000'::jsonb));
    raise exception 'Unbounded value was accepted';
  exception when sqlstate '22023' then null;
  end;
end $$;
rollback;
