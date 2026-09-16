-- P1.2 — Bulk import orchestration: persistent batches, per-file progress,
-- selective retry bookkeeping and tenant-safe read access.

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  owner_id uuid references auth.users(id) on delete set null,
  source text not null default 'manual_bulk' check (source in ('manual_bulk', 'mailbox', 'api')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'partial', 'failed')),
  total_items integer not null default 0 check (total_items >= 0),
  queued_items integer not null default 0 check (queued_items >= 0),
  processing_items integer not null default 0 check (processing_items >= 0),
  completed_items integer not null default 0 check (completed_items >= 0),
  failed_items integer not null default 0 check (failed_items >= 0),
  deduplicated_items integer not null default 0 check (deduplicated_items >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint import_batches_owner_requires_organization check (owner_id is null or organization_id is not null)
);

create table if not exists public.import_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  owner_id uuid references auth.users(id) on delete set null,
  ordinal integer not null check (ordinal > 0),
  filename text not null,
  extension text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  content_checksum text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  worker_job_id uuid references public.worker_jobs(id) on delete set null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  storage_path text,
  deduplicated boolean not null default false,
  deduplicated_from_item_id uuid references public.import_batch_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint import_batch_items_owner_requires_organization check (owner_id is null or organization_id is not null),
  constraint import_batch_items_batch_ordinal_uq unique (batch_id, ordinal),
  constraint import_batch_items_batch_checksum_uq unique (batch_id, content_checksum)
);

create index if not exists import_batches_organization_created_idx
  on public.import_batches (organization_id, created_at desc);
create index if not exists import_batches_owner_created_idx
  on public.import_batches (owner_id, created_at desc);
create index if not exists import_batch_items_batch_ordinal_idx
  on public.import_batch_items (batch_id, ordinal);
create index if not exists import_batch_items_organization_checksum_idx
  on public.import_batch_items (organization_id, content_checksum, status, completed_at desc);
create index if not exists import_batch_items_worker_job_idx
  on public.import_batch_items (worker_job_id);
create index if not exists import_batch_items_deduplicated_from_idx
  on public.import_batch_items (deduplicated_from_item_id);

alter table public.worker_jobs
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null,
  add column if not exists import_batch_item_id uuid references public.import_batch_items(id) on delete set null,
  add column if not exists attempt_number integer not null default 1 check (attempt_number >= 1),
  add column if not exists content_checksum text;

create index if not exists worker_jobs_import_batch_id_idx
  on public.worker_jobs (import_batch_id);
create index if not exists worker_jobs_import_batch_item_id_idx
  on public.worker_jobs (import_batch_item_id);
create index if not exists worker_jobs_organization_checksum_idx
  on public.worker_jobs (organization_id, content_checksum, created_at desc);

-- Keep tenant identity aligned with the existing P0.2 owner->organization contract.
drop trigger if exists assign_organization_from_owner on public.import_batches;
create trigger assign_organization_from_owner
before insert or update of owner_id, organization_id on public.import_batches
for each row execute function public.assign_organization_from_owner();

drop trigger if exists assign_organization_from_owner on public.import_batch_items;
create trigger assign_organization_from_owner
before insert or update of owner_id, organization_id on public.import_batch_items
for each row execute function public.assign_organization_from_owner();

-- Each item must belong to the same tenant and owner context as its batch.
create or replace function private.validate_import_batch_item_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  batch_row record;
begin
  select b.organization_id, b.owner_id
  into batch_row
  from public.import_batches b
  where b.id = new.batch_id;

  if not found then
    raise exception 'Import batch not found';
  end if;

  if new.organization_id <> batch_row.organization_id then
    raise exception 'Import batch item organization does not match batch';
  end if;

  if batch_row.owner_id is not null and new.owner_id is distinct from batch_row.owner_id then
    raise exception 'Import batch item owner does not match batch';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_import_batch_item_scope() from public, anon, authenticated;
grant execute on function private.validate_import_batch_item_scope() to service_role;

drop trigger if exists validate_import_batch_item_scope on public.import_batch_items;
create trigger validate_import_batch_item_scope
before insert or update of batch_id, organization_id, owner_id on public.import_batch_items
for each row execute function private.validate_import_batch_item_scope();

-- Recompute aggregate progress transactionally whenever an item changes.
create or replace function private.refresh_import_batch_progress()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_batch_id uuid := coalesce(new.batch_id, old.batch_id);
  total_count integer;
  queued_count integer;
  processing_count integer;
  completed_count integer;
  failed_count integer;
  dedup_count integer;
  next_status text;
begin
  select
    count(*)::integer,
    count(*) filter (where i.status = 'queued')::integer,
    count(*) filter (where i.status = 'processing')::integer,
    count(*) filter (where i.status = 'completed')::integer,
    count(*) filter (where i.status = 'failed')::integer,
    count(*) filter (where i.deduplicated)::integer
  into total_count, queued_count, processing_count, completed_count, failed_count, dedup_count
  from public.import_batch_items i
  where i.batch_id = target_batch_id;

  next_status := case
    when total_count = 0 then 'queued'
    when completed_count = total_count then 'completed'
    when failed_count = total_count then 'failed'
    when queued_count = 0 and processing_count = 0 and failed_count > 0 and completed_count > 0 then 'partial'
    when processing_count > 0 or completed_count > 0 or failed_count > 0 then 'processing'
    else 'queued'
  end;

  update public.import_batches
  set
    total_items = total_count,
    queued_items = queued_count,
    processing_items = processing_count,
    completed_items = completed_count,
    failed_items = failed_count,
    deduplicated_items = dedup_count,
    status = next_status,
    started_at = case
      when next_status <> 'queued' then coalesce(started_at, now())
      else started_at
    end,
    completed_at = case
      when next_status in ('completed', 'partial', 'failed') then coalesce(completed_at, now())
      else null
    end,
    updated_at = now()
  where id = target_batch_id;

  return coalesce(new, old);
end;
$$;

revoke execute on function private.refresh_import_batch_progress() from public, anon, authenticated;
grant execute on function private.refresh_import_batch_progress() to service_role;

drop trigger if exists refresh_import_batch_progress on public.import_batch_items;
create trigger refresh_import_batch_progress
after insert or update of status, deduplicated or delete on public.import_batch_items
for each row execute function private.refresh_import_batch_progress();

alter table public.import_batches enable row level security;
alter table public.import_batch_items enable row level security;

revoke all on public.import_batches from anon, authenticated;
revoke all on public.import_batch_items from anon, authenticated;
grant select on public.import_batches to authenticated;
grant select on public.import_batch_items to authenticated;
grant all on public.import_batches to service_role;
grant all on public.import_batch_items to service_role;

drop policy if exists import_batches_organization_select on public.import_batches;
create policy import_batches_organization_select
on public.import_batches
for select
to authenticated
using (public.is_organization_member(organization_id, false));

drop policy if exists import_batch_items_organization_select on public.import_batch_items;
create policy import_batch_items_organization_select
on public.import_batch_items
for select
to authenticated
using (public.is_organization_member(organization_id, false));

comment on table public.import_batches is 'P1.2 tenant-scoped bulk import batch progress.';
comment on table public.import_batch_items is 'P1.2 per-file import state, retry bookkeeping and deduplication provenance.';
