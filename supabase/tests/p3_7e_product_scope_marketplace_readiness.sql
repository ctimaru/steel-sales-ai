-- P3.7E — Product Scope & Marketplace Readiness acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.p37e_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P3.7E assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.p37e_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'P3.7E expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'P3.7E statement unexpectedly succeeded: %',statement;
end;
$$;

do $p37e_bootstrap$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values (
      '00000000-0000-0000-0000-0000000037e1',
      'p37e-superadmin@example.test',
      now()
    )
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-0000000037e1',
      'platform_superadmin','active',null,
      'P3.7E acceptance fallback superadmin'
    );
  end if;
end;
$p37e_bootstrap$;

select user_id as superadmin_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

insert into public.organizations(
  id,name,slug,created_by,country_code,industry
) values (
  '00000000-0000-0000-0000-0000000037e2',
  'P3.7E Managed Organization',
  'p37e-managed-organization',
  :'superadmin_id'::uuid,
  'IT','steel'
);

insert into public.organization_memberships(
  organization_id,user_id,role,status,is_default
) values (
  '00000000-0000-0000-0000-0000000037e2',
  :'superadmin_id'::uuid,
  'admin','active',false
);

insert into public.network_companies(
  id,legal_name,trading_name,country_code,website_url,website_domain,description,
  publication_status,claimed_status,verification_status
) values (
  '00000000-0000-0000-0000-0000000037e3',
  'P3.7E Tube Scope S.r.l.',
  'P3.7E Tubes',
  'IT',
  'https://p37e.example.test',
  'p37e.example.test',
  'Technical product scope acceptance',
  'published','unclaimed','unverified'
);

select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

select (
  public.p3_6_request_company_claim(
    '00000000-0000-0000-0000-0000000037e3',
    '00000000-0000-0000-0000-0000000037e2',
    'P3.7E technical scope acceptance claim'
  )->>'claim_id'
) as claim_id \gset

select public.p3_6_review_claim_proof(
  :'claim_id'::uuid,'verified','P3.7E ownership acceptance'
);
select public.m4_review_company_claim(
  :'claim_id'::uuid,'approved','P3.7E claim acceptance'
);

select (
  public.p3_7b_set_product(
    '00000000-0000-0000-0000-0000000037e3',
    'tubes_pipes','produces',null,true
  )->>'relation_id'
) as company_product_id \gset

reset role;

with grade_links as (
  select a.standard_id,a.material_grade_id
  from public.steel_standard_grade_applicability a
  union
  select sg.standard_id,sg.material_grade_id
  from public.steel_standard_grades sg
  where sg.material_grade_id is not null
)
select
  s.id as standard_id,
  gl.material_grade_id
from public.steel_standards s
join public.steel_standard_product_families spf
  on spf.standard_id=s.id and spf.product_family='round_tube'
join grade_links gl on gl.standard_id=s.id
join public.steel_material_grades mg on mg.id=gl.material_grade_id
where s.status='active'
order by s.code,mg.designation
limit 1 \gset

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p3_7e_set_product_standard(
  :'company_product_id'::uuid,
  :'standard_id'::uuid,
  true
);

select public.p3_7e_set_product_grade(
  :'company_product_id'::uuid,
  :'standard_id'::uuid,
  :'material_grade_id'::uuid,
  true
);

select public.p3_7e_upsert_product_dimension(
  :'company_product_id'::uuid,
  'outer_diameter',
  21.3,
  610
);

select public.p3_7e_upsert_product_dimension(
  :'company_product_id'::uuid,
  'wall_thickness',
  2,
  40
);

select public.p3_7e_managed_product_scope(
  '00000000-0000-0000-0000-0000000037e3'
) as managed_scope \gset

select public.p3_7e_public_product_scope(
  '00000000-0000-0000-0000-0000000037e3'
) as public_scope \gset

reset role;

select pg_temp.p37e_assert(
  jsonb_array_length(:'managed_scope'::jsonb->'standard_scopes')=1
  and jsonb_array_length(:'managed_scope'::jsonb->'grade_scopes')=1
  and jsonb_array_length(:'managed_scope'::jsonb->'dimension_scopes')=2,
  'managed technical scope must expose standard, grade and declared dimensions'
);

select pg_temp.p37e_assert(
  jsonb_array_length(:'public_scope'::jsonb->'products')=1
  and jsonb_array_length(:'public_scope'::jsonb->'products'->0->'standards')=1
  and jsonb_array_length(:'public_scope'::jsonb->'products'->0->'grades')=1
  and jsonb_array_length(:'public_scope'::jsonb->'products'->0->'dimensions')=2,
  'public product scope must compose matching-ready technical signals'
);

select pg_temp.p37e_assert(
  :'public_scope'::jsonb->'products'->0->'standards'->0->>'provenance_kind'='company_declared'
  and :'public_scope'::jsonb->'products'->0->'grades'->0->>'provenance_kind'='company_declared'
  and :'public_scope'::jsonb->'products'->0->'dimensions'->0->>'provenance_kind'='company_declared',
  'company-managed technical scope must remain explicitly company-declared'
);

select pg_temp.p37e_assert(
  position('source_assertion_id' in :'public_scope')=0
  and position('source_reference' in :'public_scope')=0,
  'public technical scope must not expose assertion governance identifiers'
);

select pg_temp.p37e_assert(
  (
    select count(*)
    from public.network_data_assertions
    where entity_id=:'company_product_id'::uuid
      and source_reference='managed_profile:p3.7e'
      and source_type='company_declared'
      and ownership_type='company_managed'
      and review_state='accepted'
  )=4,
  'every initial technical scope mutation must create company-managed provenance'
);

select pg_temp.p37e_assert(
  (
    select count(*)
    from public.network_profile_management_events
    where network_company_id='00000000-0000-0000-0000-0000000037e3'
      and entity_id=:'company_product_id'::uuid
      and field_path like 'technical_scope.%'
  )=4,
  'every initial technical scope mutation must create immutable audit'
);

select pg_temp.p37e_assert(
  (select verification_status
   from public.network_companies
   where id='00000000-0000-0000-0000-0000000037e3')='unverified',
  'technical scope declarations must never auto-verify the company'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p37e_assert_raises(
  format(
    $sql$select public.p3_7b_set_product(
      %L::uuid,'tubes_pipes','produces',null,false
    )$sql$,
    '00000000-0000-0000-0000-0000000037e3'
  ),
  'remove technical product scope before removing product relationship'
);

reset role;

update public.network_company_product_standard_scopes
set verification_status='verified'
where company_product_id=:'company_product_id'::uuid
  and standard_id=:'standard_id'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p37e_assert_raises(
  format(
    $sql$select public.p3_7e_set_product_standard(%L::uuid,%L::uuid,false)$sql$,
    :'company_product_id',:'standard_id'
  ),
  'requires Platform review'
);

reset role;

update public.network_company_product_standard_scopes
set verification_status='unverified'
where company_product_id=:'company_product_id'::uuid
  and standard_id=:'standard_id'::uuid;

update public.network_company_product_dimension_scopes
set verification_status='verified'
where company_product_id=:'company_product_id'::uuid
  and dimension_type='outer_diameter';

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p37e_assert_raises(
  format(
    $sql$select public.p3_7e_remove_product_dimension(%L::uuid,'outer_diameter')$sql$,
    :'company_product_id'
  ),
  'requires Platform review'
);

reset role;

update public.network_company_product_dimension_scopes
set verification_status='unverified'
where company_product_id=:'company_product_id'::uuid
  and dimension_type='outer_diameter';

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p3_7e_remove_product_dimension(
  :'company_product_id'::uuid,'outer_diameter'
);
select public.p3_7e_remove_product_dimension(
  :'company_product_id'::uuid,'wall_thickness'
);
select public.p3_7e_set_product_grade(
  :'company_product_id'::uuid,
  :'standard_id'::uuid,
  :'material_grade_id'::uuid,
  false
);
select public.p3_7e_set_product_standard(
  :'company_product_id'::uuid,
  :'standard_id'::uuid,
  false
);
select public.p3_7b_set_product(
  '00000000-0000-0000-0000-0000000037e3',
  'tubes_pipes','produces',null,false
);

reset role;

select pg_temp.p37e_assert(
  not exists(
    select 1 from public.network_company_products
    where id=:'company_product_id'::uuid
  ),
  'product relationship must become removable after technical scope is cleared'
);

select pg_temp.p37e_assert(
  exists(
    select 1
    from public.network_product_family_steel_mappings map
    join public.network_product_families pf
      on pf.id=map.network_product_family_id
    where pf.canonical_key='tubes_pipes'
      and map.steel_product_family='round_tube'
  ),
  'Network tubes must map to canonical Steel Knowledge round_tube'
);

select pg_temp.p37e_assert(
  not has_table_privilege(
    'authenticated',
    'public.network_company_product_standard_scopes',
    'SELECT'
  ),
  'authenticated users must not receive direct technical-scope table access'
);

rollback;
