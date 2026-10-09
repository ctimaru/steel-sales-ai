-- SEC1.1 security boundary acceptance on disposable local Supabase only.
-- Run after all migrations, on a local DB. All checks are read-only ROLLBACK.
\set ON_ERROR_STOP on
begin;

do $sec1$
declare
  v_anon_public_definers int;
  v_published_facades int;
  v_internals int;
  v_unexpected_private int;
  v_dangerous int;
begin
  select count(*) into v_anon_public_definers
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and has_function_privilege('anon',p.oid,'EXECUTE');
  if v_anon_public_definers <> 0 then
    raise exception 'SEC1: anon SECURITY DEFINER exposed in public: %',v_anon_public_definers;
  end if;
  select count(*) into v_published_facades
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and not p.prosecdef
      and p.proname in (
        'k2_public_knowledge_grade','k2_public_knowledge_grades',
        'k2_public_knowledge_standard','k2_public_knowledge_standards',
        'k5_public_tube_weight_references','k6_public_tube_dimension_page',
        'k6_public_tube_dimension_pages','k7_public_tube_family_hubs',
        'k7_public_tube_size_hub','k7_public_tube_size_hubs',
        'sp4_public_steel_pulse_feed')
      and has_function_privilege('anon',p.oid,'EXECUTE')
      and has_function_privilege('authenticated',p.oid,'EXECUTE');
  if v_published_facades<>11 then
    raise exception 'SEC1: 11 public stable reader facades required: %',v_published_facades;
  end if;
  select count(*) into v_internals
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='sec1_public' and p.prosecdef;
  if v_internals<>11 then
    raise exception 'SEC1: 11 internal privileged published-only implementation required: %',v_internals;
  end if;
  select count(*) into v_unexpected_private
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='sec1_public'
      and p.proname not in (
        'k2_public_knowledge_grade','k2_public_knowledge_grades',
        'k2_public_knowledge_standard','k2_public_knowledge_standards',
        'k5_public_tube_weight_references','k6_public_tube_dimension_page',
        'k6_public_tube_dimension_pages','k7_public_tube_family_hubs',
        'k7_public_tube_size_hub','k7_public_tube_size_hubs',
        'sp4_public_steel_pulse_feed');
  if v_unexpected_private<>0 then
    raise exception 'SEC1: unexpected private callable routine: %',v_unexpected_private;
  end if;
  -- Anon must NEVER acquire platform, editorial mutation, company operational,
  -- notification, or draft-lab privileged execution through the facade change.
  select count(*) into v_dangerous from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and (p.proname like 'sa2_%' or p.proname like 'sp3_%'
        or p.proname like 'nc3%' or p.proname like 'pl1_private_lab_%'
        or p.proname like 'p1_%' or p.proname like 'sp5_%'
        or p.proname like 'sp6_%' or p.proname like 'sp71_%'
        or p.proname='platform_access_context')
      and has_function_privilege('anon',p.oid,'EXECUTE');
  if v_dangerous<>0 then
    raise exception 'SEC1: anon acquired privileged operational execution: %',v_dangerous;
  end if;
end $sec1$;

-- Verify the actual data API caller role (not postgres owner) can still read
-- published content through the unchanged public RPC names/default params.
set local role anon;
select count(*) as standards from public.k2_public_knowledge_standards(null,25,0);
select count(*) as grades from public.k2_public_knowledge_grades(null,25,0);
select count(*) as single_standard from public.k2_public_knowledge_standard('en-10219');
select count(*) as single_grade from public.k2_public_knowledge_grade('s355j2h');
select count(*) as weight_references from public.k5_public_tube_weight_references(null,25,0);
select count(*) as tube_dimension_pages from public.k6_public_tube_dimension_pages(null,25,0);
select count(*) as one_dimension from public.k6_public_tube_dimension_page('not-a-real-dimension');
select count(*) as family_hubs from public.k7_public_tube_family_hubs();
select count(*) as size_hubs from public.k7_public_tube_size_hubs(null);
select count(*) as one_size_hub from public.k7_public_tube_size_hub('round-tube','non-existent-size');
select jsonb_typeof(public.sp4_public_steel_pulse_feed(3)) as pulse_cards_json_kind;
reset role;
rollback;
select 'SEC1.1 PASS — 11 public SECURITY INVOKER readers, 11 internal definers; no anon privileged RPC; published reads preserved; ROLLBACK' as result;
