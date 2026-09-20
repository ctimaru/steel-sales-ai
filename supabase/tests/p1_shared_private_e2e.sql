-- P1.15 / SK7 — Shared/private isolation, calculation & end-to-end QA.
-- Disposable CI database only. Everything is rolled back.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000017a1'::uuid, 'sk7-a@p1-test.example'),
  ('00000000-0000-0000-0000-0000000017b1'::uuid, 'sk7-b@p1-test.example'),
  ('00000000-0000-0000-0000-0000000017c1'::uuid, 'sk7-c@p1-test.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status) values
  ('00000000-0000-0000-0000-0000000017f1', 'SK7 Tenant A', 'sk7-tenant-a', '00000000-0000-0000-0000-0000000017a1', 'completed'),
  ('00000000-0000-0000-0000-0000000017f2', 'SK7 Tenant C', 'sk7-tenant-c', '00000000-0000-0000-0000-0000000017c1', 'completed');

insert into public.organization_memberships (
  organization_id,user_id,role,status,is_default
) values
  ('00000000-0000-0000-0000-0000000017f1','00000000-0000-0000-0000-0000000017a1','admin','active',true),
  ('00000000-0000-0000-0000-0000000017f1','00000000-0000-0000-0000-0000000017b1','member','active',true),
  ('00000000-0000-0000-0000-0000000017f2','00000000-0000-0000-0000-0000000017c1','admin','active',true);

insert into public.companies (id,owner_id,organization_id,name) values
  ('00000000-0000-0000-0000-000000001701','00000000-0000-0000-0000-0000000017a1','00000000-0000-0000-0000-0000000017f1','SK7 Tenant A Company'),
  ('00000000-0000-0000-0000-000000001702','00000000-0000-0000-0000-0000000017c1','00000000-0000-0000-0000-0000000017f2','SK7 Tenant C Company');

insert into public.knowledge_sources (
  id,owner_id,organization_id,access_scope,source_key,source_type,source_class,name
) values
  ('00000000-0000-0000-0000-000000001711','00000000-0000-0000-0000-0000000017a1','00000000-0000-0000-0000-0000000017f1','owner','sk7-private-a','commercial_archive','internal','SK7 Private A'),
  ('00000000-0000-0000-0000-000000001712','00000000-0000-0000-0000-0000000017c1','00000000-0000-0000-0000-0000000017f2','owner','sk7-private-c','commercial_archive','internal','SK7 Private C');

create or replace function pg_temp.sk7_assert(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SK7 assertion failed: %', message;
  end if;
end;
$$;

-- Shared catalog privilege contract.
select pg_temp.sk7_assert(
  has_table_privilege('authenticated','public.steel_standards','SELECT')
  and has_table_privilege('authenticated','public.steel_geometries','SELECT')
  and has_table_privilege('authenticated','public.steel_material_grades','SELECT')
  and has_table_privilege('authenticated','public.steel_weight_references','SELECT'),
  'authenticated users must read shared steel catalog tables'
);

select pg_temp.sk7_assert(
  not has_table_privilege('authenticated','public.steel_standards','INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.steel_geometries','INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.steel_material_grades','INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.steel_weight_references','INSERT,UPDATE,DELETE'),
  'authenticated users must not mutate shared steel catalog'
);

select pg_temp.sk7_assert(
  not has_table_privilege('anon','public.steel_standards','SELECT')
  and not has_function_privilege(
    'anon',
    'public.p1_resolve_shared_steel_reference(text,text,text,numeric,numeric,numeric,numeric)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.p1_steel_price_per_meter_from_effective_weight(uuid,uuid,numeric)',
    'EXECUTE'
  ),
  'anonymous role must not read or calculate from authenticated shared catalog'
);

-- User A: tenant A private data + global shared reference.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000017a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sk7_assert(
  exists(select 1 from public.companies where id='00000000-0000-0000-0000-000000001701')
  and not exists(select 1 from public.companies where id='00000000-0000-0000-0000-000000001702'),
  'user A must see tenant A company only'
);

select pg_temp.sk7_assert(
  exists(select 1 from public.knowledge_sources where id='00000000-0000-0000-0000-000000001711')
  and not exists(select 1 from public.knowledge_sources where id='00000000-0000-0000-0000-000000001712'),
  'user A must see tenant A private knowledge only'
);

do $$
declare
  v_resolved jsonb;
  v_price record;
begin
  v_resolved := public.p1_resolve_shared_steel_reference(
    'EN 10216-2','P265GH','round_tube',21.30,null,null,2.77
  );

  if v_resolved->>'resolution_status' <> 'matched'
     or coalesce((v_resolved->>'calculation_allowed')::boolean,false) is not true
     or (v_resolved->>'effective_weight_kg_m')::numeric <> 1.27
     or v_resolved ? 'organization_id'
     or v_resolved ? 'owner_id' then
    raise exception 'SK7 shared resolver tenant A regression: %',v_resolved;
  end if;

  select * into v_price
  from public.p1_steel_price_per_meter_from_effective_weight(
    (v_resolved->>'geometry_id')::uuid,
    (v_resolved->>'material_grade_id')::uuid,
    1000
  );

  if not v_price.calculation_allowed
     or v_price.price_per_meter <> 1.270000
     or v_price.formula <> 'price_per_tonne * canonical_weight_kg_m / 1000' then
    raise exception 'SK7 canonical calculation regression for tenant A';
  end if;
end
$$;

-- User B in same tenant sees A private data and same shared reference.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000017b1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sk7_assert(
  exists(select 1 from public.companies where id='00000000-0000-0000-0000-000000001701')
  and not exists(select 1 from public.companies where id='00000000-0000-0000-0000-000000001702'),
  'same-tenant user B must see A private company and not tenant C'
);

select pg_temp.sk7_assert(
  (public.p1_resolve_shared_steel_reference(
    'EN 10216-2','P265GH','round_tube',21.30,null,null,2.77
  )->>'effective_weight_kg_m')::numeric = 1.27,
  'same-tenant user B must receive the same global canonical reference'
);

-- User C: isolated private data, identical shared catalog/calculation.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000017c1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sk7_assert(
  exists(select 1 from public.companies where id='00000000-0000-0000-0000-000000001702')
  and not exists(select 1 from public.companies where id='00000000-0000-0000-0000-000000001701'),
  'user C must see tenant C company only'
);

select pg_temp.sk7_assert(
  exists(select 1 from public.knowledge_sources where id='00000000-0000-0000-0000-000000001712')
  and not exists(select 1 from public.knowledge_sources where id='00000000-0000-0000-0000-000000001711'),
  'user C must see tenant C private knowledge only'
);

do $$
declare
  v_resolved jsonb;
  v_price record;
begin
  v_resolved := public.p1_resolve_shared_steel_reference(
    'EN 10216-2','P265GH','round_tube',21.30,null,null,2.77
  );

  if v_resolved->>'resolution_status' <> 'matched'
     or (v_resolved->>'effective_weight_kg_m')::numeric <> 1.27 then
    raise exception 'SK7 shared resolver tenant C regression: %',v_resolved;
  end if;

  select * into v_price
  from public.p1_steel_price_per_meter_from_effective_weight(
    (v_resolved->>'geometry_id')::uuid,
    (v_resolved->>'material_grade_id')::uuid,
    725
  );

  if v_price.price_per_meter <> round((725*1.27/1000.0)::numeric,6) then
    raise exception 'SK7 canonical calculation regression for tenant C';
  end if;
end
$$;

-- Missing reference must not produce an effective commercial calculation path.
select pg_temp.sk7_assert(
  (public.p1_resolve_shared_steel_reference(
    'EN 10216-2','P265GH','round_tube',999.99,null,null,9.99
  )->>'resolution_status')='geometry_not_found'
  and coalesce((
    public.p1_resolve_shared_steel_reference(
      'EN 10216-2','P265GH','round_tube',999.99,null,null,9.99
    )->>'calculation_allowed'
  )::boolean,false)=false,
  'unsupported geometry must fail closed'
);

-- Suspended user loses tenant-private access but keeps authenticated shared catalog access.
reset role;
update public.organization_memberships
set status='suspended',updated_at=now()
where organization_id='00000000-0000-0000-0000-0000000017f1'
  and user_id='00000000-0000-0000-0000-0000000017b1';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000017b1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sk7_assert(
  not exists(select 1 from public.companies where id='00000000-0000-0000-0000-000000001701')
  and not exists(select 1 from public.knowledge_sources where id='00000000-0000-0000-0000-000000001711'),
  'suspended user B must lose tenant-private access'
);

select pg_temp.sk7_assert(
  (public.p1_resolve_shared_steel_reference(
    'EN 10216-2','P265GH','round_tube',21.30,null,null,2.77
  )->>'resolution_status')='matched',
  'suspended tenant member remains an authenticated user and may read global shared catalog'
);

reset role;
rollback;
