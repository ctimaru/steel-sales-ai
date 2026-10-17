-- NET-CONNECT2E: no provisional invitations, no cross-tenant probing.
do $$
declare body text;
begin
 if to_regprocedure('public.netconnect2e_readiness(uuid,uuid[])') is null then
  raise exception 'Missing readiness RPC';
 end if;
 if has_function_privilege('anon','public.netconnect2e_readiness(uuid,uuid[])','EXECUTE') then
  raise exception 'Anonymous readiness access is forbidden';
 end if;
 if not has_function_privilege('authenticated','public.netconnect2e_readiness(uuid,uuid[])','EXECUTE') then
  raise exception 'Company user cannot access readiness';
 end if;
 if has_function_privilege('authenticated','private.netconnect2e_readiness_impl(uuid,uuid[])','EXECUTE') then
  raise exception 'Private readiness implementation exposed';
 end if;
 body:=pg_get_functiondef('private.netconnect2e_readiness_impl(uuid,uuid[])'::regprocedure);
 if strpos(body,'private.netux11_require_active_company(p_organization_id)')=0
   or strpos(body,'private.p4_inquiry_eligibility_impl(p_organization_id,v_company)')=0
   or strpos(body,'c.publication_status=''published''')=0
   or strpos(body,'c.archived_at is null')=0
   or strpos(body,'p_company_ids,1),0)>24')=0
 then raise exception 'Missing source, bounded-input or eligibility guard';end if;
 if strpos(body,'r.sender_organization_id=p_organization_id')=0
   or strpos(body,'r.status=''pending''')=0
   or strpos(body,'r.status=''accepted''')=0
 then raise exception 'Missing actual connection status evidence';end if;
 if strpos(lower(body),'insert into public.')>0
   or strpos(lower(body),'update public.')>0 then
  raise exception 'Readiness must never send invitations';
 end if;
end $$;
