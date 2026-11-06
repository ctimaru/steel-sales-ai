-- RFQC1.EMAIL1.D — LOCAL CI contract smoke, read-only, no sent email.
begin transaction read only;

do $rfqc1test$
declare
  v_table regclass;
  v_api regprocedure;
  v_implementation regprocedure;
  v_body text;
begin
  v_table := to_regclass('public.buyer_rfq_inbound_email_receipts');
  if v_table is null then
    raise exception 'EMAIL1.D receipt ledger absent';
  end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = v_table) then
    raise exception 'EMAIL1.D ledger must enable RLS';
  end if;
  if has_table_privilege('anon', v_table, 'SELECT')
    or has_table_privilege('authenticated', v_table, 'SELECT')
    or has_table_privilege('anon', v_table, 'INSERT')
    or has_table_privilege('authenticated', v_table, 'INSERT')
    or has_table_privilege('service_role', v_table, 'SELECT')
  then
    raise exception 'EMAIL1.D ledger table grants are too broad';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'buyer_rfq_inbound_email_receipts'
  ) then
    raise exception 'EMAIL1.D ledger should not have client RLS policies';
  end if;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = v_table
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (provider, provider_email_id)'
  ) then
    raise exception 'EMAIL1.D missing provider EMAIL id uniqueness';
  end if;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = v_table
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (provider, provider_event_id)'
  ) then
    raise exception 'EMAIL1.D missing provider EVENT id uniqueness';
  end if;

  v_api := to_regprocedure(
    'public.rfqc1_ingest_received_email(text,text,uuid,uuid,text,boolean,text)'
  );
  v_implementation := to_regprocedure(
    'rfqh_secure.rfqc1_ingest_received_email_impl(text,text,uuid,uuid,text,boolean,text)'
  );
  if v_api is null or v_implementation is null then
    raise exception 'EMAIL1.D missing public/secure function pair';
  end if;
  if not has_function_privilege('anon', v_api, 'EXECUTE')
    or has_function_privilege('authenticated', v_api, 'EXECUTE')
    or has_function_privilege('authenticated', v_implementation, 'EXECUTE')
  then
    raise exception 'EMAIL1.D function execute grants mismatch';
  end if;
  if (select p.prosecdef from pg_proc p where p.oid = v_api) then
    raise exception 'EMAIL1.D public API must be SECURITY INVOKER';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = v_implementation) then
    raise exception 'EMAIL1.D secure implementation must be SECURITY DEFINER';
  end if;
  v_body := lower(pg_get_functiondef(v_implementation));
  if position('private.rfqh3_config' in v_body) = 0
    or position('p_sender_authenticated is distinct from true' in v_body) = 0
    or position('supplier_email_normalized = v_sender' in v_body) = 0
    or position('on conflict (provider, provider_email_id) do nothing' in v_body) = 0
    or position('for update' in v_body) = 0
    or position('rfqh3_log_event' in v_body) = 0
    or position('notification_status' in v_body) = 0
  then
    raise exception 'EMAIL1.D critical tenant/idempotency/security contract missing';
  end if;
end;
$rfqc1test$;

rollback;
