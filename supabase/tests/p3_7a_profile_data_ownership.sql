-- P3.7A — Profile Data Ownership & Management Contract acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.p37a_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P3.7A assertion failed: %',message;
  end if;
end;
$$;

do $p37a_bootstrap$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values (
      '00000000-0000-0000-0000-0000000037a1',
      'p37a-superadmin@example.test',
      now()
    )
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-0000000037a1',
      'platform_superadmin','active',null,
      'P3.7A acceptance fallback superadmin'
    );
  end if;
end;
$p37a_bootstrap$;

select user_id as superadmin_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

insert into public.organizations(
  id,name,slug,created_by,country_code,industry
) values (
  '00000000-0000-0000-0000-0000000037b1',
  'P3.7A Managed Organization',
  'p37a-managed-organization',
  :'superadmin_id'::uuid,
  'IT','steel'
);

insert into public.organization_memberships(
  organization_id,user_id,role,status,is_default
) values (
  '00000000-0000-0000-0000-0000000037b1',
  :'superadmin_id'::uuid,
  'admin','active',false
);

insert into public.network_companies(
  id,legal_name,country_code,website_url,website_domain,description,
  publication_status,claimed_status,verification_status
) values (
  '00000000-0000-0000-0000-0000000037c1',
  'P3.7A Legal Identity S.r.l.',
  'IT',
  'https://p37a.example.test',
  'p37a.example.test',
  'Original description',
  'published','unclaimed','unverified'
);

select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

select (public.p3_6_request_company_claim(
  '00000000-0000-0000-0000-0000000037c1',
  '00000000-0000-0000-0000-0000000037b1',
  'P3.7A acceptance claim'
)->>'claim_id') as claim_id \gset

select public.p3_6_review_claim_proof(
  :'claim_id'::uuid,'verified','P3.7A acceptance ownership'
);

select public.m4_review_company_claim(
  :'claim_id'::uuid,'approved','P3.7A acceptance approval'
);

select public.m8_update_managed_network_company(
  '00000000-0000-0000-0000-0000000037c1',
  'P3.7A Trading',
  'https://managed.p37a.example.test',
  'Managed description'
);

select public.p3_7_managed_profile_state(
  '00000000-0000-0000-0000-0000000037c1'
) as managed_state \gset

reset role;

select pg_temp.p37a_assert(
  (:'managed_state'::jsonb->'contract'->>'version')='P3.7A-v1',
  'managed state must expose the P3.7A contract version'
);

select pg_temp.p37a_assert(
  (:'managed_state'::jsonb->'company'->>'legal_name')='P3.7A Legal Identity S.r.l.',
  'managed overview must not modify legal identity'
);

select pg_temp.p37a_assert(
  (:'managed_state'::jsonb->'company'->>'verification_status')='unverified',
  'company-managed edits must never auto-verify the profile'
);

select pg_temp.p37a_assert(
  (:'managed_state'::jsonb->'completeness'->'sections'->>'identity')::boolean,
  'identity completeness must be deterministic from canonical managed data'
);

select pg_temp.p37a_assert(
  (
    select count(*)
    from public.network_data_assertions
    where entity_type='company'
      and entity_id='00000000-0000-0000-0000-0000000037c1'
      and source_type='company_declared'
      and ownership_type='company_managed'
      and review_state='accepted'
      and source_reference='managed_profile:p3.7a'
  )=3,
  'three changed overview fields must create three company-managed assertions'
);

select pg_temp.p37a_assert(
  (
    select count(*)
    from public.network_profile_management_events
    where network_company_id='00000000-0000-0000-0000-0000000037c1'
      and operation='update_overview'
  )=3,
  'three changed overview fields must create three immutable audit events'
);

select pg_temp.p37a_assert(
  not has_table_privilege(
    'authenticated',
    'public.network_profile_management_events',
    'SELECT'
  ),
  'authenticated users must not read the audit ledger directly'
);

select pg_temp.p37a_assert(
  public.p3_7_profile_management_contract()
    ->'sections'->'overview'->'platform_controlled' ? 'legal_name',
  'legal name must remain Platform-controlled'
);

select pg_temp.p37a_assert(
  public.p3_7_profile_management_contract()
    ->'sections'->'certifications'->>'verification_platform_controlled'='true',
  'certification verification must remain Platform-controlled'
);

rollback;
