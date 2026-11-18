-- B3.C2: real Postgres privilege + JWT-scope negative acceptance.
-- Runs only against throwaway local Supabase. Never creates production grants.
\set ON_ERROR_STOP on
begin;

do $guard$
begin
  if not has_function_privilege(
    'authenticated','public.netproducers1_b3c2_catalog_submission(text,jsonb)','EXECUTE'
  ) then
    raise exception 'B3.C2 authenticated facade missing';
  end if;
  if has_function_privilege(
    'anon','public.netproducers1_b3c2_catalog_submission(text,jsonb)','EXECUTE'
  ) then
    raise exception 'B3.C2 anonymous role can call privileged facade';
  end if;
  if has_function_privilege(
    'authenticated','private.netproducers1_b3c2_catalog_submission(text,jsonb)','EXECUTE'
  ) then
    raise exception 'B3.C2 browser can call private implementation directly';
  end if;
  if has_table_privilege(
    'authenticated','private.network_producer_catalog_submissions','SELECT'
  ) then
    raise exception 'B3.C2 private submission data leaked';
  end if;
  if (select count(*) from pg_policies
      where schemaname='storage' and tablename='objects'
        and policyname='netproducers1_b3c2_verified_company_catalog_insert'
        and cmd='INSERT')<>1 then
    raise exception 'B3.C2 scoped object insert policy required';
  end if;
  if exists(select 1 from pg_policies
      where schemaname='storage' and tablename='objects'
        and policyname like 'netproducers1_b3c2%'
        and cmd<>'INSERT') then
    raise exception 'B3.C2 browser must not list, read, replace or delete objects';
  end if;
end;
$guard$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $negative$
declare
  v_result jsonb;
  v_denied boolean:=false;
  v_company uuid:='00000000-0000-4000-8000-000000000099';
begin
  v_result:=public.netproducers1_b3c2_catalog_submission(
    'status',jsonb_build_object('company_id',v_company));
  if v_result->>'eligible'<>'false' or v_result->'items'<>'[]'::jsonb then
    raise exception 'B3.C2 forged membership returned eligible';
  end if;

  begin
    perform public.netproducers1_b3c2_catalog_submission(
      'prepare',jsonb_build_object(
        'company_id',v_company,
        'source_url','https://impostor.invalid/catalog.pdf',
        'format','pdf','edition','2026',
        'name','catalog.pdf','sha256',repeat('0',64),
        'rights_declaration',true));
  exception when sqlstate '42501' then
    v_denied:=true;
  end;
  if not v_denied then
    raise exception 'B3.C2 forged verified company claim accepted';
  end if;
  if private.netproducers1_b3c2_can_insert_object(
       v_company::text||'/00000000-0000-4000-8000-000000000098/'||
       repeat('0',64)||'.pdf') then
    raise exception 'B3.C2 unprepared object insertion accepted';
  end if;
end;
$negative$;
reset role;
rollback;
select 'B3.C2 PASS — anon and forged producer identity denied' as result;
