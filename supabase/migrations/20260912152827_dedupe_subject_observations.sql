create or replace function public.promote_worker_job(target_job_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  job public.worker_jobs%rowtype;
  target_dataset_id uuid;
  target_thread_id uuid;
  thread_subject text;
  thread_classification text;
  inserted_count integer := 0;
  review_count integer := 0;
begin
  select * into job
  from public.worker_jobs
  where id = target_job_id
  for update;

  if not found then
    raise exception 'Worker job % not found', target_job_id;
  end if;

  if job.owner_id is null then
    raise exception 'Worker job % has no owner_id', target_job_id;
  end if;

  if job.dataset_id is not null and job.thread_id is not null then
    return jsonb_build_object(
      'dataset_id', job.dataset_id,
      'thread_id', job.thread_id,
      'promoted_observation_count', job.promoted_observation_count,
      'review_count', (
        select count(*)
        from public.commercial_review_queue rq
        where rq.thread_id = job.thread_id and rq.owner_id = job.owner_id
      )
    );
  end if;

  select d.id into target_dataset_id
  from public.commercial_datasets d
  where d.owner_id = job.owner_id
    and d.status in ('active', 'ready')
  order by (d.status = 'active') desc, d.created_at desc
  limit 1;

  if target_dataset_id is null then
    raise exception 'No active/ready commercial dataset for owner %', job.owner_id;
  end if;

  select coalesce(
    (
      select regexp_replace(s.source_text, '^\[SUBJECT\]\s*', '', 'i')
      from public.worker_staging_observations s
      where s.job_id = target_job_id
        and s.source_text ~* '^\[SUBJECT\]'
      order by s.id
      limit 1
    ),
    job.filename
  ) into thread_subject;

  select case
    when bool_or(s.item_role = 'delivered') then 'delivery'
    when bool_or(s.item_role = 'ordered') then 'order'
    when bool_or(s.item_role = 'offered') then 'offer'
    else 'rfq'
  end into thread_classification
  from public.worker_staging_observations s
  where s.job_id = target_job_id;

  target_thread_id := target_job_id;

  insert into public.commercial_threads (
    id, owner_id, dataset_id, source_conversation_id, subject,
    classification, started_at, last_activity_at, email_count
  ) values (
    target_thread_id,
    job.owner_id,
    target_dataset_id,
    target_job_id,
    thread_subject,
    coalesce(thread_classification, 'rfq'),
    job.created_at,
    job.created_at,
    case when job.extension = '.eml' then 1 else 0 end
  )
  on conflict (owner_id, dataset_id, source_conversation_id)
  do update set
    subject = excluded.subject,
    classification = excluded.classification,
    last_activity_at = excluded.last_activity_at
  returning id into target_thread_id;

  with candidates as (
    select s.*
    from public.worker_staging_observations s
    where s.job_id = target_job_id
      and not (
        s.source_text ~* '^\[SUBJECT\]'
        and exists (
          select 1
          from public.worker_staging_observations b
          where b.job_id = s.job_id
            and b.source_text !~* '^\[SUBJECT\]'
            and coalesce(b.item_role, '') = coalesce(s.item_role, '')
            and (s.grade is null or b.grade = s.grade)
            and (s.standard is null or b.standard = s.standard)
            and (s.outer_diameter_mm is null or b.outer_diameter_mm = s.outer_diameter_mm)
            and (s.width_mm is null or b.width_mm = s.width_mm)
            and (s.height_mm is null or b.height_mm = s.height_mm)
            and (s.thickness_mm is null or b.thickness_mm = s.thickness_mm)
            and (s.length_mm is null or b.length_mm = s.length_mm)
            and (s.quantity is null or b.quantity = s.quantity)
            and (s.quantity_unit is null or b.quantity_unit = s.quantity_unit)
            and (s.price_value is null or b.price_value = s.price_value)
            and (s.price_unit is null or b.price_unit = s.price_unit)
            and (s.currency is null or b.currency = s.currency)
            and (s.availability_status is null or b.availability_status = s.availability_status)
        )
      )
  ), ranked as (
    select
      c.*,
      row_number() over (
        partition by
          coalesce(c.item_role, ''),
          coalesce(c.grade, ''),
          coalesce(c.standard, ''),
          coalesce(c.outer_diameter_mm, -1),
          coalesce(c.width_mm, -1),
          coalesce(c.height_mm, -1),
          coalesce(c.thickness_mm, -1),
          coalesce(c.length_mm, -1),
          coalesce(c.quantity, -1),
          coalesce(c.quantity_unit, ''),
          coalesce(c.price_value, -1),
          coalesce(c.price_unit, ''),
          coalesce(c.currency, '')
        order by (c.source_text !~* '^\[SUBJECT\]') desc, c.id
      ) as signature_rank
    from candidates c
  ), inserted as (
    insert into public.commercial_observations (
      owner_id, dataset_id, thread_id, source_extraction_id,
      source_conversation_id, item_role, role_method, direction,
      product_type, grade, standard, material_number,
      outer_diameter_mm, width_mm, height_mm, thickness_mm, length_mm,
      quantity, quantity_unit, price_value, price_unit, currency,
      discount_percentage, availability_status, source_filename,
      source_text, source_clause, confidence, flags, search_text
    )
    select
      job.owner_id,
      target_dataset_id,
      target_thread_id,
      r.id,
      target_job_id,
      coalesce(r.item_role, 'requested'),
      'worker_v31',
      null,
      case
        when r.outer_diameter_mm is not null then 'round_tube'
        when r.width_mm is not null and r.height_mm is not null and r.width_mm = r.height_mm then 'square_tube'
        when r.width_mm is not null and r.height_mm is not null then 'rectangular_tube'
        else null
      end,
      r.grade,
      r.standard,
      null,
      r.outer_diameter_mm,
      r.width_mm,
      r.height_mm,
      r.thickness_mm,
      r.length_mm,
      r.quantity,
      r.quantity_unit,
      r.price_value,
      r.price_unit,
      r.currency,
      null,
      r.availability_status,
      r.source_filename,
      r.source_text,
      r.source_text,
      r.confidence,
      case
        when jsonb_typeof(r.metadata -> 'flags') = 'array' then r.metadata -> 'flags'
        else '[]'::jsonb
      end,
      lower(concat_ws(' ',
        r.source_text, r.grade, r.standard,
        r.outer_diameter_mm::text, r.width_mm::text, r.height_mm::text,
        r.thickness_mm::text, r.length_mm::text,
        r.quantity::text, r.quantity_unit,
        r.price_value::text, r.price_unit, r.currency
      ))
    from ranked r
    where r.signature_rank = 1
    returning id
  )
  select count(*) into inserted_count from inserted;

  insert into public.commercial_review_queue (
    owner_id, dataset_id, thread_id, source_review_id,
    source_extraction_ordinal, reason, severity, source_text,
    status, observation_id
  )
  select
    o.owner_id,
    o.dataset_id,
    o.thread_id,
    o.id,
    null,
    'low_confidence_worker_extraction',
    'warning',
    o.source_text,
    'pending',
    o.id
  from public.commercial_observations o
  where o.thread_id = target_thread_id
    and o.owner_id = job.owner_id
    and coalesce(o.confidence, 0) < 0.90
  on conflict (owner_id, dataset_id, source_review_id) do nothing;

  get diagnostics review_count = row_count;

  update public.commercial_datasets
  set
    thread_count = thread_count + 1,
    email_count = email_count + case when job.extension = '.eml' then 1 else 0 end,
    message_count = message_count + case when job.extension = '.eml' then 1 else 0 end,
    extraction_count = extraction_count + inserted_count
  where id = target_dataset_id;

  update public.worker_jobs
  set
    dataset_id = target_dataset_id,
    thread_id = target_thread_id,
    promoted_observation_count = inserted_count
  where id = target_job_id;

  return jsonb_build_object(
    'dataset_id', target_dataset_id,
    'thread_id', target_thread_id,
    'promoted_observation_count', inserted_count,
    'review_count', review_count
  );
end;
$$;

revoke execute on function public.promote_worker_job(uuid) from public;
revoke execute on function public.promote_worker_job(uuid) from anon;
revoke execute on function public.promote_worker_job(uuid) from authenticated;
grant execute on function public.promote_worker_job(uuid) to service_role;
