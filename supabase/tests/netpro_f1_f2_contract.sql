-- NETPRO F1/F2 local-only acceptance. No paid user or entitlement is created.
begin;
do $$
declare v record;
begin
 if to_regclass('public.network_pro_checkout_intents') is null then
   raise exception 'NETPRO F1 billing intent table missing';
 end if;
 select c.relrowsecurity into v
 from pg_class c where c.oid='public.network_pro_checkout_intents'::regclass;
 if not v.relrowsecurity then
   raise exception 'NETPRO F1 RLS must be enabled';
 end if;
 if has_table_privilege('anon','public.network_pro_checkout_intents','SELECT') or
    has_table_privilege('authenticated','public.network_pro_checkout_intents','SELECT') or
    has_table_privilege('authenticated','public.network_pro_checkout_intents','INSERT') or
    has_table_privilege('authenticated','public.network_pro_checkout_intents','UPDATE') then
   raise exception 'NETPRO F1 browser must have zero direct checkout access';
 end if;
 if not has_table_privilege('service_role','public.network_pro_checkout_intents','INSERT') then
   raise exception 'NETPRO F1 billing service must insert sessions';
 end if;
 if to_regprocedure('public.netpro_f2_apply_paid_period(uuid,text,text,text,text,text,timestamptz)') is null or
    to_regprocedure('public.netpro_f2_end_subscription(text,text,text)') is null then
   raise exception 'NETPRO F2 automatic lifecycle RPC missing';
 end if;
 if has_function_privilege('authenticated',
    'public.netpro_f2_apply_paid_period(uuid,text,text,text,text,text,timestamptz)','EXECUTE') or
    has_function_privilege('anon',
    'public.netpro_f2_apply_paid_period(uuid,text,text,text,text,text,timestamptz)','EXECUTE') or
    has_function_privilege('authenticated',
    'public.netpro_f2_end_subscription(text,text,text)','EXECUTE') or
    has_function_privilege('anon',
    'public.netpro_f2_end_subscription(text,text,text)','EXECUTE') then
   raise exception 'NETPRO F2 entitlement RPC must never be browser-callable';
 end if;
 if not has_function_privilege('service_role',
    'public.netpro_f2_apply_paid_period(uuid,text,text,text,text,text,timestamptz)','EXECUTE') or
    not has_function_privilege('service_role',
    'public.netpro_f2_end_subscription(text,text,text)','EXECUTE') then
   raise exception 'NETPRO F2 service role must be able to reconcile';
 end if;
 if not exists (
   select 1 from pg_indexes where schemaname='public'
     and indexname='network_pro_checkout_intents_active_org'
     and indexdef like '%status IN (%'
 ) then
   raise exception 'NETPRO F1 one-active-subscription index missing';
 end if;
 if not exists (
   select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='netpro_f2_apply_paid_period'
     and not p.prosecdef
     and coalesce(array_to_string(p.proconfig,','),'') like '%search_path=""%'
 ) then
   raise exception 'NETPRO F2 reconciliation must run invoker with pinned search path';
 end if;
end
$$;
rollback;
