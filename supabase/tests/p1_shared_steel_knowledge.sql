-- P1.15 Shared Steel Knowledge acceptance. Disposable CI database only.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000015a1'::uuid, 'shared-a@p1-test.example'),
  ('00000000-0000-0000-0000-0000000015b1'::uuid, 'shared-b@p1-test.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status)
values
  ('00000000-0000-0000-0000-0000000015f1', 'Shared Tenant A', 'shared-tenant-a', '00000000-0000-0000-0000-0000000015a1', 'completed'),
  ('00000000-0000-0000-0000-0000000015f2', 'Shared Tenant B', 'shared-tenant-b', '00000000-0000-0000-0000-0000000015b1', 'completed');

insert into public.organization_memberships (organization_id, user_id, role, status, is_default)
values
  ('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-0000000015a1', 'admin', 'active', true),
  ('00000000-0000-0000-0000-0000000015f2', '00000000-0000-0000-0000-0000000015b1', 'admin', 'active', true);

insert into public.knowledge_sources (
  id, owner_id, access_scope, source_key, source_type, source_class,
  name, provider, source_uri, trust_score, organization_id
) values (
  '00000000-0000-0000-0000-000000001501', null, 'global',
  'p1-shared-steel-test', 'reference_registry', 'official',
  'P1 shared steel test source', 'CI', 'https://example.invalid/reference', 1, null
);

insert into public.steel_standards (
  id, code, title, short_explanation, scope_summary, issuing_body, edition,
  status, knowledge_source_id
) values (
  '00000000-0000-0000-0000-000000001511',
  'SSA TEST 10224',
  'Synthetic steel tube reference test',
  'Synthetic short operational explanation for CI.',
  'Synthetic round tube dimensional reference used only in acceptance tests.',
  'CI',
  'test-edition',
  'active',
  '00000000-0000-0000-0000-000000001501'
);

insert into public.steel_standard_product_families (standard_id, product_family)
values ('00000000-0000-0000-0000-000000001511', 'round_tube');

insert into public.steel_standard_grades (standard_id, grade, material_number)
values ('00000000-0000-0000-0000-000000001511', 'TEST275', null);

insert into public.steel_dimensional_rows (
  id, standard_id, product_family, outer_diameter_mm, thickness_mm,
  theoretical_weight_kg_m, weight_method
) values (
  '00000000-0000-0000-0000-000000001521',
  '00000000-0000-0000-0000-000000001511',
  'round_tube', 323.9, 7.1, 55.4, 'verified'
);

create or replace function pg_temp.p115_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P1.15 assertion failed: %', message;
  end if;
end;
$$;

select pg_temp.p115_assert(
  has_table_privilege('authenticated', 'public.steel_standards', 'SELECT'),
  'authenticated users must read shared standards'
);
select pg_temp.p115_assert(
  has_table_privilege('authenticated', 'public.steel_dimensional_rows', 'SELECT'),
  'authenticated users must read shared dimensions'
);
select pg_temp.p115_assert(
  not has_table_privilege('authenticated', 'public.steel_standards', 'INSERT,UPDATE,DELETE'),
  'authenticated users must not mutate canonical shared standards'
);
select pg_temp.p115_assert(
  not has_table_privilege('authenticated', 'public.steel_dimensional_rows', 'INSERT,UPDATE,DELETE'),
  'authenticated users must not mutate canonical shared dimensions'
);
select pg_temp.p115_assert(
  not has_table_privilege('anon', 'public.steel_standards', 'SELECT'),
  'anonymous role must not read the authenticated shared catalog in MVP'
);
select pg_temp.p115_assert(
  has_table_privilege('service_role', 'public.steel_standards', 'SELECT,INSERT,UPDATE,DELETE'),
  'service role must govern canonical shared standards'
);

select pg_temp.p115_assert(
  (select code_key = 'ssatest10224' from public.steel_standards where id = '00000000-0000-0000-0000-000000001511'),
  'standard canonical key must normalize deterministically'
);
select pg_temp.p115_assert(
  (select dimension_key = 'round|od=323.9|t=7.1' from public.steel_dimensional_rows where id = '00000000-0000-0000-0000-000000001521'),
  'round-tube dimension identity must normalize deterministically'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000015a1', true);
select pg_temp.p115_assert(
  (select count(*) = 1 from public.steel_standards where code_key = 'ssatest10224'),
  'tenant A must see the synthetic shared standard'
);
select pg_temp.p115_assert(
  (select count(*) = 1 from public.steel_dimensional_rows where standard_id = '00000000-0000-0000-0000-000000001511'),
  'tenant A must see the synthetic shared dimensional row'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000015b1', true);
select pg_temp.p115_assert(
  (select count(*) = 1 from public.steel_standards where code_key = 'ssatest10224'),
  'tenant B must see the same synthetic shared standard independently of tenant membership'
);
select pg_temp.p115_assert(
  (select count(*) = 1 from public.steel_dimensional_rows where standard_id = '00000000-0000-0000-0000-000000001511'),
  'tenant B must see the same synthetic shared dimensional row independently of tenant membership'
);

reset role;
rollback;
