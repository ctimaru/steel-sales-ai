-- NET-CONNECT2D: scoped counts, real consent and explicit SQL permission boundary.
do $$
declare v_sql text;
begin
 if to_regprocedure('public.netconnect2d_company_progress(uuid)') is null
 then raise exception 'Company progress RPC absent';end if;
 if has_function_privilege('anon','public.netconnect2d_company_progress(uuid)','EXECUTE')
 then raise exception 'Anonymous progress access exposed';end if;
 if not has_function_privilege('authenticated','public.netconnect2d_company_progress(uuid)','EXECUTE')
 then raise exception 'Active company cannot use growth RPC';end if;
 if has_function_privilege('authenticated','private.netconnect2d_company_progress_impl(uuid)','EXECUTE')
 then raise exception 'Internal growth implementation exposed';end if;
 v_sql:=pg_get_functiondef('private.netconnect2d_company_progress_impl(uuid)'::regprocedure);
 if strpos(v_sql,'m.organization_id=p_organization_id')=0
    or strpos(v_sql,'m.user_id=(select auth.uid())')=0
    or strpos(v_sql,'m.status=''active''')=0
 then raise exception 'SQL lacks membership isolation';end if;
 if strpos(v_sql,'cl.status=''approved''')=0
    or strpos(v_sql,'l.link_status=''active''')=0
    or strpos(v_sql,'c.publication_status=''published''')=0
 then raise exception 'Claim approval and publication contract violated';end if;
 if strpos(v_sql,'r.status=''accepted''')=0
    or strpos(v_sql,'i.recipient_organization_id=p_organization_id')=0
 then raise exception 'Real connections not counted by party';end if;
 if strpos(lower(v_sql),'insert into public.')>0 or strpos(lower(v_sql),'update public.')>0
 then raise exception 'Growth report mutates data';end if;
end $$;
