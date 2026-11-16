-- NET-PRO-PRODUCERS1.AUTO1.B local acceptance: never mutate production.
BEGIN;
create or replace function pg_temp.auto1b_assert(p_ok boolean,p_message text)
returns void language plpgsql as $$
begin
 if not coalesce(p_ok,false) then
   raise exception 'AUTO1.B assertion: %',p_message;
 end if;
end;
$$;

select pg_temp.auto1b_assert(
 to_regprocedure('public.netproducers1_auto1b_verify(integer)') is not null
 and to_regprocedure('public.netproducers1_auto1b_mentions(uuid,uuid[])') is not null,
 'verifier/paid reader RPCs are installed'
);
select pg_temp.auto1b_assert(
 not has_function_privilege('anon','public.netproducers1_auto1b_verify(integer)','execute')
 and not has_function_privilege('authenticated','public.netproducers1_auto1b_verify(integer)','execute')
 and has_function_privilege('service_role','public.netproducers1_auto1b_verify(integer)','execute'),
 'only the service role may verify source candidates'
);
select pg_temp.auto1b_assert(
 not has_table_privilege('anon','private.network_producer_auto1_verification_events','SELECT')
 and not has_table_privilege('authenticated','private.network_producer_auto1_verification_events','SELECT')
 and not has_table_privilege('authenticated','private.network_producer_auto1_candidates','SELECT'),
 'candidate evidence and audit ledger must stay private'
);
select pg_temp.auto1b_assert(
 (select relrowsecurity from pg_class where oid='private.network_producer_auto1_verification_events'::regclass),
 'private verification audit table must have RLS'
);
select pg_temp.auto1b_assert(
 (select count(*) from private.network_producer_auto1_verification_events)=0,
 'fresh isolated test DB must start without machine reviews'
);
select pg_temp.auto1b_assert(
 (private.netproducers1_auto1b_verify(100)->>'manufacturing_capabilities_published')::int=0,
 'verifying source mentions cannot publish actual manufacture of a SKU'
);
select pg_temp.auto1b_assert(
 (private.netproducers1_auto1b_verify(100)->>'checked')::int=0,
 'empty queue verification should be idempotent'
);
ROLLBACK;
