-- P1.2 bulk import acceptance. Disposable CI database only; everything rolls back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000012a1'::uuid, 'bulk-owner@p1-test.example'),
  ('00000000-0000-0000-0000-0000000012b1'::uuid, 'bulk-other@p1-test.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status)
values
  ('00000000-0000-0000-0000-0000000012f1', 'Bulk Tenant A', 'bulk-tenant-a', '00000000-0000-0000-0000-0000000012a1', 'completed'),
  ('00000000-0000-0000-0000-0000000012f2', 'Bulk Tenant B', 'bulk-tenant-b', '00000000-0000-0000-0000-0000000012b1', 'completed');

insert into public.organization_memberships (organization_id, user_id, role, status, is_default)
values
  ('00000000-0000-0000-0000-0000000012f1', '00000000-0000-0000-0000-0000000012a1', 'admin', 'active', true),
  ('00000000-0000-0000-0000-0000000012f2', '00000000-0000-0000-0000-0000000012b1', 'admin', 'active', true);

create or replace function pg_temp.p12_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'P1.2 assertion failed: %', message; end if;
end;
$$;

create or replace function pg_temp.p12_assert_raises(statement text, expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm) = 0 then
      raise exception 'P1.2 expected "%", got "%"', expected_fragment, sqlerrm;
    end if;
    return;
  end;
  raise exception 'P1.2 statement unexpectedly succeeded: %', statement;
end;
$$;

insert into public.import_batches (id, organization_id, owner_id, source)
values ('00000000-0000-0000-0000-0000000012d1', '00000000-0000-0000-0000-0000000012f1', '00000000-0000-0000-0000-0000000012a1', 'manual_bulk');

insert into public.import_batch_items (
  id, batch_id, organization_id, owner_id, ordinal, filename, extension,
  size_bytes, content_checksum, storage_path
) values
  ('00000000-0000-0000-0000-0000000012e1', '00000000-0000-0000-0000-0000000012d1', '00000000-0000-0000-0000-0000000012f1', '00000000-0000-0000-0000-0000000012a1', 1, 'offer.eml', '.eml', 100, repeat('a',64), 'organizations/test/offer.eml'),
  ('00000000-0000-0000-0000-0000000012e2', '00000000-0000-0000-0000-0000000012d1', '00000000-0000-0000-0000-0000000012f1', '00000000-0000-0000-0000-0000000012a1', 2, 'price.xlsx', '.xlsx', 200, repeat('b',64), 'organizations/test/price.xlsx');

select pg_temp.p12_assert(
  exists (select 1 from public.import_batches where id='00000000-0000-0000-0000-0000000012d1' and total_items=2 and queued_items=2 and status='queued'),
  'inserted items must aggregate into queued batch progress'
);

update public.import_batch_items set status='processing', attempt_count=1 where id='00000000-0000-0000-0000-0000000012e1';
select pg_temp.p12_assert(
  exists (select 1 from public.import_batches where id='00000000-0000-0000-0000-0000000012d1' and processing_items=1 and queued_items=1 and status='processing'),
  'processing item must update aggregate progress'
);

update public.import_batch_items set status='completed', completed_at=now() where id='00000000-0000-0000-0000-0000000012e1';
update public.import_batch_items set status='failed', last_error='synthetic failure', completed_at=now() where id='00000000-0000-0000-0000-0000000012e2';
select pg_temp.p12_assert(
  exists (select 1 from public.import_batches where id='00000000-0000-0000-0000-0000000012d1' and completed_items=1 and failed_items=1 and status='partial'),
  'mixed terminal items must yield partial batch status'
);

update public.import_batch_items set status='queued', last_error=null, completed_at=null where id='00000000-0000-0000-0000-0000000012e2';
select pg_temp.p12_assert(
  exists (select 1 from public.import_batches where id='00000000-0000-0000-0000-0000000012d1' and completed_items=1 and queued_items=1 and failed_items=0 and status='processing'),
  'retry reset must return failed item to queued while preserving completed item'
);

select pg_temp.p12_assert_raises(
  $$insert into public.import_batch_items (batch_id, organization_id, owner_id, ordinal, filename, extension, size_bytes, content_checksum) values ('00000000-0000-0000-0000-0000000012d1','00000000-0000-0000-0000-0000000012f2','00000000-0000-0000-0000-0000000012b1',3,'cross.pdf','.pdf',12,repeat('c',64))$$,
  'organization does not match batch'
);

select pg_temp.p12_assert(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='worker_jobs' and column_name='import_batch_id')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='worker_jobs' and column_name='import_batch_item_id')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='worker_jobs' and column_name='content_checksum'),
  'worker_jobs must expose batch linkage and checksum columns'
);

-- Tenant A can read its own progress but not Tenant B.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000012a1',true);
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.p12_assert((select count(*)=1 from public.import_batches), 'tenant member must read own batch');
select pg_temp.p12_assert((select count(*)=2 from public.import_batch_items), 'tenant member must read own batch items');
select pg_temp.p12_assert_raises(
  $$insert into public.import_batches (organization_id, owner_id) values ('00000000-0000-0000-0000-0000000012f1','00000000-0000-0000-0000-0000000012a1')$$,
  'permission denied'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000012b1',true);
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.p12_assert((select count(*)=0 from public.import_batches), 'unrelated tenant must not see another batch');
select pg_temp.p12_assert((select count(*)=0 from public.import_batch_items), 'unrelated tenant must not see another batch item');

reset role;
rollback;
