-- STAGING-READY1. Run only after verifying the exact isolated staging project.
-- The connection guard in the GitHub workflow enforces this before invoking psql.
-- Read-only preflight: no company records or auth users are created.
do $$
declare
  missing_tables text[];
  bad_rls text[];
  existing_users bigint;
begin
  select array_agg(name)
    into missing_tables
  from unnest(array[
    'organizations',
    'organization_memberships',
    'companies',
    'rfqs',
    'offers'
  ]) as name
  where to_regclass('public.' || name) is null;

  if coalesce(cardinality(missing_tables), 0) > 0 then
    raise exception 'STAGING-READY1 missing expected schema: %', missing_tables;
  end if;

  select array_agg(c.relname)
    into bad_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('organizations', 'organization_memberships', 'companies', 'rfqs', 'offers')
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if coalesce(cardinality(bad_rls), 0) > 0 then
    raise exception 'STAGING-READY1 RLS is disabled for %', bad_rls;
  end if;

  select count(*) into existing_users from auth.users;
  if existing_users <> 0 then
    raise exception 'STAGING-READY1 requires zero pre-existing auth identities, observed %', existing_users;
  end if;

  raise notice 'STAGING-READY1 schema, RLS and empty identities checked';
end;
$$;
