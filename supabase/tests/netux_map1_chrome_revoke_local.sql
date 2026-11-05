-- NET-UX-MAP1. Append-only CI-only entitlement revocation after Chrome.
\set ON_ERROR_STOP on
begin;
insert into public.organization_product_entitlement_events(
 organization_id,product_key,event_type,source_kind,source_reference,
 idempotency_key,actor_authority_type,metadata
) select
 '00000000-0000-0000-0000-000000023301','network_access','revoked','pilot',
 'netux-map1-local-chrome-fixture','netux.map1.chrome.revoke.20261105',
 'system','{"ci_only":true,"purpose":"restore_fixture"}'::jsonb
where exists(select 1 from public.organizations
 where id='00000000-0000-0000-0000-000000023301'::uuid and slug='dt23-buyer')
on conflict (idempotency_key) do nothing;
commit;
