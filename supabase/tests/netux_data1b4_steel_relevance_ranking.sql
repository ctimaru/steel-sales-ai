-- DATA1B.4 security and ranking contract; production test is read-only / rolled back.
begin;
do $$
declare v_fn oid:=to_regprocedure('public.netdata1b4_steel_relevance_page(uuid,text,text,text,text,integer,integer)');
begin
 if v_fn is null then raise exception 'DATA1B.4 steel ranking is missing';end if;
 if has_function_privilege('anon',v_fn,'EXECUTE')
    or not has_function_privilege('authenticated',v_fn,'EXECUTE') then
   raise exception 'DATA1B.4 privilege violation';
 end if;
 if pg_get_functiondef(v_fn) not like '%private.netux11_require_active_company%'
    or pg_get_functiondef(v_fn) not like '%private.pa1_3_require_network_access%'
    or pg_get_functiondef(v_fn) not like '%private.network_company_enrichment%'
    or pg_get_functiondef(v_fn) not like '%b.domain_uses=1%' then
   raise exception 'DATA1B.4 trust or identity guard missing';
 end if;
 if exists (select 1 from private.network_company_enrichment e
   where e.extractor_version='netux-data1b3-steel-relevance-v1'
     and e.review_status<>'candidate') then
   raise exception 'DATA1B.3 evidence unexpectedly promoted';
 end if;
end $$;
rollback;
