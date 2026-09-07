alter table public.commercial_observations add column if not exists search_text text;

update public.commercial_observations
set search_text = lower(concat_ws(' ',
  source_text,
  source_clause,
  grade,
  standard,
  material_number,
  case
    when product_type='round_tube' then concat_ws('x', outer_diameter_mm::text, thickness_mm::text, length_mm::text)
    when product_type in ('square_tube','rectangular_tube') then concat_ws('x', width_mm::text, height_mm::text, thickness_mm::text, length_mm::text)
    else concat_ws('x', outer_diameter_mm::text, width_mm::text, height_mm::text, thickness_mm::text, length_mm::text)
  end,
  price_value::text,
  price_unit,
  availability_status
));

create index if not exists commercial_observations_owner_search_idx on public.commercial_observations(owner_id, search_text text_pattern_ops);

create or replace function public.commercial_dashboard_metrics()
returns table (
  dataset_id uuid,
  emails bigint,
  threads bigint,
  messages bigint,
  observations bigint,
  requested bigint,
  offered bigint,
  ordered bigint,
  delivered bigint,
  review_pending bigint,
  avg_confidence numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select d.id,
         d.email_count::bigint,
         d.thread_count::bigint,
         d.message_count::bigint,
         d.extraction_count::bigint,
         count(o.id) filter (where o.item_role='requested')::bigint,
         count(o.id) filter (where o.item_role='offered')::bigint,
         count(o.id) filter (where o.item_role='ordered')::bigint,
         count(o.id) filter (where o.item_role='delivered')::bigint,
         (select count(*) from public.commercial_review_queue r where r.dataset_id=d.id and r.owner_id=(select auth.uid()) and r.status='pending')::bigint,
         round(avg(o.confidence),3)
  from public.commercial_datasets d
  left join public.commercial_observations o on o.dataset_id=d.id and o.owner_id=(select auth.uid())
  where d.owner_id=(select auth.uid()) and d.status in ('ready','active')
  group by d.id,d.email_count,d.thread_count,d.message_count,d.extraction_count
  order by d.created_at desc
  limit 1;
$$;
revoke all on function public.commercial_dashboard_metrics() from public, anon;
grant execute on function public.commercial_dashboard_metrics() to authenticated;
