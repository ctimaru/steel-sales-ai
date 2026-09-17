-- Run only against a disposable Supabase development branch after applying
-- the P0.2 migrations. Everything is wrapped in a transaction and rolled back.

begin;

-- Synthetic identities used only inside this transaction.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'::uuid),
  ('00000000-0000-0000-0000-0000000000b1'::uuid),
  ('00000000-0000-0000-0000-0000000000c1'::uuid);

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'Tenant A', 'p0-test-tenant-a', '00000000-0000-0000-0000-0000000000a1'::uuid),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'Tenant C', 'p0-test-tenant-c', '00000000-0000-0000-0000-0000000000c1'::uuid);

insert into public.organization_memberships (
  organization_id, user_id, role, status, is_default
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'admin', 'active', true),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'member', 'active', true),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'admin', 'active', true);

insert into public.companies (id, owner_id, organization_id, name) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', 'Tenant A Company'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-000000000002', 'Tenant C Company');

insert into public.knowledge_sources (
  id, owner_id, organization_id, access_scope, source_key, source_type,
  source_class, name
) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', 'owner', 'p0-private-a', 'commercial_archive', 'internal', 'Private A'),
  ('40000000-0000-0000-0000-000000000002', null, null, 'global', 'p0-global', 'market', 'official', 'Global source');

-- Helper assertion available only for this transaction.
create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P0 tenant isolation assertion failed: %', message;
  end if;
end;
$$;

-- User A: own tenant visible, other tenant hidden, global knowledge visible.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.companies),
  'user A must see exactly tenant A company'
);
select pg_temp.assert_true(
  exists (select 1 from public.companies where id='30000000-0000-0000-0000-000000000001'),
  'user A must see tenant A row'
);
select pg_temp.assert_true(
  not exists (select 1 from public.companies where id='30000000-0000-0000-0000-000000000002'),
  'user A must not see tenant C row'
);
select pg_temp.assert_true(
  exists (select 1 from public.knowledge_sources where id='40000000-0000-0000-0000-000000000001'),
  'user A must see private A knowledge'
);
select pg_temp.assert_true(
  exists (select 1 from public.knowledge_sources where id='40000000-0000-0000-0000-000000000002'),
  'user A must see global knowledge'
);

-- User B: same organization must see A's private commercial/knowledge data.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.assert_true(
  exists (select 1 from public.companies where id='30000000-0000-0000-0000-000000000001'),
  'same-tenant user B must see user A commercial row'
);
select pg_temp.assert_true(
  exists (select 1 from public.knowledge_sources where id='40000000-0000-0000-0000-000000000001'),
  'same-tenant user B must see user A private knowledge'
);
select pg_temp.assert_true(
  not exists (select 1 from public.companies where id='30000000-0000-0000-0000-000000000002'),
  'same-tenant user B must not see tenant C data'
);

-- Tenant identity/provenance cannot be moved by an authenticated member.
do $$
begin
  begin
    update public.companies
    set organization_id='20000000-0000-0000-0000-000000000002'
    where id='30000000-0000-0000-0000-000000000001';
    raise exception 'tenant move unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'tenant move unexpectedly succeeded' then
        raise;
      end if;
  end;
end;
$$;

-- User C: isolated from tenant A but still sees global knowledge.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.assert_true(
  exists (select 1 from public.companies where id='30000000-0000-0000-0000-000000000002'),
  'user C must see tenant C data'
);
select pg_temp.assert_true(
  not exists (select 1 from public.companies where id='30000000-0000-0000-0000-000000000001'),
  'user C must not see tenant A data'
);
select pg_temp.assert_true(
  exists (select 1 from public.knowledge_sources where id='40000000-0000-0000-0000-000000000002'),
  'user C must see global knowledge'
);
select pg_temp.assert_true(
  not exists (select 1 from public.knowledge_sources where id='40000000-0000-0000-0000-000000000001'),
  'user C must not see tenant A private knowledge'
);

-- Suspended B loses tenant access while the membership row can still be inspected.
reset role;
update public.organization_memberships
set status='suspended', updated_at=now()
where organization_id='10000000-0000-0000-0000-000000000001'
  and user_id='00000000-0000-0000-0000-0000000000b1';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.companies),
  'suspended user B must lose tenant commercial access'
);
select pg_temp.assert_true(
  not exists (select 1 from public.knowledge_sources where id='40000000-0000-0000-0000-000000000001'),
  'suspended user B must lose private knowledge access'
);
select pg_temp.assert_true(
  exists (select 1 from public.knowledge_sources where id='40000000-0000-0000-0000-000000000002'),
  'suspended user B may still read global knowledge'
);

reset role;
rollback;
