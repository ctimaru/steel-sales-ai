-- HOME-FEED2 acceptance: Home feed companies from the families of the
-- organization's bills of material. Published only, own linked profile
-- excluded, archived bills ignored, names only with Network access,
-- membership required, no bill content in the payload.
begin;

create or replace function pg_temp.hf2_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'HOME-FEED2 assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.hf2_as(uid text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users(id, email) values
('00000000-0000-0000-0000-0000000f2a01', 'hf2-pro@example.com'),
('00000000-0000-0000-0000-0000000f2a02', 'hf2-free@example.com'),
('00000000-0000-0000-0000-0000000f2a03', 'hf2-outsider@example.com');

insert into public.organizations(id, name, slug, created_by, country_code, onboarding_status) values
('00000000-0000-0000-0000-0000000f2f01', 'HF2 Pro', 'hf2-pro', '00000000-0000-0000-0000-0000000f2a01', 'IT', 'completed'),
('00000000-0000-0000-0000-0000000f2f02', 'HF2 Free', 'hf2-free', '00000000-0000-0000-0000-0000000f2a02', 'IT', 'completed'),
('00000000-0000-0000-0000-0000000f2f03', 'HF2 Outsider', 'hf2-outsider', '00000000-0000-0000-0000-0000000f2a03', 'IT', 'completed');

insert into public.organization_memberships(organization_id, user_id, role, status, is_default) values
('00000000-0000-0000-0000-0000000f2f01', '00000000-0000-0000-0000-0000000f2a01', 'admin', 'active', true),
('00000000-0000-0000-0000-0000000f2f02', '00000000-0000-0000-0000-0000000f2a02', 'admin', 'active', true),
('00000000-0000-0000-0000-0000000f2f03', '00000000-0000-0000-0000-0000000f2a03', 'admin', 'active', true);

insert into public.organization_product_entitlement_events(
  organization_id, product_key, event_type, source_kind, source_reference,
  idempotency_key, actor_authority_type, metadata
) values (
  '00000000-0000-0000-0000-0000000f2f01', 'network_access', 'granted', 'pilot', 'hf2-acceptance',
  'hf2.network.access.001', 'system', '{}'::jsonb
);

-- C1 tubes, verified, producer · C2 tubes, unverified · C3 flat products only
-- C4 tubes but draft · C5 tubes, the Pro organization's own profile.
insert into public.network_companies(id, legal_name, country_code, publication_status, claimed_status, verification_status) values
('00000000-0000-0000-0000-0000000f2c01', 'HF2 Tubi Verificata S.r.l.', 'IT', 'published', 'unclaimed', 'verified'),
('00000000-0000-0000-0000-0000000f2c02', 'HF2 Tubi S.r.l.', 'IT', 'published', 'unclaimed', 'unverified'),
('00000000-0000-0000-0000-0000000f2c03', 'HF2 Lamiere S.r.l.', 'IT', 'published', 'unclaimed', 'unverified'),
('00000000-0000-0000-0000-0000000f2c04', 'HF2 Bozza Tubi S.r.l.', 'IT', 'draft', 'unclaimed', 'unverified'),
('00000000-0000-0000-0000-0000000f2c05', 'HF2 Pro Profilo S.r.l.', 'IT', 'published', 'claimed', 'unverified');

insert into public.network_data_assertions(
  id, entity_type, entity_id, field_path, asserted_value,
  source_type, source_reference, ownership_type, confidence, review_state
) values (
  '00000000-0000-0000-0000-0000000f2d01', 'company', '00000000-0000-0000-0000-0000000f2c01',
  'products', '"tubes"'::jsonb, 'company_declared', 'hf2 acceptance', 'company_managed', 1.0000, 'accepted'
);

insert into public.network_company_products(company_id, product_family_id, relationship_type, source_assertion_id)
select c.id, f.id, 'produces', '00000000-0000-0000-0000-0000000f2d01'
from (values
  ('00000000-0000-0000-0000-0000000f2c01'::uuid, 'hollow_sections'),
  ('00000000-0000-0000-0000-0000000f2c02'::uuid, 'tubes_pipes'),
  ('00000000-0000-0000-0000-0000000f2c03'::uuid, 'flat_products'),
  ('00000000-0000-0000-0000-0000000f2c04'::uuid, 'tubes_pipes'),
  ('00000000-0000-0000-0000-0000000f2c05'::uuid, 'tubes_pipes')
) c(id, family)
join public.network_product_families f on f.canonical_key = c.family;

insert into public.network_company_role_assignments(company_id, role_id, is_primary, source_assertion_id)
select '00000000-0000-0000-0000-0000000f2c01', r.id, true, '00000000-0000-0000-0000-0000000f2d01'
from public.network_company_roles r where r.canonical_key = 'producer';

-- Same claim → link shape as cpost1_company_posts.sql.
insert into public.network_company_claims(id, network_company_id, organization_id, requested_by, status,
  reviewed_by, reviewed_at, proof_method, proof_status, proof_verified_by, proof_verified_at) values
  ('00000000-0000-0000-0000-0000000f2e01'::uuid, '00000000-0000-0000-0000-0000000f2c05'::uuid,
   '00000000-0000-0000-0000-0000000f2f01'::uuid, '00000000-0000-0000-0000-0000000f2a01'::uuid, 'approved',
   '00000000-0000-0000-0000-0000000f2a01'::uuid, now(), 'manual_review', 'verified',
   '00000000-0000-0000-0000-0000000f2a01'::uuid, now());

insert into public.organization_network_company_links(organization_id, network_company_id, claim_id, link_status, linked_by)
values ('00000000-0000-0000-0000-0000000f2f01', '00000000-0000-0000-0000-0000000f2c05',
        '00000000-0000-0000-0000-0000000f2e01', 'active', '00000000-0000-0000-0000-0000000f2a01');

-- Pro: one live tube bill, one archived flat-products bill. Free: one tube bill.
insert into public.buyer_distintas(id, owner_user_id, organization_id, title, line_count, total_meters, total_tonnes, archived_at) values
('00000000-0000-0000-0000-0000000f2101', '00000000-0000-0000-0000-0000000f2a01', '00000000-0000-0000-0000-0000000f2f01', 'HF2 titolo riservato', 1, 120, 1.728, null),
('00000000-0000-0000-0000-0000000f2102', '00000000-0000-0000-0000-0000000f2a01', '00000000-0000-0000-0000-0000000f2f01', 'HF2 archiviata', 1, 120, 1.0, now()),
('00000000-0000-0000-0000-0000000f2103', '00000000-0000-0000-0000-0000000f2a02', '00000000-0000-0000-0000-0000000f2f02', 'HF2 free', 1, 120, 1.728, null);

insert into public.buyer_distinta_lines(distinta_id, line_position, description, quantity_mode, quantity, weight_kg_m, line_meters, line_tonnes) values
('00000000-0000-0000-0000-0000000f2101', 1, 'Tubo quadro 100 × 100 × 5 mm', 'bars', 10, 14.4, 120, 1.728),
('00000000-0000-0000-0000-0000000f2102', 1, 'Lamiera 2000 × 1000 × 3 mm', 'tonnes', 1, 1, 120, 1.0),
('00000000-0000-0000-0000-0000000f2103', 1, 'Tubo tondo Ø 60,3 × 3 mm', 'bars', 10, 4.24, 120, 0.509);

create temporary table hf2_result(label text primary key, payload jsonb) on commit drop;
create temporary table hf2_seen(company_id uuid primary key) on commit drop;
grant all on hf2_result to authenticated;
grant all on hf2_seen to authenticated;

set local role authenticated;

select pg_temp.hf2_as('00000000-0000-0000-0000-0000000f2a01');
insert into hf2_result values ('pro', public.homefeed2_distinta_companies('00000000-0000-0000-0000-0000000f2f01', 4, 0));
insert into hf2_result values ('pro_page2', public.homefeed2_distinta_companies('00000000-0000-0000-0000-0000000f2f01', 1, 1));

-- The local database can hold other published companies: walk every page and
-- check the fixtures by id rather than by exact totals.
do $$
declare
  v_offset integer := 0;
  v_page jsonb;
begin
  loop
    v_page := public.homefeed2_distinta_companies('00000000-0000-0000-0000-0000000f2f01', 12, v_offset);
    insert into hf2_seen
      select (i->>'id')::uuid from jsonb_array_elements(v_page->'items') i
      on conflict do nothing;
    v_offset := v_offset + 12;
    exit when v_offset >= (v_page->>'total')::integer or v_offset > 20000;
  end loop;
end;
$$;

select pg_temp.hf2_as('00000000-0000-0000-0000-0000000f2a02');
insert into hf2_result values ('free', public.homefeed2_distinta_companies('00000000-0000-0000-0000-0000000f2f02', 4, 0));

select pg_temp.hf2_as('00000000-0000-0000-0000-0000000f2a03');
insert into hf2_result values ('outsider_empty', public.homefeed2_distinta_companies('00000000-0000-0000-0000-0000000f2f03', 4, 0));
do $$
begin
  perform public.homefeed2_distinta_companies('00000000-0000-0000-0000-0000000f2f01', 4, 0);
  raise exception 'HOME-FEED2 assertion failed: a non-member read another organization';
exception when insufficient_privilege then
  null;
end;
$$;

reset role;

select pg_temp.hf2_assert((select payload->>'contract' from hf2_result where label='pro') = 'HOME-FEED2-distinta-companies-v1', 'contract');
select pg_temp.hf2_assert((select payload->'families' from hf2_result where label='pro') = '["tubes_pipes"]'::jsonb, 'archived bill ignored, tubes only');
select pg_temp.hf2_assert((select (payload->>'network_enabled')::boolean from hf2_result where label='pro'), 'Pro has Network access');
select pg_temp.hf2_assert(
  (select count(*) from hf2_seen) = (select (payload->>'total')::integer from hf2_result where label='pro'),
  'pages cover the total without repeats'
);
select pg_temp.hf2_assert(
  exists (select 1 from hf2_seen where company_id = '00000000-0000-0000-0000-0000000f2c01')
  and exists (select 1 from hf2_seen where company_id = '00000000-0000-0000-0000-0000000f2c02'),
  'published tube companies suggested'
);
select pg_temp.hf2_assert(
  not exists (select 1 from hf2_seen where company_id in (
    '00000000-0000-0000-0000-0000000f2c03', '00000000-0000-0000-0000-0000000f2c04', '00000000-0000-0000-0000-0000000f2c05')),
  'no flat-products, draft or own company'
);
select pg_temp.hf2_assert(
  (select (payload->'items'->0->>'verified')::boolean from hf2_result where label='pro'),
  'verified companies first'
);
select pg_temp.hf2_assert(
  (select payload->'items'->1->>'id' from hf2_result where label='pro')
    = (select payload->'items'->0->>'id' from hf2_result where label='pro_page2'),
  'offset pages through the same order'
);
select pg_temp.hf2_assert(
  (select payload::text from hf2_result where label='pro') not like '%riservato%'
  and (select payload::text from hf2_result where label='pro') not like '%Tubo quadro%',
  'no bill content in the payload'
);
select pg_temp.hf2_assert(not (select (payload->>'network_enabled')::boolean from hf2_result where label='free'), 'Free has no Network access');
select pg_temp.hf2_assert(
  (select (payload->>'total')::integer from hf2_result where label='free')
    = (select (payload->>'total')::integer from hf2_result where label='pro') + 1,
  'Free sees the total only, including the profile that is Pro''s own'
);
select pg_temp.hf2_assert((select jsonb_array_length(payload->'items') from hf2_result where label='free') = 0, 'Free sees no names');
select pg_temp.hf2_assert((select (payload->>'total')::integer from hf2_result where label='outsider_empty') = 0, 'no bills, no companies');

rollback;
