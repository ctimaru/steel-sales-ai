-- NET-LAUNCH4B: page RPC never opens the private Network to anonymous clients.
do $$
declare v_signature text:='public.netlaunch4b_browse_page(uuid,text,text,text,text,text,text,integer,integer)';
        v_impl text;
begin
 if to_regprocedure(v_signature) is null then raise exception 'Missing NET-LAUNCH4B public RPC'; end if;
 if has_function_privilege('anon',to_regprocedure(v_signature),'EXECUTE')
 then raise exception 'Anonymous Network browse is forbidden'; end if;
 if not has_function_privilege('authenticated',to_regprocedure(v_signature),'EXECUTE')
 then raise exception 'Active members cannot call Network page reader'; end if;
 if has_function_privilege('authenticated',to_regprocedure('private.netlaunch4b_browse_page_impl(uuid,text,text,text,text,text,text,integer,integer)'),'EXECUTE')
 then raise exception 'The private paging reader must not be directly executable'; end if;
 select pg_get_functiondef(to_regprocedure('private.netlaunch4b_browse_page_impl(uuid,text,text,text,text,text,text,integer,integer)')) into v_impl;
 if strpos(v_impl,'private.netux11_require_active_company(p_organization_id)')=0
   or strpos(v_impl,'private.pa1_3_require_network_access(p_organization_id)')=0
 then raise exception 'Both existing membership/entitlement guards must remain'; end if;
 if strpos(v_impl,'limit v_limit offset (v_page-1)*v_limit')=0
 then raise exception 'Server page selection must use bounded SQL LIMIT/OFFSET';end if;
 if strpos(v_impl,'private.netfast_discovered_records')=0
    or strpos(v_impl,'publication_status=''published''')=0
 then raise exception 'Published/provisional source boundaries are missing';end if;
end $$;
