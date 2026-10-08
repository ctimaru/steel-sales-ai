-- SP7.1 — Owner-only rights read model, no entitlement changes.
begin;
create function pg_temp.sp71_assert(ok boolean,msg text)
returns void language plpgsql as $$
begin
 if not coalesce(ok,false) then raise exception 'SP7.1: %',msg; end if;
end $$;

select pg_temp.sp71_assert(
  not has_function_privilege('anon','public.sp71_pilot_source_readiness()','EXECUTE'),
  'anon cannot call owner pilot status function'
);
select pg_temp.sp71_assert(
  not has_schema_privilege('authenticated','steel_pulse_private','USAGE') and
  not has_table_privilege('authenticated','steel_pulse_private.sources','SELECT'),
  'authenticated users do not receive direct source rights data'
);

-- A logged-in non-owner must fail even though authenticated has EXECUTE.
do $$
declare
  v_denied boolean := false;
begin
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000007101',true);
  execute 'set local role authenticated';
  begin
    perform public.sp71_pilot_source_readiness();
  exception when sqlstate '42501' then
    v_denied:=true;
  end;
  execute 'reset role';
  if not v_denied then
    raise exception 'SP7.1 normal authenticated user was able to view source controls';
  end if;
end $$;

select pg_temp.sp71_assert(
 (select count(*)=1 from steel_pulse_private.sources where
  id='ec_dg_trade' and status='candidate'
  and license_basis='unverified'
  and cardinality(approved_operations)=0
  and reviewer_user_id is null and legal_reviewer_user_id is null),
 'pilot rights never auto-approve'
);
select pg_temp.sp71_assert(
 (select enabled=false from steel_pulse_private.publication_settings where singleton=true),
 'public kill switch remains disabled'
);
select pg_temp.sp71_assert(
 (select count(*)=0 from steel_pulse_private.items i where i.source_id='ec_dg_trade'),
 'SP7.1 does not crawl the source'
);
rollback;
