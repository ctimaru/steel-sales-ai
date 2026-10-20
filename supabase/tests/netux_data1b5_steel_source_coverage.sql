-- DATA1B.5: do not expose source queue to anon/tenants or mutate source evidence.
begin;
do $$
declare f oid:=to_regprocedure('public.netdata1b5_coverage_queue(integer,integer,boolean)');
begin
 if f is null then raise exception 'DATA1B.5 coverage RPC missing';end if;
 if has_function_privilege('anon',f,'EXECUTE') or
    not has_function_privilege('authenticated',f,'EXECUTE') then
   raise exception 'DATA1B.5 role grant boundary violated';
 end if;
 if pg_get_functiondef(f) not like '%private.require_platform_permission%'
    or lower(pg_get_functiondef(f)) not like '%security definer%'
    or lower(pg_get_functiondef(f)) not like '%set search_path%'
    or pg_get_functiondef(f) not like '%source_rights_verified%' then
   raise exception 'DATA1B.5 source governance guard missing';
 end if;
 if not (select relrowsecurity from pg_class where oid='private.netdata1b5_source_holds'::regclass)
 then raise exception 'DATA1B.5 private holds lack RLS';end if;
 if has_table_privilege('authenticated','private.netdata1b5_source_holds','SELECT')
 then raise exception 'DATA1B.5 private governance holds exposed';end if;
 if (select count(*) from private.network_company_enrichment
     where extractor_version='netux-data1b5-manual-source-batch-v1'
       and review_status<>'candidate')>0 then
   raise exception 'DATA1B.5 source candidates unexpectedly promoted';
 end if;
end $$;
rollback;
