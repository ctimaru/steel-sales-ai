-- PA2.4 — curated requested-observation promotion readiness queue.
create or replace function public.p1_promotion_readiness(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
with base as (
  select
    o.*,
    (select count(*) from public.commercial_observations x
      where x.organization_id=o.organization_id
        and x.thread_id=o.thread_id
        and x.item_role='requested') as requested_lines_in_thread,
    exists (
      select 1 from public.commercial_review_queue q
      where q.organization_id=o.organization_id
        and q.observation_id=o.id
        and q.status='pending'
    ) as has_pending_review,
    exists (
      select 1 from public.current_commercial_entity_promotions p
      where p.organization_id=o.organization_id
        and p.observation_id=o.id
        and p.entity_type='rfq_line'
    ) as already_promoted
  from public.commercial_observations o
  where o.organization_id=p_organization_id
    and o.item_role='requested'
),
classified as (
  select
    b.*,
    array_remove(array[
      case when b.already_promoted then 'already_promoted' end,
      case when coalesce(b.confidence,0)<0.90 then 'low_confidence' end,
      case when b.canonical_product_id is null or b.canonical_product_key is null then 'missing_canonical_identity' end,
      case when b.has_pending_review then 'pending_review' end,
      case when b.quantity is null or b.quantity_unit is null then 'missing_quantity' end,
      case when b.length_mm is null then 'missing_length' end,
      case when nullif(btrim(coalesce(b.source_text,'')),'') is null then 'missing_source_text' end,
      case when b.requested_lines_in_thread>1 then 'multi_line_thread' end
    ]::text[],null) as reasons
  from base b
),
scored as (
  select *,
    case
      when already_promoted then 'already_promoted'
      when cardinality(reasons)=0 then 'ready'
      else 'blocked'
    end as readiness_status
  from classified
),
summary as (
  select jsonb_build_object(
    'requested_total',count(*),
    'ready',count(*) filter(where readiness_status='ready'),
    'blocked',count(*) filter(where readiness_status='blocked'),
    'already_promoted',count(*) filter(where readiness_status='already_promoted'),
    'multi_line_thread',count(*) filter(where 'multi_line_thread'=any(reasons)),
    'pending_review',count(*) filter(where 'pending_review'=any(reasons)),
    'low_confidence',count(*) filter(where 'low_confidence'=any(reasons)),
    'missing_canonical_identity',count(*) filter(where 'missing_canonical_identity'=any(reasons)),
    'missing_quantity',count(*) filter(where 'missing_quantity'=any(reasons)),
    'missing_length',count(*) filter(where 'missing_length'=any(reasons))
  ) as value
  from scored
),
rows as (
  select jsonb_build_object(
    'observation_id',id,
    'readiness_status',readiness_status,
    'reasons',to_jsonb(reasons),
    'confidence',confidence,
    'thread_id',thread_id,
    'requested_lines_in_thread',requested_lines_in_thread,
    'grade',grade,'standard',standard,'product_type',product_type,
    'outer_diameter_mm',outer_diameter_mm,'width_mm',width_mm,'height_mm',height_mm,
    'thickness_mm',thickness_mm,'length_mm',length_mm,
    'quantity',quantity,'quantity_unit',quantity_unit,
    'canonical_product_id',canonical_product_id,'canonical_product_key',canonical_product_key,
    'source_filename',source_filename,'source_text',source_text
  ) as value
  from scored
  order by
    case readiness_status when 'ready' then 0 when 'blocked' then 1 else 2 end,
    confidence desc nulls last,id desc
  limit greatest(1,least(coalesce(p_limit,100),500))
)
select jsonb_build_object(
  'summary',(select value from summary),
  'candidates',coalesce((select jsonb_agg(value) from rows),'[]'::jsonb),
  'policy',jsonb_build_object(
    'confidence_threshold',0.90,
    'requires_canonical_identity',true,
    'requires_no_pending_review',true,
    'requires_quantity',true,
    'requires_length',true,
    'requires_single_line_thread',true
  )
);
$$;

revoke all on function public.p1_promotion_readiness(uuid,integer) from public,anon,authenticated;
grant execute on function public.p1_promotion_readiness(uuid,integer) to service_role;
