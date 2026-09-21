-- P1.4 global structured search acceptance. Disposable CI database only.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000014a1'::uuid, 'search-a@p1-test.example'),
  ('00000000-0000-0000-0000-0000000014b1'::uuid, 'search-b@p1-test.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status)
values
  ('00000000-0000-0000-0000-0000000014f1', 'Search Tenant A', 'search-tenant-a', '00000000-0000-0000-0000-0000000014a1', 'completed'),
  ('00000000-0000-0000-0000-0000000014f2', 'Search Tenant B', 'search-tenant-b', '00000000-0000-0000-0000-0000000014b1', 'completed');

insert into public.organization_memberships (organization_id, user_id, role, status, is_default)
values
  ('00000000-0000-0000-0000-0000000014f1', '00000000-0000-0000-0000-0000000014a1', 'admin', 'active', true),
  ('00000000-0000-0000-0000-0000000014f2', '00000000-0000-0000-0000-0000000014b1', 'admin', 'active', true);

insert into public.commercial_datasets (id, owner_id, source_run_id, source_filename, organization_id)
values
  ('00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-0000000014a1', '00000000-0000-0000-0000-000000001411', 'tenant-a.eml', '00000000-0000-0000-0000-0000000014f1'),
  ('00000000-0000-0000-0000-000000001402', '00000000-0000-0000-0000-0000000014b1', '00000000-0000-0000-0000-000000001412', 'tenant-b.eml', '00000000-0000-0000-0000-0000000014f2');

insert into public.commercial_threads (
  id, owner_id, dataset_id, source_conversation_id, subject, classification, last_activity_at, organization_id
) values
  ('00000000-0000-0000-0000-000000001421', '00000000-0000-0000-0000-0000000014a1', '00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-000000001431', 'Offerta P265GH 406,4', 'offer', '2026-09-10T10:00:00Z', '00000000-0000-0000-0000-0000000014f1'),
  ('00000000-0000-0000-0000-000000001422', '00000000-0000-0000-0000-0000000014a1', '00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-000000001432', 'Richiesta S355J2H', 'rfq', '2026-09-11T10:00:00Z', '00000000-0000-0000-0000-0000000014f1'),
  ('00000000-0000-0000-0000-000000001423', '00000000-0000-0000-0000-0000000014b1', '00000000-0000-0000-0000-000000001402', '00000000-0000-0000-0000-000000001433', 'Other tenant P265GH', 'offer', '2026-09-12T10:00:00Z', '00000000-0000-0000-0000-0000000014f2');

insert into public.commercial_observations (
  id, owner_id, dataset_id, thread_id, source_conversation_id, item_role, direction,
  product_type, grade, standard, outer_diameter_mm, width_mm, height_mm, thickness_mm,
  length_mm, price_value, price_unit, currency, source_filename, source_text, confidence,
  search_text, organization_id
) values
  (14001, '00000000-0000-0000-0000-0000000014a1', '00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-000000001421', '00000000-0000-0000-0000-000000001431', 'offered', 'outbound', 'round_tube', 'P265GH', 'EN 10224', 406.4, null, null, 6.3, 12000, 68.38, 'M', 'EUR', 'offer-p265gh.eml', 'P265GH 406,4 x 6,3 prezzo 68,38 EUR/mt', 0.98, 'p265gh 406.4x6.3 en10224 68.38 eur', '00000000-0000-0000-0000-0000000014f1'),
  (14002, '00000000-0000-0000-0000-0000000014a1', '00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-000000001422', '00000000-0000-0000-0000-000000001432', 'requested', 'inbound', 'square_tube', 'S355J2H', 'EN 10219', null, 80, 80, 8, 12000, null, null, null, 'rfq-s355.eml', 'Richiesta tubolare 80x80x8 S355J2H', 0.96, 's355j2h en10219 80x80x8 richiesta', '00000000-0000-0000-0000-0000000014f1'),
  (14003, '00000000-0000-0000-0000-0000000014b1', '00000000-0000-0000-0000-000000001402', '00000000-0000-0000-0000-000000001423', '00000000-0000-0000-0000-000000001433', 'offered', 'outbound', 'round_tube', 'P265GH', 'EN 10224', 406.4, null, null, 6.3, 12000, 40.00, 'M', 'EUR', 'other-tenant.eml', 'Other tenant P265GH', 0.99, 'p265gh 406.4x6.3 en10224', '00000000-0000-0000-0000-0000000014f2');

insert into public.companies (id, owner_id, name, company_type, country, organization_id)
values
  ('00000000-0000-0000-0000-000000001441', '00000000-0000-0000-0000-0000000014a1', 'Acciai Test SRL', 'customer', 'IT', '00000000-0000-0000-0000-0000000014f1'),
  ('00000000-0000-0000-0000-000000001442', '00000000-0000-0000-0000-0000000014b1', 'Other Company', 'customer', 'IT', '00000000-0000-0000-0000-0000000014f2');

create or replace function pg_temp.p14_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'P1.4 assertion failed: %', message; end if;
end;
$$;

select pg_temp.p14_assert(
  not has_function_privilege('authenticated', 'public.p1_global_structured_search(uuid,text,text[],jsonb,integer)', 'EXECUTE'),
  'browser authenticated role must not call global structured search directly'
);
select pg_temp.p14_assert(
  has_function_privilege('service_role', 'public.p1_global_structured_search(uuid,text,text[],jsonb,integer)', 'EXECUTE'),
  'service role must execute global structured search'
);

select pg_temp.p14_assert(
  (public.p1_global_structured_search('00000000-0000-0000-0000-0000000014f1', 'P265GH', array['offer','product'], '{}'::jsonb, 50)->>'total')::int = 2,
  'tenant A P265GH must return one offer and one product without leaking tenant B'
);
select pg_temp.p14_assert(
  (public.p1_global_structured_search('00000000-0000-0000-0000-0000000014f1', 'P265GH', array['offer'], '{"price_min":60,"price_max":70,"currency":"EUR"}'::jsonb, 50)->>'total')::int = 1,
  'price and currency filters must isolate the matching offer'
);
select pg_temp.p14_assert(
  (public.p1_global_structured_search('00000000-0000-0000-0000-0000000014f1', 'S355J2H', array['rfq'], '{"width_mm":80,"height_mm":80,"thickness_mm":8}'::jsonb, 50)->>'total')::int = 1,
  'steel geometry filters must match the RFQ observation'
);

select pg_temp.p14_assert(
  (public.p1_global_structured_search('00000000-0000-0000-0000-0000000014f1', 'S355J2H 80x80x8', array['rfq'], '{}'::jsonb, 50)->>'total')::int = 1,
  'multi-term query must match all tokens within the same RFQ observation regardless of token order'
);
select pg_temp.p14_assert(
  (public.p1_global_structured_search('00000000-0000-0000-0000-0000000014f1', 'Acciai', array['company'], '{}'::jsonb, 50)->>'total')::int = 1,
  'normalized company rows must participate in Global Search when available'
);
select pg_temp.p14_assert(
  (public.p1_global_structured_search('00000000-0000-0000-0000-0000000014f2', 'P265GH', array['offer'], '{}'::jsonb, 50)->>'total')::int = 1,
  'tenant B must see only its own matching offer'
);

-- P1.4 extends the existing hybrid wrapper without exposing it to browser roles.
select pg_temp.p14_assert(
  not has_function_privilege('authenticated', 'public.hybrid_search_knowledge_filtered(uuid,text,real[],integer,integer,jsonb,jsonb,jsonb,integer)', 'EXECUTE'),
  'hybrid filtered RPC must remain internal'
);

rollback;
