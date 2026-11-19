-- RFQHUB1D acceptance: Network channel per supplier (privacy-reviewed,
-- Network access only), e-mail-domain match for e-mail-only suppliers
-- (no webmail), owner-only link that never overwrites, tenant isolation.
begin;

create or replace function pg_temp.r1d_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'RFQHUB1D assertion failed: %', message;
  end if;
end;
$$;

insert into auth.users(id, email) values
('00000000-0000-0000-0000-0000001d1a01', 'r1d-buyer@example.com'),
('00000000-0000-0000-0000-0000001d1a02', 'r1d-colleague@example.com'),
('00000000-0000-0000-0000-0000001d1b01', 'r1d-other@example.com');

insert into public.organizations(id, name, slug, created_by, country_code, onboarding_status) values
('00000000-0000-0000-0000-0000001d1f01', 'R1D Buyer', 'r1d-buyer', '00000000-0000-0000-0000-0000001d1a01', 'IT', 'completed'),
('00000000-0000-0000-0000-0000001d1f02', 'R1D Other', 'r1d-other', '00000000-0000-0000-0000-0000001d1b01', 'IT', 'completed');

insert into public.organization_memberships(organization_id, user_id, role, status, is_default) values
('00000000-0000-0000-0000-0000001d1f01', '00000000-0000-0000-0000-0000001d1a01', 'admin', 'active', true),
('00000000-0000-0000-0000-0000001d1f01', '00000000-0000-0000-0000-0000001d1a02', 'member', 'active', true),
('00000000-0000-0000-0000-0000001d1f02', '00000000-0000-0000-0000-0000001d1b01', 'admin', 'active', true);

-- Only the buyer organization has Network access.
insert into public.organization_product_entitlement_events(
  organization_id, product_key, event_type, source_kind, source_reference,
  idempotency_key, actor_authority_type, metadata
) values (
  '00000000-0000-0000-0000-0000001d1f01', 'network_access', 'granted', 'pilot', 'r1d-acceptance',
  'r1d.network.access.001', 'system', '{}'::jsonb
);

insert into public.network_companies(id, legal_name, country_code, website_domain, publication_status, claimed_status, verification_status) values
('00000000-0000-0000-0000-0000001d1c01', 'R1D Tubi S.p.A.', 'IT', 'www.r1d-tubi.example.test', 'published', 'unclaimed', 'unverified'),
('00000000-0000-0000-0000-0000001d1c02', 'R1D Senza Canale S.r.l.', 'IT', null, 'published', 'unclaimed', 'unverified'),
('00000000-0000-0000-0000-0000001d1c03', 'R1D Bozza S.r.l.', 'IT', 'r1d-bozza.example.test', 'draft', 'unclaimed', 'unverified'),
('00000000-0000-0000-0000-0000001d1c04', 'R1D Webmail S.r.l.', 'IT', 'gmail.com', 'published', 'unclaimed', 'unverified');

insert into public.network_contacts(
  company_id, contact_type, display_name, email, publication_status, verification_status,
  privacy_classification, privacy_legal_basis, lia_status, art14_status,
  privacy_reviewed_at, privacy_reviewed_by, privacy_review_expires_at
) values
('00000000-0000-0000-0000-0000001d1c01', 'sales', 'Ufficio vendite', 'Vendite@R1D-Tubi.example.test', 'published', 'verified',
 'company_channel', 'not_applicable_company_data', 'not_required', 'not_required',
 now(), '00000000-0000-0000-0000-0000001d1a01', now() + interval '1 year');
-- R1D Senza Canale has no published contact: it never shows a channel.

-- Supplier profiles: e-mail-only at the Tubi domain, e-mail-only on webmail,
-- already linked, and a colleague's profile.
insert into public.buyer_supplier_profiles(id, owner_user_id, organization_id, identity_key, display_name, email_normalized, supplier_network_company_id) values
('00000000-0000-0000-0000-0000001d1e01', '00000000-0000-0000-0000-0000001d1a01', '00000000-0000-0000-0000-0000001d1f01',
 'email:mario@r1d-tubi.example.test', 'Mario Rossi', 'mario@r1d-tubi.example.test', null),
('00000000-0000-0000-0000-0000001d1e02', '00000000-0000-0000-0000-0000001d1a01', '00000000-0000-0000-0000-0000001d1f01',
 'email:tubi@gmail.com', 'Tubi Gmail', 'tubi@gmail.com', null),
('00000000-0000-0000-0000-0000001d1e03', '00000000-0000-0000-0000-0000001d1a01', '00000000-0000-0000-0000-0000001d1f01',
 'network_company:00000000-0000-0000-0000-0000001d1c02', 'R1D Senza Canale', null, '00000000-0000-0000-0000-0000001d1c02'),
('00000000-0000-0000-0000-0000001d1e04', '00000000-0000-0000-0000-0000001d1a02', '00000000-0000-0000-0000-0000001d1f01',
 'email:anna@r1d-tubi.example.test', 'Anna', 'anna@r1d-tubi.example.test', null);

create temp table r1d_out(step text primary key, result jsonb) on commit drop;
grant all on r1d_out to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000001d1a01', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001d1a01","role":"authenticated"}', true);

insert into r1d_out values ('channels', public.rfqhub1d_network_channels('00000000-0000-0000-0000-0000001d1f01', array[
  '00000000-0000-0000-0000-0000001d1c01', '00000000-0000-0000-0000-0000001d1c02',
  '00000000-0000-0000-0000-0000001d1c03', '00000000-0000-0000-0000-0000001d1c01']::uuid[]));
insert into r1d_out values ('matches', public.rfqhub1d_supplier_domain_matches(array[
  '00000000-0000-0000-0000-0000001d1e01', '00000000-0000-0000-0000-0000001d1e02',
  '00000000-0000-0000-0000-0000001d1e03', '00000000-0000-0000-0000-0000001d1e04']::uuid[]));
insert into r1d_out values ('link', public.rfqhub1d_link_supplier_profile(
  '00000000-0000-0000-0000-0000001d1e01', '00000000-0000-0000-0000-0000001d1c01'));
insert into r1d_out values ('relink', public.rfqhub1d_link_supplier_profile(
  '00000000-0000-0000-0000-0000001d1e01', '00000000-0000-0000-0000-0000001d1c02'));
insert into r1d_out values ('draft', public.rfqhub1d_link_supplier_profile(
  '00000000-0000-0000-0000-0000001d1e02', '00000000-0000-0000-0000-0000001d1c03'));
do $$
begin
  perform public.rfqhub1d_link_supplier_profile('00000000-0000-0000-0000-0000001d1e04', '00000000-0000-0000-0000-0000001d1c01');
  raise exception 'RFQHUB1D assertion failed: linked a colleague''s profile';
exception when insufficient_privilege then null;
end;
$$;
reset role;

select pg_temp.r1d_assert((select jsonb_array_length(result) = 1
  and result->0->>'network_company_id' = '00000000-0000-0000-0000-0000001d1c01'
  and result->0->>'email' = 'vendite@r1d-tubi.example.test'
  and result->0->>'display_name' = 'Ufficio vendite' from r1d_out where step = 'channels'),
  'only the reviewed channel of a published company, once');
select pg_temp.r1d_assert((select jsonb_array_length(result) = 1
  and result->0->>'profile_id' = '00000000-0000-0000-0000-0000001d1e01'
  and result->0->>'network_company_id' = '00000000-0000-0000-0000-0000001d1c01'
  and result->0->>'name' = 'R1D Tubi S.p.A.' from r1d_out where step = 'matches'),
  'domain match for own e-mail-only profile; no webmail, no linked, no colleague');
select pg_temp.r1d_assert((select (result->>'ok')::boolean from r1d_out where step = 'link'), 'link works');
select pg_temp.r1d_assert((select supplier_network_company_id = '00000000-0000-0000-0000-0000001d1c01'
  and identity_key = 'email:mario@r1d-tubi.example.test'
  from public.buyer_supplier_profiles where id = '00000000-0000-0000-0000-0000001d1e01'), 'linked, history key unchanged');
select pg_temp.r1d_assert((select result->>'error' = 'already_linked' from r1d_out where step = 'relink'), 'never overwrites');
select pg_temp.r1d_assert((select result->>'error' = 'network_company_not_found' from r1d_out where step = 'draft'), 'unpublished rejected');

-- Without Network access the channels are empty; non-members are refused.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000001d1b01', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001d1b01","role":"authenticated"}', true);
select pg_temp.r1d_assert(public.rfqhub1d_network_channels('00000000-0000-0000-0000-0000001d1f02',
  array['00000000-0000-0000-0000-0000001d1c01']::uuid[]) = '[]'::jsonb, 'no Network access, no channels');
do $$
begin
  perform public.rfqhub1d_network_channels('00000000-0000-0000-0000-0000001d1f01', array['00000000-0000-0000-0000-0000001d1c01']::uuid[]);
  raise exception 'RFQHUB1D assertion failed: non-member read channels';
exception when insufficient_privilege then null;
end;
$$;
select pg_temp.r1d_assert(public.rfqhub1d_supplier_domain_matches(array['00000000-0000-0000-0000-0000001d1e02']::uuid[]) = '[]'::jsonb,
  'other tenant sees no matches for foreign profiles');
reset role;

select pg_temp.r1d_assert(not has_function_privilege('anon', 'public.rfqhub1d_network_channels(uuid,uuid[])', 'execute'), 'anon channels');
select pg_temp.r1d_assert(not has_function_privilege('anon', 'public.rfqhub1d_supplier_domain_matches(uuid[])', 'execute'), 'anon matches');
select pg_temp.r1d_assert(not has_function_privilege('anon', 'public.rfqhub1d_link_supplier_profile(uuid,uuid)', 'execute'), 'anon link');

rollback;
