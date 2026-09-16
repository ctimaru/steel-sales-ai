begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000012a1'::uuid, 'admin@p1-team.example'),
  ('00000000-0000-0000-0000-0000000012b1'::uuid, 'viewer@p1-team.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status)
values (
  '00000000-0000-0000-0000-0000000012f1'::uuid,
  'P1 Team Directory',
  'p1-team-directory',
  '00000000-0000-0000-0000-0000000012a1'::uuid,
  'completed'
);

insert into public.organization_memberships (organization_id, user_id, role, status, is_default)
values
  ('00000000-0000-0000-0000-0000000012f1', '00000000-0000-0000-0000-0000000012a1', 'admin', 'active', true),
  ('00000000-0000-0000-0000-0000000012f1', '00000000-0000-0000-0000-0000000012b1', 'viewer', 'active', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000012a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if (select count(*) from public.organization_team_members('00000000-0000-0000-0000-0000000012f1')) <> 2 then
    raise exception 'P1.1 team directory must return both tenant members to admin';
  end if;
  if not exists (
    select 1 from public.organization_team_members('00000000-0000-0000-0000-0000000012f1')
    where email = 'viewer@p1-team.example' and role = 'viewer'
  ) then
    raise exception 'P1.1 team directory must expose email + role to admin';
  end if;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000012b1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  begin
    perform * from public.organization_team_members('00000000-0000-0000-0000-0000000012f1');
    raise exception 'P1.1 viewer unexpectedly accessed admin team directory';
  exception when others then
    if position('Organization admin role required' in sqlerrm) = 0 then
      raise;
    end if;
  end;
end $$;

reset role;

-- Security hardening contract: all browser-facing P1.1 RPCs must execute as the
-- caller. Privileged implementations may remain SECURITY DEFINER only in the
-- non-exposed private schema and must never be callable by anon.
do $$
declare
  exposed_definers integer;
  private_impl_count integer;
  private_definer_count integer;
begin
  select count(*) into exposed_definers
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'claim_pending_organization_invitations',
      'create_organization_for_current_user',
      'is_organization_admin',
      'organization_team_members',
      'set_organization_member_role',
      'update_organization_onboarding'
    )
    and p.prosecdef;
  if exposed_definers <> 0 then
    raise exception 'P1.1 public RPCs must not remain SECURITY DEFINER';
  end if;

  select count(*), count(*) filter (where p.prosecdef)
  into private_impl_count, private_definer_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname in (
      'claim_pending_organization_invitations_impl',
      'create_organization_for_current_user_impl',
      'is_organization_admin',
      'organization_team_members_impl',
      'set_organization_member_role_impl',
      'update_organization_onboarding_impl'
    );
  if private_impl_count <> 6 or private_definer_count <> 6 then
    raise exception 'P1.1 privileged implementations must exist only as private SECURITY DEFINER helpers';
  end if;

  if has_schema_privilege('anon', 'private', 'USAGE') then
    raise exception 'P1.1 anon must not have USAGE on private schema';
  end if;
  if not has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'P1.1 authenticated wrapper execution requires private schema USAGE';
  end if;

  if has_function_privilege('anon', 'public.organization_team_members(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.claim_pending_organization_invitations()', 'EXECUTE')
     or has_function_privilege('anon', 'private.organization_team_members_impl(uuid)', 'EXECUTE') then
    raise exception 'P1.1 anon must not execute public or private onboarding functions';
  end if;

  if not has_function_privilege('authenticated', 'public.organization_team_members(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.claim_pending_organization_invitations()', 'EXECUTE') then
    raise exception 'P1.1 authenticated must retain browser-facing RPC access';
  end if;
end $$;

rollback;
