-- RFQC1.EMAIL1.E: read-only security-contract check (local CI).
begin transaction read only;
do $rfqc1$
declare
  v_api regprocedure;
  v_impl regprocedure;
  v_definition text;
begin
  v_api := to_regprocedure('public.rfqc1_received_dispatch_context(text,uuid)');
  v_impl := to_regprocedure('rfqh_secure.rfqc1_received_dispatch_context_impl(text,uuid)');
  if v_api is null or v_impl is null then
    raise exception 'EMAIL1.E dispatch lookup functions missing';
  end if;
  if not has_function_privilege('anon',v_api,'EXECUTE')
     or has_function_privilege('authenticated',v_api,'EXECUTE')
     or has_function_privilege('service_role',v_impl,'EXECUTE')
     or has_function_privilege('authenticated',v_impl,'EXECUTE') then
    raise exception 'EMAIL1.E lookup RPC privilege boundary incorrect';
  end if;
  if (select p.prosecdef from pg_proc p where p.oid=v_api) then
    raise exception 'EMAIL1.E exposed lookup must be SECURITY INVOKER';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid=v_impl) then
    raise exception 'EMAIL1.E private lookup must be SECURITY DEFINER';
  end if;

  v_definition := lower(pg_get_functiondef(v_impl));
  if position('private.rfqh3_config' in v_definition)=0
    or position('webhook_db_secret_sha256' in v_definition)=0
    or position('d.provider = ''resend''' in v_definition)=0
    or position('s.supplier_email_normalized is not null' in v_definition)=0
    or position('c.organization_id = v_dispatch.organization_id' in v_definition)=0
    or position('s.delivery_channel in (''email'',''both'')' in v_definition)=0
    or position('c.status in (''launched'',''collecting'')' in v_definition)=0 then
    raise exception 'EMAIL1.E lookup lost identity/auth/tenant restrictions';
  end if;
end;
$rfqc1$;
rollback;
