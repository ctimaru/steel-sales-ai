-- HP1.1 — Registration Gate & Integrity Hotfix acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.hp11_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'HP1.1 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.hp11_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'HP1.1 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'HP1.1 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000b101'::uuid,'hp11-draft@example.com',now()),
  ('00000000-0000-0000-0000-00000000b102'::uuid,'hp11-fresh@example.com',now()),
  ('00000000-0000-0000-0000-00000000b103'::uuid,'hp11-conflict@example.com',now())
on conflict (id) do nothing;

do $owner$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values ('00000000-0000-0000-0000-00000000b100'::uuid,'hp11-owner@example.com',now())
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-00000000b100'::uuid,
      'platform_superadmin','active',null,'HP1.1 acceptance fallback owner'
    );
  end if;
end
$owner$;

select user_id as owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 gset

-- The legacy P1 path is no longer executable by authenticated users.
select pg_temp.hp11_assert(
  not has_function_privilege(
    'authenticated',
    'public.create_organization_for_current_user(text,text,text)',
    'EXECUTE'
  ),
  'authenticated must not execute legacy tenant creation'
);

-- A normal applicant can have only one non-terminal registration row.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b101',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
  legal_name,country_code,primary_company_type,contact_name
) values ('HP11 Draft One','IT','producer','Tester');

select pg_temp.hp11_assert_raises(
  $$insert into public.company_registration_applications(
      legal_name,country_code,primary_company_type,contact_name
    ) values ('HP11 Draft Two','IT','producer','Tester')$$,
  'duplicate key'
);

reset role;

-- Fresh approved application: activation must create Organization, membership,
-- Network company, active link and approved claim in one transaction.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b102',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
  legal_name,country_code,primary_company_type,contact_name,website_url
) values (
  'HP11 Atomic Fresh 6C21','IT','producer','Tester',
  'https://hp11-fresh-6c21.example.test'
) returning id as fresh_app_id gset

reset role;
update public.company_registration_applications
set application_status='pending_review',
    submitted_at=now(),
    email_verified_at=now()
where id=:'fresh_app_id'::uuid;

update public.company_registration_applications
set application_status='approved',
    reviewed_at=now(),
    reviewed_by=:'owner_id'::uuid
where id=:'fresh_app_id'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p0a_activate_registration_application(:'fresh_app_id'::uuid)
  as fresh_activation gset

select pg_temp.hp11_assert(
  (:'fresh_activation'::jsonb->>'status')='activated'
  and (:'fresh_activation'::jsonb->>'network_link_status')='active'
  and (:'fresh_activation'::jsonb->>'network_company_id') is not null
  and (:'fresh_activation'::jsonb->>'claim_id') is not null,
  'fresh activation must include the Network bridge'
);

reset role;

select pg_temp.hp11_assert(
  exists (
    select 1
    from public.organization_network_company_links l
    join public.company_registration_applications a
      on a.activated_organization_id=l.organization_id
    where a.id=:'fresh_app_id'::uuid
      and l.application_id=a.id
      and l.link_status='active'
  ),
  'activated application must own an active Network link'
);

select pg_temp.hp11_assert(
  exists (
    select 1
    from public.network_company_claims c
    join public.company_registration_applications a
      on a.activated_organization_id=c.organization_id
    where a.id=:'fresh_app_id'::uuid
      and c.network_company_id=a.matched_network_company_id
      and c.status='approved'
  ),
  'activated application must own an approved claim'
);

-- Build an already-claimed Network candidate.
insert into public.organizations(
  id,name,slug,created_by,country_code,industry,onboarding_status
) values (
  '00000000-0000-0000-0000-00000000b120'::uuid,
  'HP11 Existing Organization',
  'hp11-existing-organization',
  :'owner_id'::uuid,
  'IT','steel','completed'
);

insert into public.network_companies(
  id,legal_name,country_code,website_url,website_domain,
  publication_status,claimed_status,verification_status
) values (
  '00000000-0000-0000-0000-00000000b121'::uuid,
  'HP11 Conflict Company 91D3',
  'IT',
  'https://hp11-conflict-91d3.example.test',
  'hp11-conflict-91d3.example.test',
  'published','claimed','unverified'
);

insert into public.network_company_claims(
  network_company_id,organization_id,requested_by,status,
  request_note,reviewed_by,reviewed_at,review_note
) values (
  '00000000-0000-0000-0000-00000000b121'::uuid,
  '00000000-0000-0000-0000-00000000b120'::uuid,
  :'owner_id'::uuid,
  'approved',
  'HP1.1 acceptance fixture',
  :'owner_id'::uuid,
  now(),
  'HP1.1 acceptance fixture'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b103',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
  legal_name,country_code,primary_company_type,contact_name,website_url
) values (
  'HP11 Conflict Company 91D3','IT','producer','Tester',
  'https://hp11-conflict-91d3.example.test'
) returning id as conflict_app_id gset

reset role;
update public.company_registration_applications
set application_status='pending_review',
    submitted_at=now(),
    email_verified_at=now()
where id=:'conflict_app_id'::uuid;

update public.company_registration_applications
set application_status='approved',
    reviewed_at=now(),
    reviewed_by=:'owner_id'::uuid
where id=:'conflict_app_id'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

-- Without explicit resolution, candidate presence blocks activation.
select pg_temp.hp11_assert_raises(
  format(
    'select public.p0a_activate_registration_application(%L::uuid)',
    :'conflict_app_id'
  ),
  'explicit network company selection required before activation'
);

reset role;

select pg_temp.hp11_assert(
  not exists (
    select 1 from public.organizations
    where created_by='00000000-0000-0000-0000-00000000b103'::uuid
  )
  and not exists (
    select 1 from public.organization_memberships
    where user_id='00000000-0000-0000-0000-00000000b103'::uuid
  )
  and exists (
    select 1 from public.company_registration_applications
    where id=:'conflict_app_id'::uuid
      and application_status='approved'
      and activated_organization_id is null
  ),
  'candidate preflight failure must not leave a half-active tenant'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

-- Even with explicit selection, an incompatible approved claim aborts the
-- whole activation transaction.
select pg_temp.hp11_assert_raises(
  format(
    'select public.p0a_activate_registration_application_with_network(%L::uuid,%L::uuid)',
    :'conflict_app_id',
    '00000000-0000-0000-0000-00000000b121'
  ),
  'already has an approved claim by another organization'
);

reset role;

select pg_temp.hp11_assert(
  not exists (
    select 1 from public.organizations
    where created_by='00000000-0000-0000-0000-00000000b103'::uuid
  )
  and exists (
    select 1 from public.company_registration_applications
    where id=:'conflict_app_id'::uuid
      and application_status='approved'
      and activated_organization_id is null
  ),
  'claim conflict must roll back Organization and activation state'
);

rollback;
