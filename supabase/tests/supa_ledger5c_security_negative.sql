-- SUPA-LEDGER5C — isolated P0 CI negative security acceptance.
-- Executed ONLY after supabase db reset --local in ephemeral CI.
-- Transaction rolls back test objects and data. NEVER execute in production.
begin;

create or replace function pg_temp.ledger5c_assert(ok boolean, reason text)
returns void language plpgsql security invoker as $fn$
begin
  if not coalesce(ok,false) then raise exception 'LEDGER5C: %',reason; end if;
end
$fn$;

create or replace function pg_temp.ledger5c_expect_error(stmt text, code text)
returns void language plpgsql security invoker as $fn$
declare got text;
begin
  begin
    execute stmt;
  exception when others then
    get stacked diagnostics got = returned_sqlstate;
  end;
  if got is distinct from code then
    raise exception 'LEDGER5C expected SQLSTATE %, got %',code,coalesce(got,'NO ERROR');
  end if;
end
$fn$;
grant execute on function pg_temp.ledger5c_assert(boolean,text) to anon,authenticated;
grant execute on function pg_temp.ledger5c_expect_error(text,text) to anon,authenticated;

-- PA1.4: attach *real installed function* to an isolated temporary fixture.
-- No company application, claim, organization or personal data are modified.
create temp table ledger5c_guard_fixture (
 id integer primary key,
 claim_target_network_company_id uuid,
 matched_network_company_id uuid
) on commit drop;
create trigger ledger5c_guard_fixture_tg
before insert or update of claim_target_network_company_id,matched_network_company_id
on ledger5c_guard_fixture
for each row execute function private.pa1_4_guard_registration_identity_targets();
grant select,insert,update on ledger5c_guard_fixture to anon,authenticated;

insert into ledger5c_guard_fixture values
 (1,'00000000-0000-0000-0000-000000005c01'::uuid,
   '00000000-0000-0000-0000-000000005c01'::uuid);

-- Even a postgres/service-role fast path MUST reject conflicting company targets.
select pg_temp.ledger5c_expect_error(
 $$insert into ledger5c_guard_fixture values
   (2,'00000000-0000-0000-0000-000000005c01'::uuid,
      '00000000-0000-0000-0000-000000005c02'::uuid)$$, '23514'
);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
-- A forged self-consistent pair must be rejected unless governed through an RPC.
select pg_temp.ledger5c_expect_error(
 $$insert into ledger5c_guard_fixture values
   (3,'00000000-0000-0000-0000-000000005c01'::uuid,
      '00000000-0000-0000-0000-000000005c01'::uuid)$$, '42501'
);
select pg_temp.ledger5c_expect_error(
 $$update ledger5c_guard_fixture set matched_network_company_id =
   '00000000-0000-0000-0000-000000005c02'::uuid where id=1$$, '23514'
);
reset role;

-- RFQH13: public API, role gates and core approval/consumption ordering.
select pg_temp.ledger5c_assert(
 not has_function_privilege('anon','public.rfqh13_governance_state(uuid)','EXECUTE')
 and not has_function_privilege('anon','public.rfqh13_export_audit(uuid)','EXECUTE')
 and has_function_privilege('authenticated','public.rfqh13_governance_state(uuid)','EXECUTE'),
 'RFQH13 public read endpoints require authenticated role'
);
select pg_temp.ledger5c_assert(
 position('rfqh13_assert_award_approval' in pg_get_functiondef(
 'private.rfqh7_confirm_award_impl(uuid,text,jsonb)'::regprocedure))>0
 and position('rfqh13_consume_approval' in pg_get_functiondef(
 'private.rfqh7_confirm_award_impl(uuid,text,jsonb)'::regprocedure))>0
 and position('rfqh13_assert_po_approval' in pg_get_functiondef(
 'private.rfqh9_prepare_issue_impl(uuid,text,text,text,timestamptz)'::regprocedure))>0
 and position('rfqh13_consume_approval' in pg_get_functiondef(
 'private.rfqh9_prepare_issue_impl(uuid,text,text,text,timestamptz)'::regprocedure))>0,
 'RFQH13 award and PO core must assert and consume approvals'
);
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
select pg_temp.ledger5c_expect_error(
 $$select public.rfqh13_governance_state(
 '00000000-0000-0000-0000-000000005c09'::uuid)$$, '42501'
);
reset role;

-- SEC1: executable on local clean rebuild, NOT yet installed in production.
-- Assert exactly eleven public SECURITY INVOKER facades and eleven internal
-- SECURITY DEFINER implementations; these role/catalog checks are scoped
-- to the allowlist and do not assert unrelated public RPCs are safe.
select pg_temp.ledger5c_assert(
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and not p.prosecdef and p.proname in (
   'k2_public_knowledge_grade','k2_public_knowledge_grades',
   'k2_public_knowledge_standard','k2_public_knowledge_standards',
   'k5_public_tube_weight_references','k6_public_tube_dimension_page',
   'k6_public_tube_dimension_pages','k7_public_tube_family_hubs',
   'k7_public_tube_size_hub','k7_public_tube_size_hubs',
   'sp4_public_steel_pulse_feed'))=11
 and (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='sec1_public' and p.prosecdef and p.proname in (
   'k2_public_knowledge_grade','k2_public_knowledge_grades',
   'k2_public_knowledge_standard','k2_public_knowledge_standards',
   'k5_public_tube_weight_references','k6_public_tube_dimension_page',
   'k6_public_tube_dimension_pages','k7_public_tube_family_hubs',
   'k7_public_tube_size_hub','k7_public_tube_size_hubs',
   'sp4_public_steel_pulse_feed'))=11,
 'SEC1 local migration must split public facades from internal definer logic'
);
select pg_temp.ledger5c_assert(
 has_function_privilege('anon','public.k2_public_knowledge_grade(text)','EXECUTE')
 and not has_schema_privilege('anon','private','USAGE'),
 'public safe lookup stays enabled; private core schema stays inaccessible'
);
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
-- Real anonymous invocation against a non-existent slug: must be callable
-- through the facade and return no private row or permission error.
select pg_temp.ledger5c_assert(
 (select count(*)=0 from public.k2_public_knowledge_grade('ledger5c-no-such-grade')),
 'SEC1 public facade must be callable by anon without leaking hidden rows'
);
reset role;

rollback;
