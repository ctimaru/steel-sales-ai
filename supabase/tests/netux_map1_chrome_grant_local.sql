-- NET-UX-MAP1. Strictly local CI fixture. Never run against hosted Supabase.
-- The workflow pins psql to 127.0.0.1:54322 and seeds synthetic GoTrue users.
\set ON_ERROR_STOP on
begin;
do $$ begin
 if not exists(select 1 from public.organizations where id='00000000-0000-0000-0000-000000023301'::uuid and slug='dt23-buyer') then
  raise exception 'NET-UX-MAP1 requires disposable dt23 buyer tenant';
 end if;
end $$;
insert into public.organization_product_entitlement_events(
 organization_id,product_key,event_type,source_kind,source_reference,
 idempotency_key,actor_authority_type,metadata
) values (
 '00000000-0000-0000-0000-000000023301','network_access','granted','pilot',
 'netux-map1-local-chrome-fixture','netux.map1.chrome.grant.20261105',
 'system','{"ci_only":true,"purpose":"responsive_test"}'::jsonb
) on conflict (idempotency_key) do nothing;
commit;
