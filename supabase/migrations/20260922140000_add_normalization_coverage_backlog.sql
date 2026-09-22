-- PA2.15 — normalization coverage and controlled backlog.
-- Legacy observations remain evidence. This function measures promotion coverage
-- and exposes only already-defined controlled readiness; it performs no writes.

create or replace view public.current_commercial_entity_promotions
with (security_invoker = true)
as
select p.*
from public.commercial_entity_promotions p
where not exists (
  select 1 from public.commercial_entity_promotions newer
  where newer.supersedes_promotion_id = p.id
);

grant select on public.current_commercial_entity_promotions to authenticated, service_role;

create or replace function public.p1_normalization_coverage(
  p_organization_id uuid,
  p_limit integer default 25
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
begin
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id, false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with observations as (
      select
        o.id,o.item_role,o.thread_id,o.confidence,o.grade,o.standard,
        o.source_filename,o.source_text,o.canonical_product_key,
        o.quantity,o.quantity_unit,o.length_mm,
        case
          when o.item_role='requested' then exists (
            select 1 from public.current_commercial_entity_promotions p
            where p.organization_id=o.organization_id
              and p.observation_id=o.id
              and p.entity_type='rfq_line'
              and p.status='applied'
          )
          when o.item_role='offered' then exists (
            select 1 from public.offer_lines l
            where l.organization_id=o.organization_id and l.source_observation_id=o.id
          )
          when o.item_role='ordered' then exists (
            select 1 from public.order_lines l
            where l.organization_id=o.organization_id and l.source_observation_id=o.id
          )
          else false
        end as normalized,
        exists (
          select 1 from public.commercial_review_queue q
          where q.organization_id=o.organization_id
            and q.observation_id=o.id and q.status='pending'
        ) as pending_review,
        (select count(*) from public.commercial_observations x
          where x.organization_id=o.organization_id
            and x.thread_id=o.thread_id and x.item_role=o.item_role) as same_role_lines
      from public.commercial_observations o
      where o.organization_id=p_organization_id
    ),
    classified as (
      select *,
        case
          when normalized then 'normalized'
          when item_role='delivered' then 'evidence_only'
          when pending_review then 'needs_review'
          when item_role='requested'
            and coalesce(confidence,0)>=0.90
            and canonical_product_key is not null
            and quantity is not null and quantity_unit is not null
            and length_mm is not null
            and nullif(btrim(coalesce(source_text,'')),'') is not null
            and same_role_lines=1
            then 'ready'
          else 'blocked'
        end as backlog_status,
        array_remove(array[
          case when pending_review then 'pending_review' end,
          case when coalesce(confidence,0)<0.90 then 'low_confidence' end,
          case when canonical_product_key is null then 'missing_canonical_identity' end,
          case when quantity is null or quantity_unit is null then 'missing_quantity' end,
          case when length_mm is null then 'missing_length' end,
          case when nullif(btrim(coalesce(source_text,'')),'') is null then 'missing_source_text' end,
          case when item_role='requested' and same_role_lines>1 then 'multi_line_thread' end,
          case when item_role='offered' then 'offer_promotion_not_enabled' end,
          case when item_role='ordered' then 'order_promotion_not_enabled' end,
          case when item_role='delivered' then 'delivery_is_evidence_only' end
        ]::text[],null) as reasons
      from observations
    ),
    summary as (
      select jsonb_build_object(
        'observations_total',count(*),
        'normalized_total',count(*) filter(where normalized),
        'backlog_total',count(*) filter(where backlog_status in ('ready','needs_review','blocked')),
        'ready',count(*) filter(where backlog_status='ready'),
        'needs_review',count(*) filter(where backlog_status='needs_review'),
        'blocked',count(*) filter(where backlog_status='blocked'),
        'evidence_only',count(*) filter(where backlog_status='evidence_only'),
        'requested_total',count(*) filter(where item_role='requested'),
        'requested_normalized',count(*) filter(where item_role='requested' and normalized),
        'offered_total',count(*) filter(where item_role='offered'),
        'offered_normalized',count(*) filter(where item_role='offered' and normalized),
        'ordered_total',count(*) filter(where item_role='ordered'),
        'ordered_normalized',count(*) filter(where item_role='ordered' and normalized),
        'delivered_total',count(*) filter(where item_role='delivered'),
        'coverage_pct',round(
          100.0*count(*) filter(where normalized) /
          nullif(count(*) filter(where item_role in ('requested','offered','ordered')),0),2)
      ) value
      from classified
    ),
    rows as (
      select jsonb_build_object(
        'observation_id',id,'item_role',item_role,'backlog_status',backlog_status,
        'reasons',to_jsonb(reasons),'thread_id',thread_id,'confidence',confidence,
        'grade',grade,'standard',standard,'canonical_product_key',canonical_product_key,
        'source_filename',source_filename,'source_text',source_text
      ) value
      from classified
      where backlog_status in ('ready','needs_review','blocked')
      order by case backlog_status when 'ready' then 0 when 'needs_review' then 1 else 2 end,
        confidence desc nulls last,id desc
      limit greatest(1,least(coalesce(p_limit,25),200))
    )
    select jsonb_build_object(
      'summary',(select value from summary),
      'backlog',coalesce((select jsonb_agg(value) from rows),'[]'::jsonb),
      'policy',jsonb_build_object(
        'requested_promotion_enabled',true,
        'offer_promotion_enabled',false,
        'order_promotion_enabled',false,
        'delivered_operational_entity_enabled',false,
        'bulk_auto_promotion',false,
        'legacy_is_evidence',true
      )
    )
  );
end;
$$;

revoke all on function public.p1_normalization_coverage(uuid,integer) from public,anon;
grant execute on function public.p1_normalization_coverage(uuid,integer) to authenticated,service_role;
