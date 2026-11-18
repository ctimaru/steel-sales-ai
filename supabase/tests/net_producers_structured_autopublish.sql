-- NET-PRODUCERS C3.DATA1: local acceptance on a disposable Supabase database.
\set ON_ERROR_STOP on
begin;

do $contract$
declare
  v_total integer;
  v_parsed jsonb;
begin
  select count(*) into v_total from private.network_producer_structured_facts;
  if v_total<60 then
    raise exception 'Expected initial atomic technical facts to be materialized: %',v_total;
  end if;

  v_parsed:=private.netproducers1_structure_dimension(
    'Rettangolare: 20×10–400×200 mm; sp. 1,5–12,5 mm');
  if v_parsed->>'shape_code'<>'RHS'
    or (v_parsed->>'width_min_mm')::numeric<>20
    or (v_parsed->>'height_min_mm')::numeric<>10
    or (v_parsed->>'width_max_mm')::numeric<>400
    or (v_parsed->>'height_max_mm')::numeric<>200
    or (v_parsed->>'thickness_min_mm')::numeric<>1.5
    or (v_parsed->>'thickness_max_mm')::numeric<>12.5 then
    raise exception 'RHS dimensional range was not converted into usable numeric fields';
  end if;

  v_parsed:=private.netproducers1_structure_dimension(
    'Tondo: Ø 21,3–114,3 mm');
  if v_parsed->>'shape_code'<>'CHS'
    or (v_parsed->>'diameter_min_mm')::numeric<>21.3
    or (v_parsed->>'diameter_max_mm')::numeric<>114.3
    or v_parsed ? 'thickness_min_mm' then
    raise exception 'CHS range must not invent a thickness';
  end if;

  if exists (
    select 1 from private.network_producer_structured_facts
    where kind='dimension_range' and
      (shape_code='SHS' and width_min_mm is not null
        and height_min_mm<>width_min_mm)
  ) then
    raise exception 'SHS dimensions are not internally consistent';
  end if;
  if not exists(
    select 1 from private.network_producer_structured_facts s
    join public.network_companies c on c.id=s.company_id
    where c.legal_name ilike 'Alessio Tubi%'
      and s.kind='dimension_range' and s.shape_code='RHS'
      and s.width_min_mm=20 and s.height_min_mm=10
      and s.width_max_mm=400 and s.height_max_mm=200
      and s.thickness_min_mm=1.5 and s.thickness_max_mm=12.5
  ) then
    raise exception 'Real seeded Alessio Tubi numeric dimensional range missing';
  end if;
  if not exists(
    select 1 from pg_trigger t
    where t.tgname='netproducers1_structured_auto_publish'
      and t.tgenabled='O'
  ) then
    raise exception 'Newly observed facts will not auto-publish';
  end if;
  if not (select relrowsecurity
    from pg_class where oid='private.network_producer_structured_facts'::regclass)
    or has_table_privilege(
      'authenticated','private.network_producer_structured_facts','SELECT'
    ) or has_table_privilege(
      'anon','private.network_producer_structured_facts','SELECT'
    ) then
    raise exception 'Structured fact table is browser readable directly';
  end if;
end;
$contract$;

set local role anon;
do $public$
declare v jsonb;
begin
  v:=public.netproducers1_structured_public('',160);
  if v->>'contract'<>'netproducers-structured-public-v1'
    or v->>'exact_skus_confirmed'<>'0'
    or v->>'source_pdf_copies'<>'0'
    or (v->>'total_facts')::int<60
    or exists(select 1 from jsonb_array_elements(v->'items') x
      where x->>'review_status'<>'pending_producer_confirmation'
        or x->>'source_url' not like 'https://%')
  then
    raise exception 'Unverified structured observations were promoted to capabilities';
  end if;
  if (public.netproducers1_structured_public('S355J2H',160)->>'count')::int<1 then
    raise exception 'Structured technical search missing first-party grade';
  end if;
end;
$public$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
do $unauthorized$
declare refused boolean:=false;
begin
  begin
    perform public.netproducers1_structured_owner_manage(
      'remove','51100000-0000-5000-8000-000000000002'::uuid,
      (select id from private.network_producer_structured_facts limit 1));
  exception when sqlstate '42501' then
    refused:=true;
  end;
  if not refused then
    raise exception 'User without producer claim can remove another company fact';
  end if;
end;
$unauthorized$;
reset role;
rollback;
select 'C3.DATA1 PASS — normalized ranges, anon read-only, unauthorized removal denied' result;
