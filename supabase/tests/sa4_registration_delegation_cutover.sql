-- SA4 — Registration Delegation Cutover acceptance.
begin;

create or replace function pg_temp.sa4_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SA4 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.sa4_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'SA4 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'SA4 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a401'::uuid,'sa4-registration-admin@example.com',now()),
  ('00000000-0000-0000-0000-00000000a402'::uuid,'sa4-platform-auditor@example.com',now()),
  ('00000000-0000-0000-0000-00000000a403'::uuid,'sa4-outsider@example.com',now()),
  ('00000000-0000-0000-0000-00000000a410'::uuid,'sa4-applicant@example.com',now())
on conflict (id) do nothing;

do $root$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values ('00000000-0000-0000-0000-00000000a400'::uuid,'sa4-owner@example.com',now())
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-00000000a400'::uuid,
      'platform_superadmin','active',null,'SA4 acceptance fallback owner'
    );
  end if;
end
$root$;

select user_id as owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

insert into public.platform_staff(user_id,status,activated_at,updated_at)
values
  ('00000000-0000-0000-0000-00000000a401'::uuid,'active',now(),now()),
  ('00000000-0000-0000-0000-00000000a402'::uuid,'active',now(),now())
on conflict (user_id) do update
set status='active',suspended_at=null,revoked_at=null,updated_at=now();

insert into public.platform_staff_roles(user_id,role_key,status,assigned_by,reason)
values
  ('00000000-0000-0000-0000-00000000a401'::uuid,'registration_admin','active',:'owner_id'::uuid,'SA4 acceptance'),
  ('00000000-0000-0000-0000-00000000a402'::uuid,'platform_auditor','active',:'owner_id'::uuid,'SA4 acceptance');

-- Create four applicant-owned rows through the normal trigger contract.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a410',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
  legal_name,country_code,primary_company_type,contact_name,short_description
) values (
  'SA4 Information Request Co','IT','producer','Applicant','SA4 information request'
) returning id as info_app_id \gset

insert into public.company_registration_applications(
  legal_name,country_code,primary_company_type,contact_name,short_description
) values (
  'SA4 Approval Co','IT','producer','Applicant','SA4 approval'
) returning id as approve_app_id \gset

insert into public.company_registration_applications(
  legal_name,country_code,primary_company_type,contact_name,short_description
) values (
  'SA4 Rejection Co','IT','trader_distributor','Applicant','SA4 rejection'
) returning id as reject_app_id \gset

insert into public.company_registration_applications(
  legal_name,country_code,primary_company_type,contact_name,short_description
) values (
  'SA4 Activation Unique 4A9F','IT','producer','Applicant','SA4 activation and bridge'
) returning id as activate_app_id \gset

reset role;

update public.company_registration_applications
set application_status='pending_review',
    submitted_at=now(),
    email_verified_at=now()
where id in (
  :'info_app_id'::uuid,
  :'approve_app_id'::uuid,
  :'reject_app_id'::uuid
);

update public.company_registration_applications
set application_status='approved',
    submitted_at=now(),
    email_verified_at=now(),
    reviewed_at=now(),
    reviewed_by=:'owner_id'::uuid
where id=:'activate_app_id'::uuid;

-- Registration Admin can enter the registration domain and operate every
-- dedicated SA1 capability, but no unrelated Platform domain.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a401',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa4_assert(
  public.has_platform_permission('platform.console.access')
  and public.has_platform_permission('registrations.read')
  and public.has_platform_permission('registrations.request_information')
  and public.has_platform_permission('registrations.approve')
  and public.has_platform_permission('registrations.reject')
  and public.has_platform_permission('registrations.activate')
  and public.has_platform_permission('registrations.bridge_network'),
  'Registration Admin must receive the complete registration capability set'
);

select pg_temp.sa4_assert(
  not public.has_platform_permission('discovery.read')
  and not public.has_platform_permission('claims.read')
  and not public.has_platform_permission('knowledge.read_drafts')
  and not public.has_platform_permission('platform.staff.read'),
  'Registration Admin must remain outside Discovery, Claims, Knowledge and staff governance'
);

select pg_temp.sa4_assert(
  (public.p0a_admin_registration_queue(null)->>'count')::integer >= 4,
  'Registration Admin must read the registration queue'
);

select pg_temp.sa4_assert(
  public.p0a_admin_registration_detail(:'info_app_id'::uuid)->'application'->>'legal_name'
    = 'SA4 Information Request Co',
  'Registration Admin must read registration detail'
);

select public.p0a_request_registration_information(
  :'info_app_id'::uuid,
  'Please add the requested company evidence.'
);

select public.p0a_approve_registration_application(:'approve_app_id'::uuid);

select public.p0a_reject_registration_application(
  :'reject_app_id'::uuid,
  'incomplete_information',
  'Required evidence was not supplied.'
);

select public.p0a_activate_registration_application(:'activate_app_id'::uuid)
  as activation_payload \gset

select pg_temp.sa4_assert(
  (:'activation_payload'::jsonb->>'status')='activated'
  and (:'activation_payload'::jsonb->>'organization_id') is not null,
  'Registration Admin must activate an approved tenant'
);

select pg_temp.sa4_assert(
  jsonb_typeof(
    public.m7_registration_network_candidates(:'activate_app_id'::uuid)->'candidates'
  )='array',
  'Registration Admin with bridge permission must inspect identity candidates'
);

select public.m7_bridge_registration(:'activate_app_id'::uuid,null)
  as bridge_payload \gset

select pg_temp.sa4_assert(
  (:'bridge_payload'::jsonb->>'network_company_id') is not null
  and (:'bridge_payload'::jsonb->>'claim_status')='approved',
  'Registration Admin must complete the controlled Network bridge'
);

reset role;

select pg_temp.sa4_assert(
  not exists (
    select 1 from public.organization_memberships
    where user_id='00000000-0000-0000-0000-00000000a401'::uuid
  ),
  'Registration Admin must not gain tenant membership while activating another company'
);

select pg_temp.sa4_assert(
  exists (
    select 1 from public.platform_registration_events
    where application_id=:'approve_app_id'::uuid
      and event_type='application_approved'
      and actor_user_id='00000000-0000-0000-0000-00000000a401'::uuid
      and actor_type='platform_staff'
  ),
  'delegated registration ledger must identify the human as Platform Staff'
);

select pg_temp.sa4_assert(
  exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a401'::uuid
      and permission_key='registrations.approve'
      and action='registration_application_approved'
      and entity_id=:'approve_app_id'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a401'::uuid
      and permission_key='registrations.activate'
      and action='registration_workspace_activated'
      and entity_id=:'activate_app_id'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a401'::uuid
      and permission_key='registrations.bridge_network'
      and action='registration_network_bridge_completed'
      and entity_id=:'activate_app_id'
  ),
  'delegated registration mutations must record permission-aware global audit events'
);

-- Platform Auditor receives read-only visibility and no registration mutation.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a402',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa4_assert(
  public.has_platform_permission('registrations.read')
  and not public.has_platform_permission('registrations.approve')
  and not public.has_platform_permission('registrations.bridge_network'),
  'Platform Auditor must remain read-only for Registrations'
);

select pg_temp.sa4_assert(
  (public.p0a_admin_registration_queue(null)->>'count')::integer >= 4,
  'Platform Auditor must read the registration queue'
);

select pg_temp.sa4_assert_raises(
  format(
    'select public.p0a_approve_registration_application(%L::uuid)',
    :'info_app_id'
  ),
  'Platform permission required'
);

select pg_temp.sa4_assert_raises(
  format(
    'select public.m7_registration_network_candidates(%L::uuid)',
    :'activate_app_id'
  ),
  'Platform permission required'
);

-- A normal authenticated user cannot enter the delegated registration surface.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a403',true);

select pg_temp.sa4_assert_raises(
  'select public.p0a_admin_registration_queue(null)',
  'Platform permission required'
);

-- Platform Owner retains uninterrupted implicit access.
select set_config('request.jwt.claim.sub',:'owner_id',true);
select pg_temp.sa4_assert(
  public.has_platform_permission('registrations.read')
  and (public.p0a_admin_registration_queue(null)->>'count')::integer >= 4,
  'Platform Owner must retain registration access through the new capability model'
);

rollback;
