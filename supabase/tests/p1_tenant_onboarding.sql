-- P1.1 tenant onboarding and role-management acceptance.
-- Run only on the disposable CI Supabase instance. Everything rolls back.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000011a1'::uuid, 'owner@p1-test.example'),
  ('00000000-0000-0000-0000-0000000011b1'::uuid, 'member@p1-test.example'),
  ('00000000-0000-0000-0000-0000000011c1'::uuid, 'other@p1-test.example');

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P1.1 assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.assert_raises(statement text, expected_fragment text)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm) = 0 then
      raise exception 'P1.1 expected error containing "%", got "%"', expected_fragment, sqlerrm;
    end if;
    return;
  end;
  raise exception 'P1.1 statement unexpectedly succeeded: %', statement;
end;
$$;

-- Anonymous users cannot use the onboarding RPC.
set local role anon;
select pg_temp.assert_raises(
  $$select public.create_organization_for_current_user('Anonymous Steel', 'IT', 'Steel tubes')$$,
  'permission denied'
);

-- A newly authenticated user can create exactly one organization and becomes
-- its active default admin.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000011a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'p1.test_org_id',
  public.create_organization_for_current_user('P1 Test Steel', 'it', 'Steel tubes')::text,
  true
);

select pg_temp.assert_true(
  exists (
    select 1 from public.organization_memberships
    where organization_id = current_setting('p1.test_org_id')::uuid
      and user_id = '00000000-0000-0000-0000-0000000011a1'
      and role = 'admin' and status = 'active' and is_default
  ),
  'creator must become active default admin'
);
select pg_temp.assert_true(
  exists (
    select 1 from public.organizations
    where id = current_setting('p1.test_org_id')::uuid
      and country_code = 'IT'
      and industry = 'Steel tubes'
      and onboarding_status = 'profile'
  ),
  'organization profile must be normalized and onboarding started'
);
select pg_temp.assert_raises(
  $$select public.create_organization_for_current_user('Second Tenant', 'IT', 'Steel')$$,
  'already belongs to an active organization'
);

-- Completion is fail-closed until at least one source is selected and the
-- data-processing acknowledgement has been captured.
select pg_temp.assert_raises(
  format(
    $$select public.update_organization_onboarding(%L::uuid, 'P1 Test Steel', 'IT', 'Steel tubes', '{}'::text[], false, true)$$,
    current_setting('p1.test_org_id')
  ),
  'At least one data source preference is required'
);

select public.update_organization_onboarding(
  current_setting('p1.test_org_id')::uuid,
  'P1 Test Steel',
  'IT',
  'Steel tubes',
  array['xlsx', 'pdf', 'xlsx'],
  true,
  true
);
select pg_temp.assert_true(
  exists (
    select 1 from public.organizations
    where id = current_setting('p1.test_org_id')::uuid
      and onboarding_status = 'completed'
      and source_preferences = array['pdf','xlsx']::text[]
      and consent_version = 'p1-v1'
      and consent_accepted_at is not null
      and onboarding_completed_at is not null
  ),
  'completed onboarding must persist normalized sources and acknowledgement'
);

-- Create a pending invitation as the trusted backend would do after verifying
-- the actor. Only the tenant admin may read it through RLS.
reset role;
insert into public.organization_invitations (
  organization_id, email, role, invited_by
) values (
  current_setting('p1.test_org_id')::uuid,
  'member@p1-test.example',
  'member',
  '00000000-0000-0000-0000-0000000011a1'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000011a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.organization_invitations),
  'tenant admin must see pending invitations'
);

-- Unrelated authenticated user cannot see the organization/invite and cannot
-- claim an invitation intended for another email.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000011c1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.organization_invitations),
  'cross-tenant user must not see invitations'
);
select pg_temp.assert_true(
  public.claim_pending_organization_invitations() = 0,
  'wrong email must not claim an invitation'
);

-- Correct email claims the invite exactly once and becomes a member. A second
-- call is idempotent.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000011b1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.assert_true(
  public.claim_pending_organization_invitations() = 1,
  'matching email must claim one invitation'
);
select pg_temp.assert_true(
  public.claim_pending_organization_invitations() = 0,
  'invitation claim must be idempotent'
);
select pg_temp.assert_true(
  exists (
    select 1 from public.organization_memberships
    where organization_id = current_setting('p1.test_org_id')::uuid
      and user_id = '00000000-0000-0000-0000-0000000011b1'
      and role = 'member' and status = 'active'
  ),
  'claimed invitation must create active membership'
);

-- Member can inspect their organization but cannot mutate onboarding or roles.
select pg_temp.assert_raises(
  format(
    $$select public.update_organization_onboarding(%L::uuid, 'Compromised', 'IT', 'Steel', array['pdf'], true, true)$$,
    current_setting('p1.test_org_id')
  ),
  'Organization admin role required'
);
select pg_temp.assert_raises(
  format(
    $$select public.set_organization_member_role(%L::uuid, '00000000-0000-0000-0000-0000000011b1'::uuid, 'admin')$$,
    current_setting('p1.test_org_id')
  ),
  'Organization admin role required'
);

-- Admin can view the team and change roles, but the last-admin guard prevents
-- tenant lockout.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000011a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.assert_true(
  (select count(*) = 2 from public.organization_memberships where organization_id = current_setting('p1.test_org_id')::uuid),
  'admin team view must include both memberships'
);
select public.set_organization_member_role(
  current_setting('p1.test_org_id')::uuid,
  '00000000-0000-0000-0000-0000000011b1'::uuid,
  'viewer'
);
select pg_temp.assert_true(
  exists (
    select 1 from public.organization_memberships
    where organization_id = current_setting('p1.test_org_id')::uuid
      and user_id = '00000000-0000-0000-0000-0000000011b1'
      and role = 'viewer'
  ),
  'admin must be able to change a member role'
);
select pg_temp.assert_raises(
  format(
    $$select public.set_organization_member_role(%L::uuid, '00000000-0000-0000-0000-0000000011a1'::uuid, 'member')$$,
    current_setting('p1.test_org_id')
  ),
  'Cannot demote the last active organization admin'
);

-- Once a second admin exists, role handoff is allowed.
select public.set_organization_member_role(
  current_setting('p1.test_org_id')::uuid,
  '00000000-0000-0000-0000-0000000011b1'::uuid,
  'admin'
);
select public.set_organization_member_role(
  current_setting('p1.test_org_id')::uuid,
  '00000000-0000-0000-0000-0000000011a1'::uuid,
  'member'
);
select pg_temp.assert_true(
  exists (
    select 1 from public.organization_memberships
    where organization_id = current_setting('p1.test_org_id')::uuid
      and user_id = '00000000-0000-0000-0000-0000000011b1'
      and role = 'admin'
  ),
  'admin handoff must preserve at least one active admin'
);

reset role;
rollback;
