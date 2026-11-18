-- NET-PRODUCERS B3.C2.B: local acceptance on reconstructed throwaway database.
-- Run with psql -v ON_ERROR_STOP=1; no fake producer rights or B2 grant.
\set ON_ERROR_STOP on
begin;

do $body$
declare
  func_oid oid;
begin
  select p.oid into func_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='netproducers1_b3c2b_verified_issuer';
  if func_oid is null
     or has_function_privilege('anon',func_oid,'EXECUTE')
     or has_function_privilege('authenticated',func_oid,'EXECUTE')
     or not has_function_privilege('service_role',func_oid,'EXECUTE') then
    raise exception 'B3C2B issuer is not service-only';
  end if;
  if has_table_privilege(
    'authenticated','private.network_producer_catalog_submissions','SELECT'
  ) or has_table_privilege(
    'authenticated',
    'private.network_producer_catalog_source_verification_events','SELECT'
  ) then
    raise exception 'B3C2B private corpus leaked to browser';
  end if;
  if not (select relrowsecurity from pg_class
      where oid='private.network_producer_catalog_source_verification_events'::regclass)
  then
    raise exception 'B3C2B audit RLS missing';
  end if;
  if not exists(select 1 from pg_trigger
    where tgrelid='private.network_producer_catalog_submissions'::regclass
      and tgname='netproducers1_b3c2b_clear_lease_on_withdraw'
      and tgenabled='O') then
    raise exception 'B3C2B withdrawal cannot cancel an active lease';
  end if;
end;
$body$;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000093',true);
do $body$
declare
  refused boolean:=false;
begin
  begin
    perform public.netproducers1_b3c2b_verified_issuer(
      'accept',jsonb_build_object(
        'company_id','00000000-0000-4000-8000-000000000093',
        'catalog_id','00000000-0000-4000-8000-000000000094',
        'source_sha256',repeat('0',64),
        'lease_token','00000000-0000-4000-8000-000000000095'
      )
    );
  exception when insufficient_privilege then
    refused:=true;
  end;
  if not refused then
    raise exception 'B3C2B unauthorized company user can issue catalogue rights';
  end if;
end;
$body$;
reset role;
rollback;
select 'B3.C2.B PASS — protected issuer, revocation and private audit' as result;
