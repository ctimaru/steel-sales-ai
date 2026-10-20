-- NET-UX DATA1B.5D: platform-only source audit trace.
begin;
do $$
declare f oid:=to_regprocedure('public.netdata1b5_coverage_queue(integer,integer,boolean)');
begin
 if f is null then raise exception 'DATA1B.5D missing coverage function';end if;
 if has_function_privilege('anon',f,'EXECUTE')
   or not has_function_privilege('authenticated',f,'EXECUTE') then
  raise exception 'DATA1B.5D function grants unsafe';
 end if;
 if has_table_privilege('anon','private.netdata1b5_source_assessments','SELECT')
   or has_table_privilege('authenticated','private.netdata1b5_source_assessments','SELECT') then
  raise exception 'DATA1B.5D audit ledger exposed';
 end if;
 if not (select relrowsecurity from pg_class where oid='private.netdata1b5_source_assessments'::regclass) then
  raise exception 'DATA1B.5D no RLS';
 end if;
 if (select count(*) from private.netdata1b5_source_assessments
     where assessment_batch='netux-data1b5d-research-v1')<>15 then
  raise exception 'DATA1B.5D incomplete audit sample';
 end if;
 if exists(select 1 from private.netdata1b5_source_assessments
    where legal_identity_verified or commercial_capability_verified or
    source_reuse_rights <> 'not_assessed') then
  raise exception 'DATA1B.5D inappropriate approval';
 end if;
 if (select role_key from private.netfast_discovered_records where domain='asgspa.it')
    <> 'processor_service_provider' then
  raise exception 'ASG governance source was overwritten without review';
 end if;
 if (select count(*) from private.netdata1b5_source_assessments
     where role_suggestion='trader_distributor'
       and source_url='https://www.asgspa.it/it/company') <> 1 then
  raise exception 'ASG reviewed role proposal missing';
 end if;
 if pg_get_functiondef(f) not like '%private.require_platform_permission%'
   or pg_get_functiondef(f) not like '%source_assessed_profiles%'
   or pg_get_functiondef(f) not like '%role_suggestions_pending%' then
  raise exception 'DATA1B.5D platform gate or audit totals missing';
 end if;
end $$;
rollback;
