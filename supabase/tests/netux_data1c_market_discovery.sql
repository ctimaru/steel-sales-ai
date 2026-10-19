-- NET-UX DATA1C: market facts do not bypass company/tenant checks or become certification.
begin;
do $$
declare
 v_browse oid:=to_regprocedure('public.netdata1c_market_discovery_page(uuid,text,text,text,text,text,integer,integer)');
 v_stage oid:=to_regprocedure('public.netdata1c_stage_market(uuid,text,text,text)');
 v_review oid:=to_regprocedure('public.netdata1c_review_market(uuid,boolean)');
 v_queue oid:=to_regprocedure('public.netdata1c_market_review_queue(integer)');
begin
 if v_browse is null or v_stage is null or v_review is null or v_queue is null then
   raise exception 'Missing DATA1C market contract';
 end if;
 if has_function_privilege('anon',v_browse,'EXECUTE') or
    has_function_privilege('anon',v_stage,'EXECUTE') or
    has_function_privilege('anon',v_review,'EXECUTE') or
    has_function_privilege('authenticated',v_stage,'EXECUTE') or
    not has_function_privilege('authenticated',v_browse,'EXECUTE') or
    not has_function_privilege('authenticated',v_review,'EXECUTE') then
   raise exception 'DATA1C privilege boundary violation';
 end if;
 if not (select relrowsecurity from pg_class where oid='private.network_market_source_evidence'::regclass) then
   raise exception 'Candidate table missing RLS';
 end if;
 if (select pg_get_functiondef(v_browse) not like '%private.netux11_require_active_company%'
     or pg_get_functiondef(v_browse) not like '%private.pa1_3_require_network_access%') then
   raise exception 'Free/Pro identity gates missing';
 end if;
 if (select pg_get_functiondef(v_review) not like '%require_platform_permission%') then
   raise exception 'Human review requires platform rights';
 end if;
 if exists(select 1 from private.network_market_source_evidence e
     join public.network_core_target_leads l on l.id=e.lead_id
     where lower(regexp_replace(split_part(e.source_url,'/',3),'^www[.]',''))<>l.canonical_domain) then
   raise exception 'Cross-domain market source';
 end if;
end $$;
rollback;
