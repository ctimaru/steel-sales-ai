-- NET-CONNECT2B: ensure owner-only reporting, evidence-only reconciliation, no tenant leak.
do $$
declare v_sql text;
begin
 if to_regprocedure('public.netconnect2b_activation_overview()') is null
 then raise exception 'owner activation overview RPC missing'; end if;
 if has_function_privilege('anon','public.netconnect2b_activation_overview()','EXECUTE')
 then raise exception 'anonymous activation overview exposed';end if;
 if not has_function_privilege('authenticated','public.netconnect2b_activation_overview()','EXECUTE')
 then raise exception 'platform owner cannot read guarded overview';end if;
 if has_function_privilege('authenticated','private.netconnect2b_activation_overview_impl()','EXECUTE')
    or has_function_privilege('authenticated','private.netconnect2b_capture_exact_canonical(uuid)','EXECUTE')
 then raise exception 'private implementation exposed';end if;
 if has_table_privilege('authenticated','private.netconnect2b_canonical_evidence','SELECT')
    or has_table_privilege('anon','private.netconnect2b_canonical_evidence','SELECT')
 then raise exception 'reconciliation ledger publicly accessible';end if;
 if not (select relrowsecurity from pg_class
  where oid='private.netconnect2b_canonical_evidence'::regclass)
 then raise exception 'ledger lacks RLS';end if;
 v_sql:=pg_get_functiondef('private.netconnect2b_activation_overview_impl()'::regprocedure);
 if strpos(v_sql,'private.is_platform_superadmin()')=0
 then raise exception 'snapshot missing owner guard';end if;
 if strpos(v_sql,'companies_linked_and_claim_approved')=0
    or strpos(v_sql,'public.organization_memberships')=0
 then raise exception 'reachable metric is not based on active link + approved claim';end if;
 v_sql:=pg_get_functiondef('private.netconnect2b_capture_exact_canonical(uuid)'::regprocedure);
 if strpos(v_sql,'private.netconnect2b_domain')=0
    or strpos(v_sql,'private.netconnect2b_legal_key')=0
    or strpos(v_sql,'count(*) from public.network_companies other')=0
 then raise exception 'reconciliation not constrained to unique identity evidence';end if;
 if strpos(v_sql,'update public.network_companies')>0
    or strpos(v_sql,'update public.network_company_claims')>0
    or strpos(v_sql,'insert into public.organization_network_company_links')>0
 then raise exception 'evidence must not promote/claim/link companies';end if;
 if not exists(select 1 from pg_trigger
  where tgname='netconnect2b_capture_published_identity' and not tgisinternal)
 then raise exception 'automatic canonical audit trigger absent';end if;
end $$;
