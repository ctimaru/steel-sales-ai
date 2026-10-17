-- NET-CONNECT1 tests: private purpose-tagged company connections.
do $$
declare
 sig_submit text:='public.netconnect1_submit(uuid,uuid,text,text)';
 sig_decide text:='public.netconnect1_decide(uuid,uuid,text)';
 sig_list text:='public.netconnect1_list(uuid,text,integer,integer)';
 body text;
begin
 if to_regprocedure(sig_submit) is null or to_regprocedure(sig_decide) is null
    or to_regprocedure(sig_list) is null then
   raise exception 'Missing connection public RPC'; end if;
 if has_function_privilege('anon',sig_submit,'EXECUTE')
    or has_function_privilege('anon',sig_decide,'EXECUTE')
    or has_function_privilege('anon',sig_list,'EXECUTE')
 then raise exception 'Anonymous connection functions must not be executable';end if;
 if not has_function_privilege('authenticated',sig_submit,'EXECUTE')
   or not has_function_privilege('authenticated',sig_decide,'EXECUTE')
   or not has_function_privilege('authenticated',sig_list,'EXECUTE')
 then raise exception 'Active users must invoke guarded RPC';end if;
 if has_function_privilege('authenticated','private.netconnect1_submit_impl(uuid,uuid,text,text)','EXECUTE')
 or has_function_privilege('authenticated','private.netconnect1_decide_impl(uuid,uuid,text)','EXECUTE')
 or has_function_privilege('authenticated','private.netconnect1_list_impl(uuid,text,integer,integer)','EXECUTE')
 then raise exception 'Private connection functions are internal only'; end if;
 if has_table_privilege('authenticated','public.network_connection_requests','SELECT')
 or has_table_privilege('authenticated','public.network_connection_requests','INSERT')
 or has_table_privilege('anon','public.network_connection_requests','SELECT')
 then raise exception 'No direct connection table access'; end if;
 if not (select relrowsecurity from pg_class where oid='public.network_connection_requests'::regclass)
 then raise exception 'Connection table requires RLS';end if;
 body:=pg_get_functiondef('private.netconnect1_submit_impl(uuid,uuid,text,text)'::regprocedure);
 if strpos(body,'private.netux11_require_active_company')=0
  or strpos(body,'private.p4_submit_inquiry_impl')=0
  or strpos(body,'length(btrim(coalesce(p_message')=0
 then raise exception 'Free tenant guard, P4 anti-spam engine, or mandatory reason absent';end if;
 body:=pg_get_functiondef('private.netconnect1_decide_impl(uuid,uuid,text)'::regprocedure);
 if strpos(body,'private.p4_transition_inquiry_impl')=0
   or strpos(body,'p_actor_organization_id')=0
 then raise exception 'Governed participant decision missing';end if;
 body:=pg_get_functiondef('private.netconnect1_list_impl(uuid,text,integer,integer)'::regprocedure);
 if strpos(body,'private.netux11_require_active_company')=0
   or strpos(body,'public.organization_memberships')=0
 then raise exception 'Connection inbox lacks tenant scoping';end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and tablename='network_connection_requests'
   and indexname='netconnect1_one_pending_pair')
 then raise exception 'Duplicate pending request guard missing';end if;
end $$;
