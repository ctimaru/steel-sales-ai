-- SA2 — Platform RBAC Foundation acceptance.
-- Disposable CI transaction only.
begin;

create or replace function pg_temp.sa2_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SA2 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.sa2_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'SA2 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'SA2 statement unexpectedly succeeded: %',statement;
end;
$$;

-- Synthetic staff identities.
insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a201'::uuid,'registration-admin@sa2.example',now()),
  ('00000000-0000-0000-0000-00000000a202'::uuid,'knowledge-editor@sa2.example',now()),
  ('00000000-0000-0000-0000-00000000a203'::uuid,'knowledge-publisher@sa2.example',now()),
  ('00000000-0000-0000-0000-00000000a204'::uuid,'unrelated@sa2.example',now())
on conflict (id) do nothing;

-- Clean CI can lack the production founder. Preserve any existing root, or add
-- a disposable one only when necessary.
do $sa2_root$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values ('00000000-0000-0000-0000-00000000a200'::uuid,'owner@sa2.example',now())
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-00000000a200'::uuid,
      'platform_superadmin','active',null,'SA2 acceptance fallback owner'
    );
  end if;
end
$sa2_root$;

select user_id as owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

-- Contract seed must match SA1 exactly.
select pg_temp.sa2_assert(
  (select count(*)>=31 from public.platform_permissions),
  'permission catalog must retain the complete 31-permission SA1 baseline after later delegated domains'
);
select pg_temp.sa2_assert(
  (select count(*)>=6 from public.platform_roles where status='active'),
  'all six v1 staff role templates must remain active after later role additions'
);
select pg_temp.sa2_assert(
  (select count(*)>=39 from public.platform_role_permissions),
  'role templates must retain the frozen 39 SA1 mappings after later delegated domains'
);
select pg_temp.sa2_assert(
  not exists (
    select 1
    from public.platform_role_permissions prp
    join public.platform_permissions pp on pp.permission_key=prp.permission_key
    where pp.is_root_only
  ),
  'no root-only permission may appear in a staff role'
);
select pg_temp.sa2_assert_raises(
  $$insert into public.platform_role_permissions(role_key,permission_key)
    values ('platform_auditor','platform.settings.manage')$$,
  'Root-only permission'
);

-- Raw RBAC state must not be browser-readable.
select pg_temp.sa2_assert(
  not has_table_privilege('authenticated','public.platform_staff','SELECT')
  and not has_table_privilege('authenticated','public.platform_staff_roles','SELECT')
  and not has_table_privilege('authenticated','public.platform_permissions','SELECT')
  and not has_table_privilege('authenticated','public.platform_access_events','SELECT'),
  'browser roles must not read raw RBAC or audit tables'
);

-- Platform Owner is a singleton bypass for every *known* permission but unknown
-- permissions still fail closed.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa2_assert(public.is_platform_superadmin(),'legacy root check must remain intact');
select pg_temp.sa2_assert(
  public.has_platform_permission('platform.settings.manage'),
  'Platform Owner must satisfy root-only known permissions'
);
select pg_temp.sa2_assert(
  public.has_platform_permission('registrations.approve'),
  'Platform Owner must satisfy operational permissions'
);
select pg_temp.sa2_assert(
  not public.has_platform_permission('unknown.permission'),
  'unknown permissions must fail closed even for Platform Owner'
);

select public.platform_access_context() as owner_context \gset
select pg_temp.sa2_assert(
  :'owner_context'::jsonb->>'authority_type'='platform_owner'
  and jsonb_array_length(:'owner_context'::jsonb->'permissions')>=31,
  'owner context must preserve the full SA1 permission baseline after later delegated domains'
);

-- Root and staff identities are structurally separate.
reset role;
select pg_temp.sa2_assert_raises(
  format(
    $$insert into public.platform_staff(user_id,status)
      values (%L::uuid,'active')$$,
    :'owner_id'
  ),
  'Platform Owner cannot also be a Platform Staff identity'
);

-- Root creates a Registration Admin invitation.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.sa2_create_platform_staff_invitation(
  'registration-admin@sa2.example',
  array['registration_admin'],
  now()+interval '2 days',
  'SA2 registration delegation'
) as registration_invite \gset

select pg_temp.sa2_assert(
  :'registration_invite'::uuid is not null,
  'owner must be able to create a Platform Staff invitation'
);

-- Wrong identity cannot claim an invitation addressed to another email.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a204',true);
select public.sa2_claim_platform_staff_invitation() as unrelated_claim \gset
select pg_temp.sa2_assert(
  (:'unrelated_claim'::jsonb->>'claimed')::boolean=false,
  'invitation claim must be email-scoped'
);

-- Correct verified account claims invitation and receives exactly the template.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a201',true);
select public.sa2_claim_platform_staff_invitation() as registration_claim \gset
select pg_temp.sa2_assert(
  (:'registration_claim'::jsonb->>'claimed')::boolean=true,
  'matching verified identity must claim the invitation'
);
select pg_temp.sa2_assert(
  public.has_platform_permission('platform.console.access')
  and public.has_platform_permission('registrations.read')
  and public.has_platform_permission('registrations.approve')
  and public.has_platform_permission('registrations.activate'),
  'Registration Admin must receive registration capabilities'
);
select pg_temp.sa2_assert(
  not public.has_platform_permission('discovery.read')
  and not public.has_platform_permission('claims.read')
  and not public.has_platform_permission('platform.staff.manage_roles')
  and not public.has_platform_permission('tenant_access.break_glass'),
  'Registration Admin must not cross domain or root boundaries'
);
select pg_temp.sa2_assert(
  not public.is_platform_superadmin(),
  'delegated staff must never become legacy/root superadmin'
);

-- Staff cannot self-elevate through the root-only role-management RPC.
select pg_temp.sa2_assert_raises(
  $$select public.sa2_set_platform_staff_roles(
      '00000000-0000-0000-0000-00000000a201'::uuid,
      array['registration_admin','platform_auditor'],
      'self escalation'
    )$$,
  'Platform permission required'
);

-- Root may deliberately combine fixed templates; effective permissions are the
-- union and no arbitrary per-user permission override exists.
select set_config('request.jwt.claim.sub',:'owner_id',true);
select public.sa2_set_platform_staff_roles(
  '00000000-0000-0000-0000-00000000a201'::uuid,
  array['registration_admin','platform_auditor'],
  'SA2 union-of-role acceptance'
) as combined_roles \gset

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a201',true);
select pg_temp.sa2_assert(
  public.has_platform_permission('platform.audit.read')
  and public.has_platform_permission('registrations.approve')
  and not public.has_platform_permission('discovery.run'),
  'multiple fixed roles must union capabilities without unrelated permissions'
);

-- Suspension is authorization-time state: no logout/JWT refresh is needed to
-- lose Platform capabilities.
select set_config('request.jwt.claim.sub',:'owner_id',true);
select public.sa2_set_platform_staff_status(
  '00000000-0000-0000-0000-00000000a201'::uuid,
  'suspended',
  'SA2 immediate suspension test'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a201',true);
select pg_temp.sa2_assert(
  not public.has_platform_permission('platform.console.access')
  and not public.has_platform_permission('registrations.read'),
  'suspended staff must immediately lose every effective permission'
);
select public.platform_access_context() as suspended_context \gset
select pg_temp.sa2_assert(
  :'suspended_context'::jsonb->>'staff_status'='suspended'
  and jsonb_array_length(:'suspended_context'::jsonb->'permissions')=0,
  'suspended access context must preserve status but expose no permissions'
);

-- Root can reactivate a suspended identity; revocation remains terminal and
-- requires reinvitation.
select set_config('request.jwt.claim.sub',:'owner_id',true);
select public.sa2_set_platform_staff_status(
  '00000000-0000-0000-0000-00000000a201'::uuid,
  'active',
  'SA2 restore after suspension test'
);
select public.sa2_set_platform_staff_status(
  '00000000-0000-0000-0000-00000000a201'::uuid,
  'revoked',
  'SA2 terminal revocation test'
);
select pg_temp.sa2_assert_raises(
  $$select public.sa2_set_platform_staff_status(
      '00000000-0000-0000-0000-00000000a201'::uuid,
      'active',
      'attempt silent resurrection'
    )$$,
  'must be re-invited'
);

-- Knowledge editor and publisher remain separated.
select public.sa2_create_platform_staff_invitation(
  'knowledge-editor@sa2.example',
  array['knowledge_editor'],
  now()+interval '2 days',
  'SA2 Knowledge Editor test'
) as editor_invite \gset
select public.sa2_create_platform_staff_invitation(
  'knowledge-publisher@sa2.example',
  array['knowledge_publisher'],
  now()+interval '2 days',
  'SA2 Knowledge Publisher test'
) as publisher_invite \gset

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a202',true);
select public.sa2_claim_platform_staff_invitation();
select pg_temp.sa2_assert(
  public.has_platform_permission('knowledge.edit')
  and public.has_platform_permission('knowledge.review')
  and not public.has_platform_permission('knowledge.publish'),
  'Knowledge Editor must not publish'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a203',true);
select public.sa2_claim_platform_staff_invitation();
select pg_temp.sa2_assert(
  not public.has_platform_permission('knowledge.edit')
  and public.has_platform_permission('knowledge.review')
  and public.has_platform_permission('knowledge.publish'),
  'Knowledge Publisher must publish without default edit authority'
);

-- Assignment/lifecycle operations must leave actor + permission audit evidence.
reset role;
select pg_temp.sa2_assert(
  exists (
    select 1 from public.platform_access_events
    where action='staff_invitation_created'
      and actor_authority_type='platform_owner'
      and permission_key='platform.staff.invite'
  )
  and exists (
    select 1 from public.platform_access_events
    where action='staff_invitation_accepted'
      and actor_authority_type='platform_staff'
  )
  and exists (
    select 1 from public.platform_access_events
    where action='staff_roles_changed'
      and permission_key='platform.staff.manage_roles'
  )
  and exists (
    select 1 from public.platform_access_events
    where action='staff_status_changed'
      and permission_key='platform.staff.suspend'
  ),
  'staff lifecycle and role changes must be auditable'
);

-- Owner can read directory primitives; registration staff cannot.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select pg_temp.sa2_assert(
  (select count(*)>=3 from public.sa2_platform_staff_directory()),
  'owner directory must expose delegated staff through an authorization-checked RPC'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a202',true);
select pg_temp.sa2_assert_raises(
  $$select * from public.sa2_platform_staff_directory()$$,
  'Platform permission required'
);

rollback;
