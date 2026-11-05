-- NET-GROWTH3.G.3: fail-closed permissions and no automatic company ownership.
do $$
declare v_def text;
begin
  if to_regclass('private.netgrowth3g3_reconciliation_requests') is null
    then raise exception 'reconciliation ledger not created'; end if;
  if not (select relrowsecurity from pg_class
    where oid='private.netgrowth3g3_reconciliation_requests'::regclass)
    then raise exception 'reconciliation ledger not RLS guarded'; end if;
  if has_table_privilege('anon','private.netgrowth3g3_reconciliation_requests','SELECT')
     or has_table_privilege('authenticated','private.netgrowth3g3_reconciliation_requests','INSERT')
     or has_table_privilege('authenticated','private.netgrowth3g3_reconciliation_requests','UPDATE')
    then raise exception 'reconciliation ledger exposed directly'; end if;
  if has_function_privilege('anon','public.netgrowth3g3_request_reconciliation(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.netgrowth3g3_review_reconciliation(uuid,text,text)','EXECUTE')
    then raise exception 'unauthenticated RPC access'; end if;
  if not has_function_privilege('authenticated','public.netgrowth3g3_request_reconciliation(uuid,uuid,text)','EXECUTE')
    then raise exception 'authenticated requester RPC inaccessible'; end if;
  if (select prosecdef from pg_proc where oid='public.netgrowth3g3_review_reconciliation(uuid,text,text)'::regprocedure)
    then raise exception 'public review RPC must be invoker'; end if;
  v_def:=pg_get_functiondef('private.netgrowth3g3_request_impl(uuid,uuid,text)'::regprocedure);
  if strpos(v_def,'private.netgrowth3g3_require_org_admin')=0
     or strpos(v_def,'private.netfast_discovered_records')=0
     or strpos(v_def,'organization already manages')=0
    then raise exception 'request lacks admin/source/ownership guard'; end if;
  v_def:=pg_get_functiondef('private.netgrowth3g3_review_impl(uuid,text,text)'::regprocedure);
  if strpos(v_def,'private.require_platform_permission')=0
     or strpos(v_def,'match_state=''strong_evidence''')=0
     or strpos(v_def,'application_status=''activated''')=0
     or strpos(v_def,'email_verified_at is not null')=0
     or strpos(v_def,'''unverified''')=0
    then raise exception 'review missing explicit trust controls'; end if;
  if strpos(v_def,'insert into public.network_company_claims')>0
     or strpos(v_def,'insert into public.organization_network_company_links')>0
    then raise exception 'reconciliation must not create claims or ownership'; end if;
end $$;
