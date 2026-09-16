-- P1.3 data source center acceptance. Disposable CI database only; everything rolls back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000013a1'::uuid, 'sources-owner@p1-test.example'),
  ('00000000-0000-0000-0000-0000000013b1'::uuid, 'sources-other@p1-test.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status)
values
  ('00000000-0000-0000-0000-0000000013f1', 'Sources Tenant A', 'sources-tenant-a', '00000000-0000-0000-0000-0000000013a1', 'completed'),
  ('00000000-0000-0000-0000-0000000013f2', 'Sources Tenant B', 'sources-tenant-b', '00000000-0000-0000-0000-0000000013b1', 'completed');

insert into public.organization_memberships (organization_id, user_id, role, status, is_default)
values
  ('00000000-0000-0000-0000-0000000013f1', '00000000-0000-0000-0000-0000000013a1', 'admin', 'active', true),
  ('00000000-0000-0000-0000-0000000013f2', '00000000-0000-0000-0000-0000000013b1', 'admin', 'active', true);

create or replace function pg_temp.p13_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'P1.3 assertion failed: %', message; end if;
end;
$$;

insert into public.knowledge_sources (
  id, owner_id, organization_id, access_scope, source_key, source_type, source_class, name
) values
  ('00000000-0000-0000-0000-0000000013c1', '00000000-0000-0000-0000-0000000013a1', '00000000-0000-0000-0000-0000000013f1', 'owner', 'p13-archive-a', 'commercial_archive', 'internal', 'Archivio A'),
  ('00000000-0000-0000-0000-0000000013c2', '00000000-0000-0000-0000-0000000013b1', '00000000-0000-0000-0000-0000000013f2', 'owner', 'p13-archive-b', 'commercial_archive', 'internal', 'Archivio B');

insert into public.knowledge_documents (
  id, source_id, document_type, title, filename, content_checksum, status, extracted_at
) values
  ('00000000-0000-0000-0000-0000000013d1', '00000000-0000-0000-0000-0000000013c1', 'email', 'Legacy offer A', 'legacy-offer-a.eml', repeat('a', 64), 'ready', now()),
  ('00000000-0000-0000-0000-0000000013d2', '00000000-0000-0000-0000-0000000013c2', 'email', 'Other tenant offer', 'other-tenant.eml', repeat('b', 64), 'ready', now());

insert into public.import_batches (id, organization_id, owner_id, source)
values ('00000000-0000-0000-0000-0000000013e1', '00000000-0000-0000-0000-0000000013f1', '00000000-0000-0000-0000-0000000013a1', 'manual_bulk');

insert into public.import_batch_items (
  id, batch_id, organization_id, owner_id, ordinal, filename, extension, size_bytes,
  content_checksum, status, deduplicated, last_error, completed_at
) values
  ('00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-0000000013e1', '00000000-0000-0000-0000-0000000013f1', '00000000-0000-0000-0000-0000000013a1', 1, 'duplicate.pdf', '.pdf', 120, repeat('c', 64), 'completed', true, null, now()),
  ('00000000-0000-0000-0000-000000001302', '00000000-0000-0000-0000-0000000013e1', '00000000-0000-0000-0000-0000000013f1', '00000000-0000-0000-0000-0000000013a1', 2, 'broken.xlsx', '.xlsx', 220, repeat('d', 64), 'failed', false, 'synthetic import failure', now());

insert into public.worker_jobs (
  id, owner_id, organization_id, filename, extension, size_bytes, status, attempt_number, completed_at
) values (
  '00000000-0000-0000-0000-000000001303',
  '00000000-0000-0000-0000-0000000013a1',
  '00000000-0000-0000-0000-0000000013f1',
  'legacy-empty.eml', '.eml', 80, 'completed', 1, now()
);

select pg_temp.p13_assert(
  not has_function_privilege('authenticated', 'public.p1_data_source_center(uuid,text,text,text,integer,integer)', 'EXECUTE'),
  'browser authenticated role must not call the service-role aggregation directly'
);
select pg_temp.p13_assert(
  has_function_privilege('service_role', 'public.p1_data_source_center(uuid,text,text,text,integer,integer)', 'EXECUTE'),
  'trusted worker service role must be able to call the aggregation'
);

select pg_temp.p13_assert(
  (public.p1_data_source_center('00000000-0000-0000-0000-0000000013f1', null, null, null, 50, 0)->'summary'->>'total')::integer = 4,
  'tenant A history must merge batch items, legacy documents and legacy documentless jobs'
);
select pg_temp.p13_assert(
  (public.p1_data_source_center('00000000-0000-0000-0000-0000000013f1', null, null, null, 50, 0)->'summary'->>'duplicates')::integer = 1,
  'deduplicated batch item must be counted as duplicate'
);
select pg_temp.p13_assert(
  (public.p1_data_source_center('00000000-0000-0000-0000-0000000013f1', null, null, null, 50, 0)->'summary'->>'errors')::integer = 1,
  'failed batch item must be counted as error'
);
select pg_temp.p13_assert(
  (public.p1_data_source_center('00000000-0000-0000-0000-0000000013f1', null, null, null, 50, 0)->'summary'->>'discarded')::integer = 1,
  'completed legacy job without a knowledge document must be surfaced as discarded'
);
select pg_temp.p13_assert(
  (public.p1_data_source_center('00000000-0000-0000-0000-0000000013f1', null, 'duplicate', null, 50, 0)->>'total_filtered')::integer = 1,
  'state filter must isolate duplicates'
);
select pg_temp.p13_assert(
  (public.p1_data_source_center('00000000-0000-0000-0000-0000000013f1', 'legacy-offer-a', null, null, 50, 0)->>'total_filtered')::integer = 1,
  'search must cover historical knowledge documents'
);
select pg_temp.p13_assert(
  (public.p1_data_source_center('00000000-0000-0000-0000-0000000013f2', null, null, null, 50, 0)->'summary'->>'total')::integer = 1,
  'organization filter must prevent cross-tenant history leakage'
);

rollback;
