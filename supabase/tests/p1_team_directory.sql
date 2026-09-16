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
rollback;
