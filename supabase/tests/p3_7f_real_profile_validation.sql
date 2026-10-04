-- P3.7F — Real Profile Validation & Commercial UX Polish acceptance.
-- Read-only assertions against the clean rebuilt schema after the P3.7F migration.

begin;

create or replace function pg_temp.p37f_assert(ok boolean,message text)
returns void language plpgsql as $p37f_assert$
begin
  if not coalesce(ok,false) then
    raise exception 'P3.7F assertion failed: %',message;
  end if;
end;
$p37f_assert$;


create or replace function pg_temp.p37f_product_id(
  p_company_id uuid,
  p_product_key text,
  p_relationship_type text
)
returns uuid
language sql
stable
as $p37f_product$
  select cp.id
  from public.network_company_products cp
  join public.network_product_families pf on pf.id=cp.product_family_id
  where cp.company_id=p_company_id
    and pf.canonical_key=p_product_key
    and cp.relationship_type=p_relationship_type
    and cp.facility_id is null
  order by cp.id
  limit 1;
$p37f_product$;

select pg_temp.p37f_assert(
  (
    select count(*)
    from public.network_companies
    where id in (
      '51100000-0000-5000-8000-000000000001',
      '51100000-0000-5000-8000-000000000005',
      '51100000-0000-5000-8000-000000000006'
    )
      and publication_status='published'
      and verification_status='unverified'
  )=3,
  'all three real profiles must stay published and unverified'
);

select pg_temp.p37f_assert(
  (
    select count(*)
    from public.network_data_assertions
    where field_path like 'p3_7f_%'
      and source_type='public_web'
      and ownership_type='platform_curated'
      and review_state='accepted'
  )>=20,
  'P3.7F real-profile facts must remain accepted public-web platform-curated evidence'
);

select pg_temp.p37f_assert(
  (
    select count(*)
    from public.network_facilities
    where company_id='51100000-0000-5000-8000-000000000001'
      and publication_status='published'
      and city='Terno d''Isola'
  )=1,
  'Acciaitubi must expose its Terno d Isola industrial location'
);

select pg_temp.p37f_assert(
  (
    select count(*)
    from public.network_facility_capabilities fc
    join public.network_facilities f on f.id=fc.facility_id
    where f.company_id='51100000-0000-5000-8000-000000000001'
  )>=3
  and (
    select count(*)
    from public.network_company_markets
    where company_id='51100000-0000-5000-8000-000000000001'
  )>=2
  and (
    select count(*)
    from public.network_company_certifications
    where company_id='51100000-0000-5000-8000-000000000001'
  )>=3,
  'Acciaitubi must expose capabilities, markets and certifications'
);

select pg_temp.p37f_assert(
  exists(
    select 1
    from public.network_company_product_standard_scopes ps
    join public.steel_standards s on s.id=ps.standard_id
    where ps.company_product_id=pg_temp.p37f_product_id('51100000-0000-5000-8000-000000000001','tubes_pipes','produces')
      and s.code='EN 10217-1'
      and ps.verification_status='unverified'
  )
  and exists(
    select 1
    from public.network_company_product_grade_scopes pg
    join public.steel_material_grades mg on mg.id=pg.material_grade_id
    where pg.company_product_id=pg_temp.p37f_product_id('51100000-0000-5000-8000-000000000001','tubes_pipes','produces')
      and mg.designation='P235TR1'
      and pg.verification_status='unverified'
  )
  and (
    select count(*)
    from public.network_company_product_dimension_scopes d
    where d.company_product_id=pg_temp.p37f_product_id('51100000-0000-5000-8000-000000000001','tubes_pipes','produces')
      and d.dimension_type in ('outer_diameter','wall_thickness')
  )=2,
  'Acciaitubi must expose canonical EN 10217-1 / P235TR1 and dimensional scope'
);

select pg_temp.p37f_assert(
  (
    select count(*)
    from public.network_facility_capabilities fc
    join public.network_facilities f on f.id=fc.facility_id
    where f.company_id='51100000-0000-5000-8000-000000000005'
  )>=3
  and (
    select count(*)
    from public.network_company_markets
    where company_id='51100000-0000-5000-8000-000000000005'
  )>=3
  and (
    select count(*)
    from public.network_company_certifications
    where company_id='51100000-0000-5000-8000-000000000005'
  )>=2,
  'Morandi must expose service-center capabilities, markets and certifications'
);

select pg_temp.p37f_assert(
  (
    select count(distinct s.code)
    from public.network_company_product_standard_scopes ps
    join public.steel_standards s on s.id=ps.standard_id
    where ps.company_product_id=pg_temp.p37f_product_id('51100000-0000-5000-8000-000000000005','hollow_sections','stocks')
      and s.code in ('EN 10219','EN 10210')
  )=2
  and (
    select count(*)
    from public.network_company_product_grade_scopes pg
    join public.steel_material_grades mg on mg.id=pg.material_grade_id
    where pg.company_product_id=pg_temp.p37f_product_id('51100000-0000-5000-8000-000000000005','hollow_sections','stocks')
      and mg.designation='S355J2H'
  )=2
  and (
    select count(*)
    from public.network_company_product_dimension_scopes d
    where d.company_product_id=pg_temp.p37f_product_id('51100000-0000-5000-8000-000000000005','hollow_sections','stocks')
      and d.dimension_type in ('outer_diameter','width','height','wall_thickness')
  )=4,
  'Morandi must expose EN 10219 / EN 10210, S355J2H and structural ranges'
);

select pg_temp.p37f_assert(
  exists(
    select 1
    from public.network_facilities
    where id='3518c835-d809-4b0e-b6d0-b6bdcfd86fbc'
      and name='Sede e magazzino — Fiorenzuola d''Arda'
      and region='Emilia-Romagna'
  )
  and (
    select count(*)
    from public.network_facility_capabilities
    where facility_id='3518c835-d809-4b0e-b6d0-b6bdcfd86fbc'
  )>=2
  and exists(
    select 1
    from public.network_company_product_dimension_scopes d
    where d.company_product_id=pg_temp.p37f_product_id('51100000-0000-5000-8000-000000000006','tubes_pipes','stocks')
      and d.dimension_type='outer_diameter'
      and d.min_mm=21.3
      and d.max_mm=1560
  ),
  'Copromet must expose cleaned location, capabilities and stock diameter envelope'
);

select pg_temp.p37f_assert(
  (
    select count(*)
    from public.network_contacts
    where company_id in (
      '51100000-0000-5000-8000-000000000001',
      '51100000-0000-5000-8000-000000000005',
      '51100000-0000-5000-8000-000000000006'
    )
      and publication_status='pending_review'
      and privacy_classification='unreviewed'
      and verification_status='unverified'
      and source_assertion_id is not null
  )>=3,
  'LR4 must preserve governed real-profile contacts as pending privacy-review candidates'
);

do $p37f_bootstrap$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values(
      '00000000-0000-0000-0000-0000000037f1'::uuid,
      'p37f-owner@example.test',
      now()
    )
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values(
      '00000000-0000-0000-0000-0000000037f1'::uuid,
      'platform_superadmin','active',null,
      'P3.7F acceptance fallback Platform Owner'
    );
  end if;
end;
$p37f_bootstrap$;

select user_id as p37f_owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

set local role authenticated;
select set_config('request.jwt.claim.sub',:'p37f_owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p37f_assert(
  (
    select public.p3_7c_public_company_profile(
      '51100000-0000-5000-8000-000000000001'
    )->'company'->>'provenance_kind'
  )='public_web'
  and (
    select public.p3_7c_public_company_profile(
      '51100000-0000-5000-8000-000000000005'
    )->'company'->>'provenance_kind'
  )='public_web'
  and (
    select public.p3_7c_public_company_profile(
      '51100000-0000-5000-8000-000000000006'
    )->'company'->>'provenance_kind'
  )='public_web',
  'real-profile company summaries must render with public-web provenance'
);

select pg_temp.p37f_assert(
  (
    select count(*)
    from jsonb_array_elements(
      public.p3_7e_public_product_scope(
        '51100000-0000-5000-8000-000000000001'
      )->'products'
    ) product
    cross join lateral jsonb_array_elements(product->'standards') standard
    where standard->>'provenance_kind'='public_web'
  )>=1
  and (
    select count(*)
    from jsonb_array_elements(
      public.p3_7e_public_product_scope(
        '51100000-0000-5000-8000-000000000005'
      )->'products'
    ) product
    cross join lateral jsonb_array_elements(product->'standards') standard
    where standard->>'provenance_kind'='public_web'
  )>=2,
  'technical facts from official sites must remain visibly public-web sourced'
);

reset role;

rollback;
