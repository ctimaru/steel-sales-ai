-- PL1.4 — PDF -> Structured Price List Import Pipeline staging foundation

begin;

create table public.price_list_import_runs (
  id uuid primary key default gen_random_uuid(),
  price_list_version_id uuid not null references public.price_list_versions(id) on delete restrict,
  source_document_id uuid not null references public.knowledge_documents(id) on delete restrict,
  adapter_key text not null,
  parser_version text not null,
  filename text not null,
  content_checksum text not null,
  status text not null default 'queued'
    check (status in ('queued','extracting','staged','review_ready','promoted','failed')),
  page_count integer not null default 0 check (page_count >= 0),
  extracted_item_count integer not null default 0 check (extracted_item_count >= 0),
  extracted_rule_count integer not null default 0 check (extracted_rule_count >= 0),
  valid_item_count integer not null default 0 check (valid_item_count >= 0),
  review_item_count integer not null default 0 check (review_item_count >= 0),
  error_item_count integer not null default 0 check (error_item_count >= 0),
  anomaly_count integer not null default 0 check (anomaly_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  error_message text null,
  created_by uuid null,
  started_at timestamptz null,
  staged_at timestamptz null,
  review_ready_at timestamptz null,
  promoted_at timestamptz null,
  failed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (price_list_version_id, content_checksum, adapter_key, parser_version)
);

create table public.price_list_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.price_list_import_runs(id) on delete cascade,
  row_type text not null check (row_type in ('item','rule')),
  page_number integer not null check (page_number >= 1),
  source_row_index integer not null check (source_row_index >= 1),
  section_key text null,
  raw_text text not null,
  row_signature text not null,
  normalized_data jsonb not null,
  validation_status text not null
    check (validation_status in ('valid','review','error')),
  validation_codes text[] not null default '{}'::text[],
  source_locator jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (import_run_id, row_type, page_number, source_row_index),
  unique (import_run_id, row_signature)
);

create table public.price_list_import_anomalies (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.price_list_import_runs(id) on delete cascade,
  import_row_id uuid null references public.price_list_import_rows(id) on delete cascade,
  severity text not null check (severity in ('info','warning','review','error')),
  code text not null,
  message text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index price_list_import_runs_version_idx
  on public.price_list_import_runs(price_list_version_id, created_at desc);
create index price_list_import_runs_source_document_idx
  on public.price_list_import_runs(source_document_id, created_at desc);
create index price_list_import_runs_status_idx
  on public.price_list_import_runs(status, created_at desc);

create index price_list_import_rows_run_status_idx
  on public.price_list_import_rows(import_run_id, validation_status, page_number, source_row_index);
create index price_list_import_rows_section_idx
  on public.price_list_import_rows(import_run_id, section_key)
  where section_key is not null;

create index price_list_import_anomalies_run_idx
  on public.price_list_import_anomalies(import_run_id, severity, created_at);
create index price_list_import_anomalies_row_idx
  on public.price_list_import_anomalies(import_row_id)
  where import_row_id is not null;

create trigger price_list_import_runs_touch_updated_at
before update on public.price_list_import_runs
for each row execute function private.pl1_touch_updated_at();

create or replace function private.pl1_validate_import_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_primary_document_id uuid;
  v_version_status text;
  v_checksum text;
  v_algorithm text;
begin
  select v.primary_source_document_id, v.status
    into v_primary_document_id, v_version_status
  from public.price_list_versions v
  where v.id = new.price_list_version_id;

  if v_primary_document_id is null then
    raise exception 'PL1 import run requires an existing price-list version'
      using errcode = '23503';
  end if;

  if v_primary_document_id <> new.source_document_id then
    raise exception 'PL1 import source document must equal version primary source document'
      using errcode = '23514';
  end if;

  if v_version_status not in ('draft','review') then
    raise exception 'PL1 import runs are only allowed for draft/review versions'
      using errcode = '55000';
  end if;

  select d.content_checksum, lower(d.checksum_algorithm)
    into v_checksum, v_algorithm
  from public.knowledge_documents d
  where d.id = new.source_document_id;

  if v_algorithm is distinct from 'sha256'
     or v_checksum is null
     or v_checksum <> new.content_checksum then
    raise exception 'PL1 import checksum does not match the immutable SHA-256 source document'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'queued' then
      raise exception 'New PL1 import runs must start queued'
        using errcode = '23514';
    end if;
  else
    if old.price_list_version_id <> new.price_list_version_id
       or old.source_document_id <> new.source_document_id
       or old.adapter_key <> new.adapter_key
       or old.parser_version <> new.parser_version
       or old.filename <> new.filename
       or old.content_checksum <> new.content_checksum
       or old.created_by is distinct from new.created_by then
      raise exception 'PL1 import run identity is immutable'
        using errcode = '55000';
    end if;

    if old.status is distinct from new.status then
      if not (
        (old.status = 'queued' and new.status in ('extracting','failed'))
        or (old.status = 'extracting' and new.status in ('staged','failed'))
        or (old.status = 'staged' and new.status in ('review_ready','failed'))
        or (old.status = 'review_ready' and new.status = 'promoted')
      ) then
        raise exception 'Invalid PL1 import transition: % -> %', old.status, new.status
          using errcode = '23514';
      end if;
    end if;
  end if;

  if new.status = 'extracting' then
    new.started_at := coalesce(new.started_at, now());
  elsif new.status = 'staged' then
    new.staged_at := coalesce(new.staged_at, now());
  elsif new.status = 'review_ready' then
    new.review_ready_at := coalesce(new.review_ready_at, now());
  elsif new.status = 'promoted' then
    new.promoted_at := coalesce(new.promoted_at, now());
  elsif new.status = 'failed' then
    new.failed_at := coalesce(new.failed_at, now());
    if coalesce(btrim(new.error_message),'') = '' then
      raise exception 'Failed PL1 import run requires error_message'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.pl1_validate_import_run() from public, anon, authenticated;

create trigger price_list_import_runs_validate
before insert or update on public.price_list_import_runs
for each row execute function private.pl1_validate_import_run();

create or replace function private.pl1_guard_import_staging()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_run_id := old.import_run_id;
  else
    v_run_id := new.import_run_id;
  end if;

  select status into v_status
  from public.price_list_import_runs
  where id = v_run_id;

  if v_status not in ('extracting','staged') then
    raise exception 'PL1 import staging is immutable in run status %', coalesce(v_status,'missing')
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.pl1_guard_import_staging() from public, anon, authenticated;

create trigger price_list_import_rows_guard
before insert or update or delete on public.price_list_import_rows
for each row execute function private.pl1_guard_import_staging();

create trigger price_list_import_anomalies_guard
before insert or update or delete on public.price_list_import_anomalies
for each row execute function private.pl1_guard_import_staging();

alter table public.price_list_import_runs enable row level security;
alter table public.price_list_import_rows enable row level security;
alter table public.price_list_import_anomalies enable row level security;

create policy price_list_import_runs_admin_read
on public.price_list_import_runs for select to authenticated
using (
  public.has_platform_permission('knowledge.read_drafts')
  or public.has_platform_permission('knowledge.review')
  or public.has_platform_permission('knowledge.publish')
);

create policy price_list_import_rows_admin_read
on public.price_list_import_rows for select to authenticated
using (
  exists (
    select 1
    from public.price_list_import_runs r
    where r.id = price_list_import_rows.import_run_id
      and (
        public.has_platform_permission('knowledge.read_drafts')
        or public.has_platform_permission('knowledge.review')
        or public.has_platform_permission('knowledge.publish')
      )
  )
);

create policy price_list_import_anomalies_admin_read
on public.price_list_import_anomalies for select to authenticated
using (
  exists (
    select 1
    from public.price_list_import_runs r
    where r.id = price_list_import_anomalies.import_run_id
      and (
        public.has_platform_permission('knowledge.read_drafts')
        or public.has_platform_permission('knowledge.review')
        or public.has_platform_permission('knowledge.publish')
      )
  )
);

revoke all on table
  public.price_list_import_runs,
  public.price_list_import_rows,
  public.price_list_import_anomalies
from anon, authenticated;

grant select on table
  public.price_list_import_runs,
  public.price_list_import_rows,
  public.price_list_import_anomalies
to authenticated;

grant select, insert, update, delete on table
  public.price_list_import_runs,
  public.price_list_import_rows,
  public.price_list_import_anomalies
to service_role;

comment on table public.price_list_import_runs is
  'PL1.4 governed PDF extraction/staging runs. No source rows are published directly from this layer.';
comment on table public.price_list_import_rows is
  'PL1.4 immutable-at-review structured staging rows with row-level PDF provenance and validation codes.';
comment on table public.price_list_import_anomalies is
  'PL1.4 import diagnostics and review findings.';

commit;
