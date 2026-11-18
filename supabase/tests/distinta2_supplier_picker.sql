-- DISTINTA2 acceptance: supplier groups for step 2 «A chi lo chiedi»,
-- product-family recommendations, reachability, de-duplication across groups,
-- exclusion of suppliers already in the RFQ, removal before sending only,
-- owner-only access and tenant isolation.
begin;

create or replace function pg_temp.d2_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'DISTINTA2 assertion failed: %', message;
  end if;
end;
$$;

insert into auth.users(id, email) values
('00000000-0000-0000-0000-0000000d2a01', 'd2-buyer@example.com'),
('00000000-0000-0000-0000-0000000d2b01', 'd2-other@example.com');

insert into public.organizations(id, name, slug, created_by, country_code, onboarding_status) values
('00000000-0000-0000-0000-0000000d2f01', 'D2 Buyer', 'd2-buyer', '00000000-0000-0000-0000-0000000d2a01', 'IT', 'completed'),
('00000000-0000-0000-0000-0000000d2f02', 'D2 Other', 'd2-other', '00000000-0000-0000-0000-0000000d2b01', 'IT', 'completed');

insert into public.organization_memberships(organization_id, user_id, role, status, is_default) values
('00000000-0000-0000-0000-0000000d2f01', '00000000-0000-0000-0000-0000000d2a01', 'admin', 'active', true),
('00000000-0000-0000-0000-0000000d2f02', '00000000-0000-0000-0000-0000000d2b01', 'admin', 'active', true);

insert into public.organization_product_entitlement_events(
  organization_id, product_key, event_type, source_kind, source_reference,
  idempotency_key, actor_authority_type, metadata
) values (
  '00000000-0000-0000-0000-0000000d2f01', 'network_access', 'granted', 'pilot', 'd2-acceptance',
  'd2.network.access.001', 'system', '{}'::jsonb
);

-- Network: N1 tubes producer reachable, N2 tubes without contact, N3 flat
-- products reachable, N4 saved and unreachable, N5 saved, tubes, reachable,
-- N6 tubes trader reachable but unpublished.
insert into public.network_companies(id, legal_name, country_code, publication_status, claimed_status, verification_status) values
('00000000-0000-0000-0000-0000000d2c01', 'D2 Tubi Produttore S.r.l.', 'IT', 'published', 'unclaimed', 'unverified'),
('00000000-0000-0000-0000-0000000d2c02', 'D2 Tubi Senza Contatto S.r.l.', 'IT', 'published', 'unclaimed', 'unverified'),
('00000000-0000-0000-0000-0000000d2c03', 'D2 Lamiere S.r.l.', 'IT', 'published', 'unclaimed', 'unverified'),
('00000000-0000-0000-0000-0000000d2c04', 'D2 Salvata Muta S.r.l.', 'IT', 'published', 'unclaimed', 'unverified'),
('00000000-0000-0000-0000-0000000d2c05', 'D2 Salvata Tubi S.r.l.', 'IT', 'published', 'unclaimed', 'unverified'),
('00000000-0000-0000-0000-0000000d2c06', 'D2 Bozza Tubi S.r.l.', 'IT', 'draft', 'unclaimed', 'unverified');

insert into public.network_data_assertions(
  id, entity_type, entity_id, field_path, asserted_value,
  source_type, source_reference, ownership_type, confidence, review_state
) values (
  '00000000-0000-0000-0000-0000000d2d01', 'company', '00000000-0000-0000-0000-0000000d2c01',
  'products', '"tubes"'::jsonb, 'company_declared', 'd2 acceptance', 'company_managed', 1.0000, 'accepted'
);

insert into public.network_company_products(company_id, product_family_id, relationship_type, source_assertion_id)
select c.id, f.id, 'produces', '00000000-0000-0000-0000-0000000d2d01'
from (values
  ('00000000-0000-0000-0000-0000000d2c01'::uuid, 'hollow_sections'),
  ('00000000-0000-0000-0000-0000000d2c02'::uuid, 'tubes_pipes'),
  ('00000000-0000-0000-0000-0000000d2c03'::uuid, 'flat_products'),
  ('00000000-0000-0000-0000-0000000d2c05'::uuid, 'tubes_pipes'),
  ('00000000-0000-0000-0000-0000000d2c06'::uuid, 'tubes_pipes')
) c(id, family)
join public.network_product_families f on f.canonical_key = c.family;

insert into public.network_company_role_assignments(company_id, role_id, is_primary, source_assertion_id)
select '00000000-0000-0000-0000-0000000d2c01', r.id, true, '00000000-0000-0000-0000-0000000d2d01'
from public.network_company_roles r where r.canonical_key = 'producer';

insert into public.network_contacts(
  company_id, contact_type, display_name, email, publication_status, verification_status,
  privacy_classification, privacy_legal_basis, lia_status, art14_status,
  privacy_reviewed_at, privacy_reviewed_by, privacy_review_expires_at
)
select c.id, 'sales', 'Ufficio vendite', c.email, 'published', 'verified',
  'company_channel', 'not_applicable_company_data', 'not_required', 'not_required',
  now(), '00000000-0000-0000-0000-0000000d2a01', now() + interval '1 year'
from (values
  ('00000000-0000-0000-0000-0000000d2c01'::uuid, 'vendite@d2-tubi.example.test'),
  ('00000000-0000-0000-0000-0000000d2c03'::uuid, 'vendite@d2-lamiere.example.test'),
  ('00000000-0000-0000-0000-0000000d2c05'::uuid, 'vendite@d2-salvata.example.test'),
  ('00000000-0000-0000-0000-0000000d2c06'::uuid, 'vendite@d2-bozza.example.test')
) c(id, email);

insert into public.network_saved_companies(organization_id, user_id, network_company_id) values
('00000000-0000-0000-0000-0000000d2f01', '00000000-0000-0000-0000-0000000d2a01', '00000000-0000-0000-0000-0000000d2c04'),
('00000000-0000-0000-0000-0000000d2f01', '00000000-0000-0000-0000-0000000d2a01', '00000000-0000-0000-0000-0000000d2c05');

-- Private contact of the buyer organization.
insert into public.contacts(id, owner_id, organization_id, full_name, email) values
('00000000-0000-0000-0000-0000000d2e01', '00000000-0000-0000-0000-0000000d2a01', '00000000-0000-0000-0000-0000000d2f01', 'Mario Fornitore', 'mario@d2-contatto.example.test');

-- Bills of material and RFQs: a past RFQ with one supplier (recent), the draft under test.
insert into public.buyer_distintas(id, owner_user_id, organization_id, title, line_count, total_meters, total_tonnes) values
('00000000-0000-0000-0000-0000000d2101', '00000000-0000-0000-0000-0000000d2a01', '00000000-0000-0000-0000-0000000d2f01', 'D2 passata', 1, 120, 1.728),
('00000000-0000-0000-0000-0000000d2102', '00000000-0000-0000-0000-0000000d2a01', '00000000-0000-0000-0000-0000000d2f01', 'D2 nuova', 2, 240, 3.0);

insert into public.buyer_distinta_lines(distinta_id, line_position, description, quantity_mode, quantity, weight_kg_m, line_meters, line_tonnes) values
('00000000-0000-0000-0000-0000000d2101', 1, 'Tubo quadro 100 × 100 × 5 mm', 'bars', 10, 14.4, 120, 1.728),
('00000000-0000-0000-0000-0000000d2102', 1, 'Tubo quadro 100 × 100 × 5 mm', 'bars', 10, 14.4, 120, 1.728),
('00000000-0000-0000-0000-0000000d2102', 2, 'Tubo tondo Ø 60,3 × 3 mm', 'bars', 10, 4.24, 120, 0.509);

insert into public.buyer_rfq_campaigns(id, owner_user_id, organization_id, source_distinta_id, title, status) values
('00000000-0000-0000-0000-0000000d2201', '00000000-0000-0000-0000-0000000d2a01', '00000000-0000-0000-0000-0000000d2f01', '00000000-0000-0000-0000-0000000d2101', 'D2 RFQ passata', 'draft'),
('00000000-0000-0000-0000-0000000d2202', '00000000-0000-0000-0000-0000000d2a01', '00000000-0000-0000-0000-0000000d2f01', '00000000-0000-0000-0000-0000000d2102', 'D2 RFQ nuova', 'draft');

insert into public.buyer_rfq_suppliers(id, rfq_id, owner_user_id, identity_key, identity_source, supplier_name, supplier_email_normalized) values
('00000000-0000-0000-0000-0000000d2301', '00000000-0000-0000-0000-0000000d2201', '00000000-0000-0000-0000-0000000d2a01',
 'email:storico@d2-storico.example.test', 'manual', 'D2 Storico S.p.A.', 'storico@d2-storico.example.test');

select pg_temp.d2_assert(
  private.distinta2_line_family_keys('00000000-0000-0000-0000-0000000d2102') = array['tubes_pipes'],
  'tube lines map to the tubes family'
);

create temporary table d2_result(label text primary key, payload jsonb) on commit drop;
grant all on d2_result to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d2a01', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000d2a01","role":"authenticated"}', true);

insert into d2_result values ('first', public.distinta2_supplier_picker('00000000-0000-0000-0000-0000000d2202'));

reset role;

select pg_temp.d2_assert((select payload->>'contract' from d2_result where label='first') = 'DISTINTA2-supplier-picker-v1', 'contract');
select pg_temp.d2_assert((select (payload->>'network_enabled')::boolean from d2_result where label='first'), 'network enabled for entitled org');
select pg_temp.d2_assert((select payload->'families' from d2_result where label='first') = '["tubes_pipes"]'::jsonb, 'families reported');

create temporary table d2_rows on commit drop as
select c->>'group' as grp, c->>'company_name' as name, (c->>'reachable')::boolean as reachable, c->>'reason' as reason, ord
from d2_result r, jsonb_array_elements(r.payload->'candidates') with ordinality as x(c, ord)
where r.label = 'first';

select pg_temp.d2_assert(
  (select array_agg(name order by ord) from d2_rows where grp = 'saved')
    = array['D2 Salvata Tubi S.r.l.', 'D2 Salvata Muta S.r.l.']
  or (select array_agg(name order by ord) from d2_rows where grp = 'saved')
    = array['D2 Salvata Muta S.r.l.', 'D2 Salvata Tubi S.r.l.'],
  'both saved companies are listed'
);
select pg_temp.d2_assert(
  (select reachable from d2_rows where name = 'D2 Salvata Muta S.r.l.') = false,
  'a saved company without a reviewed channel is listed as unreachable'
);
select pg_temp.d2_assert(
  (select array_agg(name) from d2_rows where grp = 'recent') = array['D2 Storico S.p.A.'],
  'past RFQ suppliers are in recent'
);
select pg_temp.d2_assert(
  (select array_agg(name) from d2_rows where grp = 'contacts') = array['Mario Fornitore'],
  'private contacts are listed'
);
select pg_temp.d2_assert(
  (select array_agg(name) from d2_rows where grp = 'recommended') = array['D2 Tubi Produttore S.r.l.'],
  'only reachable, published companies of the bill families are recommended; saved ones are not repeated'
);
select pg_temp.d2_assert(
  (select reason from d2_rows where name = 'D2 Tubi Produttore S.r.l.') like '%Produttore%',
  'recommendation explains the role'
);
select pg_temp.d2_assert(
  (select count(*) from d2_rows where name = 'D2 Salvata Tubi S.r.l.') = 1,
  'a company appears in one group only'
);

-- Adding the recommended producer removes it from the picker.
insert into public.buyer_rfq_suppliers(id, rfq_id, owner_user_id, identity_key, identity_source, supplier_name,
  supplier_email_normalized, supplier_network_company_id)
values ('00000000-0000-0000-0000-0000000d2302', '00000000-0000-0000-0000-0000000d2202', '00000000-0000-0000-0000-0000000d2a01',
  'network_company:00000000-0000-0000-0000-0000000d2c01', 'network_company', 'D2 Tubi Produttore S.r.l.',
  'vendite@d2-tubi.example.test', '00000000-0000-0000-0000-0000000d2c01');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d2a01', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000d2a01","role":"authenticated"}', true);
insert into d2_result values ('after_add', public.distinta2_supplier_picker('00000000-0000-0000-0000-0000000d2202'));

-- Removal before sending works and is logged.
insert into d2_result values ('remove', public.distinta2_remove_supplier(
  '00000000-0000-0000-0000-0000000d2202', '00000000-0000-0000-0000-0000000d2302'));
reset role;

select pg_temp.d2_assert(
  not exists (
    select 1 from d2_result r, jsonb_array_elements(r.payload->'candidates') c
    where r.label = 'after_add' and c->>'company_name' = 'D2 Tubi Produttore S.r.l.'
  ),
  'suppliers already in the RFQ are not proposed again'
);
select pg_temp.d2_assert((select (payload->>'ok')::boolean from d2_result where label = 'remove'), 'remove ok');
select pg_temp.d2_assert(
  not exists (select 1 from public.buyer_rfq_suppliers where id = '00000000-0000-0000-0000-0000000d2302'),
  'supplier row deleted'
);
select pg_temp.d2_assert(
  exists (
    select 1 from public.buyer_rfq_events
    where rfq_id = '00000000-0000-0000-0000-0000000d2202' and event_type = 'supplier_removed'
      and metadata->>'removed_supplier_id' = '00000000-0000-0000-0000-0000000d2302'
  ),
  'removal is logged'
);

-- After launch nothing can be removed.
update public.buyer_rfq_campaigns set status = 'collecting', launched_at = now()
where id = '00000000-0000-0000-0000-0000000d2201';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d2a01', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000d2a01","role":"authenticated"}', true);
do $$
begin
  perform public.distinta2_remove_supplier('00000000-0000-0000-0000-0000000d2201', '00000000-0000-0000-0000-0000000d2301');
  raise exception 'DISTINTA2 assertion failed: removal after launch must be refused';
exception when sqlstate '55000' then null;
end;
$$;

-- Another tenant cannot read or change this RFQ.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d2b01', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000d2b01","role":"authenticated"}', true);
do $$
begin
  perform public.distinta2_supplier_picker('00000000-0000-0000-0000-0000000d2202');
  raise exception 'DISTINTA2 assertion failed: other tenant read the picker';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform public.distinta2_remove_supplier('00000000-0000-0000-0000-0000000d2202', '00000000-0000-0000-0000-0000000d2301');
  raise exception 'DISTINTA2 assertion failed: other tenant removed a supplier';
exception when insufficient_privilege then null;
end;
$$;
reset role;

-- Anonymous callers have no access.
select pg_temp.d2_assert(not has_function_privilege('anon', 'public.distinta2_supplier_picker(uuid)', 'execute'), 'anon cannot read');
select pg_temp.d2_assert(not has_function_privilege('anon', 'public.distinta2_remove_supplier(uuid,uuid)', 'execute'), 'anon cannot remove');

rollback;
