-- NET-CONNECT2F — privacy and evidence boundaries for 90-day metrics.
do $$
declare b text;
begin
 if to_regprocedure('public.netconnect2f_intelligence(uuid,uuid[])') is null then
  raise exception 'Missing intelligence RPC';
 end if;
 if has_function_privilege('anon','public.netconnect2f_intelligence(uuid,uuid[])','EXECUTE') then
  raise exception 'Anonymous intelligence access forbidden';
 end if;
 if not has_function_privilege('authenticated','public.netconnect2f_intelligence(uuid,uuid[])','EXECUTE') then
  raise exception 'Active company members must have controlled entry point';
 end if;
 if has_function_privilege('authenticated','private.netconnect2f_intelligence_impl(uuid,uuid[])','EXECUTE') then
  raise exception 'Private intelligence implementation leaked';
 end if;
 b:=pg_get_functiondef('private.netconnect2f_intelligence_impl(uuid,uuid[])'::regprocedure);
 if strpos(b,'private.netux11_require_active_company(p_organization_id)')=0
   or strpos(b,'cl.status=''approved''')=0
   or strpos(b,'c.publication_status=''published''')=0
   or strpos(b,'p_company_ids,1),0)>24')=0
   or strpos(b,'r.sender_organization_id=p_organization_id')=0
   or strpos(b,'r.created_at>=now()-interval ''90 days''')=0
   or strpos(b,'v_decided>=3')=0
 then raise exception 'Intelligence contract guard absent';end if;
 if strpos(lower(b),'insert into public.')>0
   or strpos(lower(b),'update public.')>0
 then raise exception 'Intelligence must remain read only';end if;
end $$;
