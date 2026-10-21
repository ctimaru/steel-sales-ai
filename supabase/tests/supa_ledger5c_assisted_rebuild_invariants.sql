-- SUPA-LEDGER5C — *ASSISTED* local P0 rebuild acceptance invariants.
-- CI injects two pre-worker baselines BEFORE "supabase db reset --local".
-- This is NOT evidence that supabase/migrations alone forms a clean rebuild.
-- All checks are read-only, within a rolled-back local test transaction.
begin;
do $tests$
declare
  v_10210 integer;
  v_10219 integer;
  v_geo_count integer;
begin
  -- M5 golden retrieval integrity: both FK and current chunk-document bindings.
  if to_regclass('public.retrieval_golden_query_targets') is null
     or to_regclass('public.knowledge_chunks') is null then
    raise exception 'LEDGER5C: M5 golden targets / chunks missing';
  end if;
  if not exists(
    select 1 from pg_constraint c join pg_class r on r.oid=c.conrelid
    where r.oid='public.retrieval_golden_query_targets'::regclass
      and c.contype='f' and c.conname='retrieval_golden_query_targets_chunk_id_fkey'
  ) then
    raise exception 'LEDGER5C: M5 target-to-chunk FK absent';
  end if;
  if exists(
    select 1 from public.retrieval_golden_query_targets t
      left join public.knowledge_chunks k on k.id=t.chunk_id
    where k.id is null or k.document_id is null
  ) then
    raise exception 'LEDGER5C: M5 target contains dangling chunk/document';
  end if;
  if exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('get_retrieval_golden_queries','get_retrieval_golden_query_stats')
      and (has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('authenticated',p.oid,'EXECUTE'))
  ) then raise exception 'LEDGER5C: private golden benchmark API exposed'; end if;

  -- SK4.2 published supplier ranges are NOT an exhaustive EN norm.
  select count(*) into v_10210
    from public.steel_standard_dimension_applicability a
      join public.steel_standards s on s.id=a.standard_id
    where s.code='EN 10210' and not a.is_normative_complete;
  select count(*) into v_10219
    from public.steel_standard_dimension_applicability a
      join public.steel_standards s on s.id=a.standard_id
    where s.code='EN 10219' and not a.is_normative_complete;
  if v_10210<>32 or v_10219<>50 then
    raise exception 'LEDGER5C: structural seed counts drift: EN10210 %, EN10219 %',
       v_10210,v_10219;
  end if;
  if exists (select 1 from public.steel_standard_dimension_applicability
             where is_normative_complete) then
    raise exception 'LEDGER5C: manufacturer sample marked normative-complete';
  end if;

  -- PL1.5 generated geometry ID must survive base replay.
  if not exists(select 1 from pg_attribute a
    where a.attrelid='public.steel_geometries'::regclass
      and a.attname='geometry_key' and a.attgenerated='s') then
    raise exception 'LEDGER5C: PL1.5 geometry_key not generated STORED';
  end if;
  select count(*) into v_geo_count from public.steel_geometries;
  if v_geo_count=0 or exists(
    select 1 from public.steel_geometries
    where geometry_key is null or btrim(geometry_key)=''
  ) then raise exception 'LEDGER5C: missing/empty geometry keys'; end if;
  if exists(select 1 from public.steel_geometries
   group by geometry_key having count(*)>1) then
    raise exception 'LEDGER5C: duplicate canonical geometry keys';
  end if;

  -- Rights: private supplier list cannot become publicly visible by rebuild.
  if exists(select 1 from public.price_list_versions v
    where v.publication_scope='internal' and
     (public.pl1_version_visible_to(v.id,'public')
       or public.pl1_version_visible_to(v.id,'authenticated'))) then
    raise exception 'LEDGER5C: internal source list readable by public roles';
  end if;

  -- Local-vs-production schema deployment markers, NOT feature activation.
  -- SCHOOL6B and TRADER1D3B2 currently absent on LIVE PROD; their
  -- presence in assisted rebuild proves only the local migration outputs.
  if to_regclass('private.school6b_ai_quota_user') is null
      or to_regclass('private.trader1d3b2_source_observations') is null then
    raise exception 'LEDGER5C: expected local-only quota/source-intelligence schema missing';
  end if;
end $tests$;
rollback;
