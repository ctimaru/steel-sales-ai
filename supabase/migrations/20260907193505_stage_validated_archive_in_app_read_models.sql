alter table public.commercial_datasets alter column owner_id drop not null;
alter table public.commercial_threads alter column owner_id drop not null;
alter table public.commercial_observations alter column owner_id drop not null;
alter table public.commercial_review_queue alter column owner_id drop not null;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.assign_commercial_dataset_owner(target_source_run_id uuid, target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  target_dataset_id uuid;
  dataset_rows integer;
  thread_rows integer;
  observation_rows integer;
  review_rows integer;
begin
  if target_user_id is null or not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'target user does not exist';
  end if;

  select id into target_dataset_id
  from public.commercial_datasets
  where source_run_id = target_source_run_id and owner_id is null
  limit 1
  for update;

  if target_dataset_id is null then
    raise exception 'no unowned dataset found for source run %', target_source_run_id;
  end if;

  update public.commercial_datasets set owner_id = target_user_id where id = target_dataset_id and owner_id is null;
  get diagnostics dataset_rows = row_count;
  update public.commercial_threads set owner_id = target_user_id where dataset_id = target_dataset_id and owner_id is null;
  get diagnostics thread_rows = row_count;
  update public.commercial_observations set owner_id = target_user_id where dataset_id = target_dataset_id and owner_id is null;
  get diagnostics observation_rows = row_count;
  update public.commercial_review_queue set owner_id = target_user_id where dataset_id = target_dataset_id and owner_id is null;
  get diagnostics review_rows = row_count;

  return jsonb_build_object('dataset_id',target_dataset_id,'datasets',dataset_rows,'threads',thread_rows,'observations',observation_rows,'review_items',review_rows);
end;
$$;
revoke all on function private.assign_commercial_dataset_owner(uuid,uuid) from public, anon, authenticated;
grant execute on function private.assign_commercial_dataset_owner(uuid,uuid) to service_role;

insert into public.commercial_datasets (
  id, owner_id, source_run_id, source_filename, parser_version,
  email_count, thread_count, message_count, extraction_count, status
)
select r.id, null, r.id, r.source_filename, r.parser_version,
       r.email_count, r.thread_count, r.message_count, r.extraction_count, 'ready'
from staging.archive_runs r
where r.id='6b8c075e-7727-4b45-b5dd-7dc808ddbaf7' and r.status='validated'
on conflict (id) do update set
  source_filename=excluded.source_filename,
  parser_version=excluded.parser_version,
  email_count=excluded.email_count,
  thread_count=excluded.thread_count,
  message_count=excluded.message_count,
  extraction_count=excluded.extraction_count,
  status=excluded.status;

insert into public.commercial_threads (
  id, owner_id, dataset_id, source_conversation_id, subject, classification,
  started_at, last_activity_at, email_count
)
select t.conversation_id, null, t.run_id, t.conversation_id, t.subject, t.classification,
       t.started_at, t.last_activity_at, t.email_count
from staging.archive_threads t
where t.run_id='6b8c075e-7727-4b45-b5dd-7dc808ddbaf7'
on conflict (id) do update set
  subject=excluded.subject,
  classification=excluded.classification,
  started_at=excluded.started_at,
  last_activity_at=excluded.last_activity_at,
  email_count=excluded.email_count;

insert into public.commercial_observations (
  id, owner_id, dataset_id, thread_id, source_extraction_id, source_conversation_id,
  item_role, role_method, direction, product_type, grade, standard, material_number,
  outer_diameter_mm, width_mm, height_mm, thickness_mm, length_mm,
  quantity, quantity_unit, price_value, price_unit, currency, discount_percentage,
  availability_status, source_filename, source_text, source_clause, confidence, flags
)
select e.id, null, e.run_id, e.conversation_id, e.id, e.conversation_id,
       e.item_role, e.role_method, e.direction, e.product_type, e.grade, e.standard, e.material_number,
       e.outer_diameter_mm, e.width_mm, e.height_mm, e.thickness_mm, e.length_mm,
       e.quantity, e.quantity_unit, e.price_value, e.price_unit, e.currency, e.discount_percentage,
       e.availability_status, e.source_filename, e.source_text, e.source_clause, e.confidence, coalesce(e.flags,'[]'::jsonb)
from staging.archive_extractions e
where e.run_id='6b8c075e-7727-4b45-b5dd-7dc808ddbaf7'
on conflict (id) do update set
  item_role=excluded.item_role,
  role_method=excluded.role_method,
  direction=excluded.direction,
  product_type=excluded.product_type,
  grade=excluded.grade,
  standard=excluded.standard,
  material_number=excluded.material_number,
  outer_diameter_mm=excluded.outer_diameter_mm,
  width_mm=excluded.width_mm,
  height_mm=excluded.height_mm,
  thickness_mm=excluded.thickness_mm,
  length_mm=excluded.length_mm,
  quantity=excluded.quantity,
  quantity_unit=excluded.quantity_unit,
  price_value=excluded.price_value,
  price_unit=excluded.price_unit,
  currency=excluded.currency,
  discount_percentage=excluded.discount_percentage,
  availability_status=excluded.availability_status,
  source_filename=excluded.source_filename,
  source_text=excluded.source_text,
  source_clause=excluded.source_clause,
  confidence=excluded.confidence,
  flags=excluded.flags;

insert into public.commercial_review_queue (
  id, owner_id, dataset_id, thread_id, source_review_id, source_extraction_ordinal,
  reason, severity, source_text, status, observation_id
)
select f.id, null, f.run_id, f.conversation_id, f.id, f.extraction_ordinal,
       f.reason, f.severity, f.source_text, 'pending', o.id
from staging.archive_review_flags f
left join public.commercial_observations o
  on o.dataset_id=f.run_id and o.thread_id=f.conversation_id and o.source_text=f.source_text
where f.run_id='6b8c075e-7727-4b45-b5dd-7dc808ddbaf7'
on conflict (id) do update set
  source_extraction_ordinal=excluded.source_extraction_ordinal,
  reason=excluded.reason,
  severity=excluded.severity,
  source_text=excluded.source_text,
  observation_id=excluded.observation_id;
