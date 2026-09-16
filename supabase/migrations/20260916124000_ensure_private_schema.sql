-- Ensure the non-exposed helper schema exists in fresh/local rebuilds as well as production.
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;
