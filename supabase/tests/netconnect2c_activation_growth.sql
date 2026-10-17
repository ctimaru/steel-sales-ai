-- NET-CONNECT2C security, reporting semantics and no-write checks.
do $$
declare v_sql text;
begin
 if to_regprocedure('public.netconnect2c_growth_overview()') is null then
  raise exception 'growth overview RPC missing';end if;
 if has_function_privilege('anon','public.netconnect2c_growth_overview()','EXECUTE') then
  raise exception 'anonymous growth RPC exposed';end if;
 if not has_function_privilege('authenticated','public.netconnect2c_growth_overview()','EXECUTE') then
  raise exception 'authenticated owner cannot execute guarded growth RPC';end if;
 if has_function_privilege('authenticated','private.netconnect2c_growth_impl()','EXECUTE') then
  raise exception 'private implementation exposed';end if;
 v_sql:=pg_get_functiondef('private.netconnect2c_growth_impl()'::regprocedure);
 if strpos(v_sql,'private.is_platform_superadmin()')=0 then
  raise exception 'SQL owner guard missing';end if;
 if strpos(v_sql,'cl.status=''approved''')=0
  or strpos(v_sql,'l.link_status=''active''')=0
  or strpos(v_sql,'m.status=''active''')=0 then
   raise exception 'active owner evidence missing';end if;
 if strpos(v_sql,'submitted_at at time zone ''UTC''')=0
  or strpos(v_sql,'now()-interval ''30 days''')=0 then
   raise exception 'cohort timeframe ungrounded';end if;
 if strpos(lower(v_sql),'insert into public.')>0
  or strpos(lower(v_sql),'update public.')>0 then
   raise exception 'growth overview must be read-only';end if;
end $$;
