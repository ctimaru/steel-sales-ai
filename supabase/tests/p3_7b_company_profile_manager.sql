-- P3.7B — Company Profile Manager: Structured Editing acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.p37b_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P3.7B assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.p37b_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'P3.7B expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'P3.7B statement unexpectedly succeeded: %',statement;
end;
$$;

do $p37b_bootstrap$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values (
      '00000000-0000-0000-0000-0000000037b1',
      'p37b-superadmin@example.test',
      now()
    )
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-0000000037b1',
      'platform_superadmin','active',null,
      'P3.7B acceptance fallback superadmin'
    );
  end if;
end;
$p37b_bootstrap$;

select user_id as superadmin_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

insert into public.organizations(
  id,name,slug,created_by,country_code,industry
) values (
  '00000000-0000-0000-0000-0000000037b2',
  'P3.7B Managed Organization',
  'p37b-managed-organization',
  :'superadmin_id'::uuid,
  'IT','steel'
);

insert into public.organization_memberships(
  organization_id,user_id,role,status,is_default
) values (
  '00000000-0000-0000-0000-0000000037b2',
  :'superadmin_id'::uuid,
  'admin','active',false
);

insert into public.network_companies(
  id,legal_name,country_code,website_url,website_domain,description,
  publication_status,claimed_status,verification_status
) values (
  '00000000-0000-0000-0000-0000000037b3',
  'P3.7B Tube Profile S.r.l.','IT',
  'https://p37b.example.test','p37b.example.test',
  'P3.7B acceptance profile',
  'published','unclaimed','unverified'
);

select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

select (public.p3_6_request_company_claim(
  '00000000-0000-0000-0000-0000000037b3',
  '00000000-0000-0000-0000-0000000037b2',
  'P3.7B acceptance claim'
)->>'claim_id') as claim_id \gset

select public.p3_6_review_claim_proof(
  :'claim_id'::uuid,'verified','P3.7B ownership acceptance'
);
select public.m4_review_company_claim(
  :'claim_id'::uuid,'approved','P3.7B claim acceptance'
);

select public.p3_7b_set_role(
  '00000000-0000-0000-0000-0000000037b3','producer',true,true
);
select public.p3_7b_set_subtype(
  '00000000-0000-0000-0000-0000000037b3','tube_pipe_producer',true
);

select (
  public.p3_7b_upsert_facility(
    '00000000-0000-0000-0000-0000000037b3',null,
    jsonb_build_object(
      'name','P3.7B Torino Plant',
      'facility_type','plant',
      'address_line_1','Via Acciaio 37',
      'postal_code','10100',
      'city','Torino',
      'region','Piemonte',
      'country_code','IT',
      'publication_status','published'
    )
  )->>'facility_id'
) as facility_id \gset

select public.p3_7b_set_product(
  '00000000-0000-0000-0000-0000000037b3',
  'tubes_pipes','produces',:'facility_id'::uuid,true
);
select public.p3_7b_set_facility_capability(
  '00000000-0000-0000-0000-0000000037b3',
  :'facility_id'::uuid,'stockholding',true
);
select public.p3_7b_set_market(
  '00000000-0000-0000-0000-0000000037b3','automotive',true
);

select (
  public.p3_7b_upsert_certification(
    '00000000-0000-0000-0000-0000000037b3',null,
    jsonb_build_object(
      'certification_type_key','iso_9001',
      'facility_id',:'facility_id',
      'issuer','P3.7B Certification Body',
      'certificate_identifier','P37B-9001',
      'valid_from','2026-01-01',
      'valid_to','2027-01-01',
      'scope_text','Tube manufacturing'
    )
  )->>'certification_id'
) as certification_id \gset

select public.p3_7_managed_profile_state(
  '00000000-0000-0000-0000-0000000037b3'
) as managed_state \gset

select public.m6_network_company_profile(
  '00000000-0000-0000-0000-0000000037b3'
) as public_state \gset

reset role;

select pg_temp.p37b_assert(
  jsonb_array_length(:'managed_state'::jsonb->'roles')=1
  and jsonb_array_length(:'managed_state'::jsonb->'subtypes')=1
  and jsonb_array_length(:'managed_state'::jsonb->'products')=1
  and jsonb_array_length(:'managed_state'::jsonb->'facilities')=1
  and jsonb_array_length(:'managed_state'::jsonb->'markets')=1
  and jsonb_array_length(:'managed_state'::jsonb->'certifications')=1,
  'managed read model must reflect all structured edits'
);

select pg_temp.p37b_assert(
  (:'managed_state'::jsonb->'completeness'->'sections'->>'products')::boolean
  and (:'managed_state'::jsonb->'completeness'->'sections'->>'facilities')::boolean
  and (:'managed_state'::jsonb->'completeness'->'sections'->>'capabilities')::boolean
  and (:'managed_state'::jsonb->'completeness'->'sections'->>'markets')::boolean
  and (:'managed_state'::jsonb->'completeness'->'sections'->>'certifications')::boolean,
  'profile completeness must react to canonical structured data'
);

select pg_temp.p37b_assert(
  jsonb_array_length(:'public_state'::jsonb->'products')=1
  and jsonb_array_length(:'public_state'::jsonb->'facilities')=1
  and jsonb_array_length(:'public_state'::jsonb->'markets')=1
  and jsonb_array_length(:'public_state'::jsonb->'certifications')=1,
  'public profile must reflect canonical Company Profile Manager mutations'
);

select pg_temp.p37b_assert(
  (
    select count(*)
    from public.network_data_assertions
    where source_reference='managed_profile:p3.7b'
      and source_type='company_declared'
      and ownership_type='company_managed'
      and review_state='accepted'
  )>=7,
  'structured changes must emit company-managed provenance'
);

select pg_temp.p37b_assert(
  (
    select count(*)
    from public.network_profile_management_events
    where network_company_id='00000000-0000-0000-0000-0000000037b3'
  )>=7,
  'structured changes must emit immutable audit events'
);

update public.network_facilities
set verification_status='verified'
where id=:'facility_id'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p37b_assert_raises(
  format(
    $sql$select public.p3_7b_upsert_facility(
      %L::uuid,%L::uuid,
      '{"name":"Tampered Plant","facility_type":"plant","country_code":"IT","publication_status":"published"}'::jsonb
    )$sql$,
    '00000000-0000-0000-0000-0000000037b3',
    :'facility_id'
  ),
  'requires Platform review'
);

reset role;

update public.network_facilities
set verification_status='unverified'
where id=:'facility_id'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p3_7b_remove_certification(
  '00000000-0000-0000-0000-0000000037b3',
  :'certification_id'::uuid
);
select public.p3_7b_set_facility_capability(
  '00000000-0000-0000-0000-0000000037b3',
  :'facility_id'::uuid,'stockholding',false
);
select public.p3_7b_set_product(
  '00000000-0000-0000-0000-0000000037b3',
  'tubes_pipes','produces',:'facility_id'::uuid,false
);
select public.p3_7b_set_market(
  '00000000-0000-0000-0000-0000000037b3','automotive',false
);
select public.p3_7b_set_subtype(
  '00000000-0000-0000-0000-0000000037b3','tube_pipe_producer',false
);

select public.p3_7b_set_role(
  '00000000-0000-0000-0000-0000000037b3','trader_distributor',true,true
);
select public.p3_7b_set_role(
  '00000000-0000-0000-0000-0000000037b3','producer',false,false
);

select public.p3_7b_archive_facility(
  '00000000-0000-0000-0000-0000000037b3',
  :'facility_id'::uuid
);

reset role;

select pg_temp.p37b_assert(
  exists(
    select 1 from public.network_facilities
    where id=:'facility_id'::uuid
      and publication_status='archived'
      and archived_at is not null
  ),
  'company-managed facility must archive instead of hard delete'
);

select pg_temp.p37b_assert(
  (select verification_status from public.network_companies
   where id='00000000-0000-0000-0000-0000000037b3')='unverified',
  'structured editing must never auto-verify company'
);

select pg_temp.p37b_assert(
  exists(
    select 1 from public.network_certification_types
    where canonical_key='iso_9001' and status='active'
  ),
  'P3.7B must provide a usable certification taxonomy'
);

rollback;
