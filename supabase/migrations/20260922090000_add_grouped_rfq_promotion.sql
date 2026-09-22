-- PA2.5 — grouped / multi-line RFQ promotion.
-- One requested commercial thread becomes one RFQ with N RFQ Lines.
-- No historical bulk execution is introduced by this migration.

create or replace function public.p1_grouped_rfq_readiness(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
with requested as (
  select
    o.*,
    exists (
      select 1
      from public.commercial_review_queue q
      where q.organization_id=o.organization_id
        and q.observation_id=o.id
        and q.status='pending'
    ) as has_pending_review,
    p.id as promotion_id,
    p.entity_id as promoted_rfq_line_id,
    rl.rfq_id as promoted_rfq_id
  from public.commercial_observations o
  left join public.current_commercial_entity_promotions p
    on p.organization_id=o.organization_id
   and p.observation_id=o.id
   and p.entity_type='rfq_line'
  left join public.rfq_lines rl
    on rl.organization_id=o.organization_id
   and rl.id=p.entity_id
  where o.organization_id=p_organization_id
    and o.item_role='requested'
),
groups as (
  select
    r.organization_id,
    r.thread_id,
    count(*)::int as line_count,
    count(*) filter (where r.promotion_id is not null)::int as promoted_count,
    count(distinct r.promoted_rfq_id) filter (where r.promoted_rfq_id is not null)::int as promoted_rfq_count,
    count(*) filter (
      where coalesce(r.confidence,0)>=0.90
        and r.canonical_product_id is not null
        and r.canonical_product_key is not null
        and not r.has_pending_review
        and r.quantity is not null
        and r.quantity_unit is not null
        and r.length_mm is not null
        and nullif(btrim(coalesce(r.source_text,'')),'') is not null
        and r.promotion_id is null
    )::int as eligible_unpromoted_count,
    bool_or(coalesce(r.confidence,0)<0.90) as has_low_confidence,
    bool_or(r.canonical_product_id is null or r.canonical_product_key is null) as has_missing_canonical,
    bool_or(r.has_pending_review) as has_pending_review,
    bool_or(r.quantity is null or r.quantity_unit is null) as has_missing_quantity,
    bool_or(r.length_mm is null) as has_missing_length,
    bool_or(nullif(btrim(coalesce(r.source_text,'')),'') is null) as has_missing_source_text,
    min(r.promoted_rfq_id) filter (where r.promoted_rfq_id is not null) as promoted_rfq_id
  from requested r
  group by r.organization_id,r.thread_id
  having count(*)>1
),
classified as (
  select
    g.*,
    case
      when g.promoted_count=g.line_count and g.promoted_rfq_count=1 then 'already_promoted'
      when g.promoted_count>0 then 'partial_promoted'
      when g.eligible_unpromoted_count=g.line_count then 'ready'
      else 'blocked'
    end as readiness_status,
    array_remove(array[
      case when g.promoted_count>0 and not (g.promoted_count=g.line_count and g.promoted_rfq_count=1)
        then 'partial_promotion_state' end,
      case when g.has_low_confidence then 'low_confidence' end,
      case when g.has_missing_canonical then 'missing_canonical_identity' end,
      case when g.has_pending_review then 'pending_review' end,
      case when g.has_missing_quantity then 'missing_quantity' end,
      case when g.has_missing_length then 'missing_length' end,
      case when g.has_missing_source_text then 'missing_source_text' end
    ]::text[],null) as reasons
  from groups g
),
summary as (
  select jsonb_build_object(
    'multi_line_threads',count(*),
    'ready',count(*) filter(where readiness_status='ready'),
    'blocked',count(*) filter(where readiness_status='blocked'),
    'partial_promoted',count(*) filter(where readiness_status='partial_promoted'),
    'already_promoted',count(*) filter(where readiness_status='already_promoted')
  ) as value
  from classified
),
rows as (
  select jsonb_build_object(
    'thread_id',c.thread_id,
    'subject',t.subject,
    'readiness_status',c.readiness_status,
    'reasons',to_jsonb(c.reasons),
    'line_count',c.line_count,
    'promoted_count',c.promoted_count,
    'promoted_rfq_id',c.promoted_rfq_id,
    'lines',coalesce((
      select jsonb_agg(jsonb_build_object(
        'observation_id',r.id,
        'confidence',r.confidence,
        'grade',r.grade,
        'standard',r.standard,
        'product_type',r.product_type,
        'outer_diameter_mm',r.outer_diameter_mm,
        'width_mm',r.width_mm,
        'height_mm',r.height_mm,
        'thickness_mm',r.thickness_mm,
        'length_mm',r.length_mm,
        'quantity',r.quantity,
        'quantity_unit',r.quantity_unit,
        'canonical_product_id',r.canonical_product_id,
        'canonical_product_key',r.canonical_product_key,
        'source_text',r.source_text,
        'promotion_id',r.promotion_id,
        'promoted_rfq_line_id',r.promoted_rfq_line_id
      ) order by r.id)
      from requested r
      where r.thread_id=c.thread_id
        and r.organization_id=c.organization_id
    ),'[]'::jsonb)
  ) as value
  from classified c
  join public.commercial_threads t
    on t.id=c.thread_id and t.organization_id=c.organization_id
  order by
    case c.readiness_status
      when 'ready' then 0
      when 'blocked' then 1
      when 'partial_promoted' then 2
      else 3
    end,
    c.line_count asc,
    t.last_activity_at desc nulls last
  limit greatest(1,least(coalesce(p_limit,100),500))
)
select jsonb_build_object(
  'summary',(select value from summary),
  'threads',coalesce((select jsonb_agg(value) from rows),'[]'::jsonb),
  'policy',jsonb_build_object(
    'minimum_lines',2,
    'confidence_threshold',0.90,
    'requires_all_lines_eligible',true,
    'requires_canonical_identity',true,
    'requires_no_pending_review',true,
    'requires_quantity',true,
    'requires_length',true,
    'partial_promotion_blocks',true
  )
);
$$;

revoke all on function public.p1_grouped_rfq_readiness(uuid,integer)
from public,anon,authenticated;
grant execute on function public.p1_grouped_rfq_readiness(uuid,integer)
to service_role;

create or replace function private.promote_requested_thread_impl(
  p_thread_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $grouped_promotion$
declare
  actor_id uuid := (select auth.uid());
  target_thread public.commercial_threads%rowtype;
  line_count integer;
  eligible_count integer;
  promoted_count integer;
  promoted_rfq_count integer;
  existing_rfq_id uuid;
  new_rfq_id uuid := gen_random_uuid();
  requested_at timestamptz;
  obs public.commercial_observations%rowtype;
  new_line_id uuid;
  promotion_id bigint;
  line_results jsonb := '[]'::jsonb;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_thread
  from public.commercial_threads
  where id=p_thread_id;

  if not found then
    raise exception 'Commercial thread not found';
  end if;

  if not public.is_organization_member(target_thread.organization_id,true) then
    raise exception 'Active organization write membership required';
  end if;

  -- Serialize competing promotion attempts for the same thread.
  perform pg_advisory_xact_lock(hashtextextended(p_thread_id::text,0));

  select
    count(*)::int,
    count(*) filter (
      where coalesce(o.confidence,0)>=0.90
        and o.canonical_product_id is not null
        and o.canonical_product_key is not null
        and not exists (
          select 1 from public.commercial_review_queue q
          where q.organization_id=o.organization_id
            and q.observation_id=o.id
            and q.status='pending'
        )
        and o.quantity is not null
        and o.quantity_unit is not null
        and o.length_mm is not null
        and nullif(btrim(coalesce(o.source_text,'')),'') is not null
        and p.id is null
    )::int,
    count(*) filter (where p.id is not null)::int,
    count(distinct rl.rfq_id) filter (where rl.rfq_id is not null)::int,
    min(rl.rfq_id) filter (where rl.rfq_id is not null),
    min(o.created_at)
  into
    line_count,
    eligible_count,
    promoted_count,
    promoted_rfq_count,
    existing_rfq_id,
    requested_at
  from public.commercial_observations o
  left join public.current_commercial_entity_promotions p
    on p.organization_id=o.organization_id
   and p.observation_id=o.id
   and p.entity_type='rfq_line'
  left join public.rfq_lines rl
    on rl.organization_id=o.organization_id
   and rl.id=p.entity_id
  where o.organization_id=target_thread.organization_id
    and o.thread_id=p_thread_id
    and o.item_role='requested';

  if line_count<2 then
    raise exception 'Grouped promotion requires at least two requested observations';
  end if;

  if promoted_count=line_count and promoted_rfq_count=1 then
    return jsonb_build_object(
      'status','already_promoted',
      'thread_id',p_thread_id,
      'rfq_id',existing_rfq_id,
      'line_count',line_count,
      'lines',coalesce((
        select jsonb_agg(jsonb_build_object(
          'observation_id',o.id,
          'rfq_line_id',p.entity_id,
          'promotion_id',p.id
        ) order by o.id)
        from public.commercial_observations o
        join public.current_commercial_entity_promotions p
          on p.organization_id=o.organization_id
         and p.observation_id=o.id
         and p.entity_type='rfq_line'
        where o.organization_id=target_thread.organization_id
          and o.thread_id=p_thread_id
          and o.item_role='requested'
      ),'[]'::jsonb)
    );
  end if;

  if promoted_count>0 then
    raise exception 'Partial promotion state blocks grouped promotion';
  end if;

  if eligible_count<>line_count then
    return jsonb_build_object(
      'status','blocked',
      'thread_id',p_thread_id,
      'line_count',line_count,
      'eligible_line_count',eligible_count
    );
  end if;

  insert into public.rfqs(
    id,
    owner_id,
    organization_id,
    assigned_to_user_id,
    created_by_user_id,
    requested_at,
    status,
    priority,
    notes
  ) values (
    new_rfq_id,
    actor_id,
    target_thread.organization_id,
    actor_id,
    actor_id,
    requested_at,
    'new',
    'normal',
    concat('Grouped controlled promotion from commercial thread ',p_thread_id)
  );

  for obs in
    select o.*
    from public.commercial_observations o
    where o.organization_id=target_thread.organization_id
      and o.thread_id=p_thread_id
      and o.item_role='requested'
    order by o.id
  loop
    new_line_id := gen_random_uuid();

    insert into public.rfq_lines(
      id,
      owner_id,
      organization_id,
      rfq_id,
      requested_quantity,
      quantity_unit,
      requested_grade,
      requested_standard,
      min_length_mm,
      max_length_mm,
      canonical_product_id,
      canonical_product_key,
      source_observation_id,
      raw_spec_text
    ) values (
      new_line_id,
      actor_id,
      target_thread.organization_id,
      new_rfq_id,
      obs.quantity,
      obs.quantity_unit,
      obs.grade,
      obs.standard,
      obs.length_mm,
      obs.length_mm,
      obs.canonical_product_id,
      obs.canonical_product_key,
      obs.id,
      obs.source_text
    );

    promotion_id := private.record_commercial_entity_promotion_impl(
      target_thread.organization_id,
      obs.id,
      'rfq_line',
      new_line_id,
      null,
      'created',
      'applied',
      obs.confidence,
      'deterministic_match',
      null,
      null,
      jsonb_build_object(
        'phase','PA2.5',
        'service','grouped_requested_thread_promotion',
        'thread_id',p_thread_id
      )
    );

    line_results := line_results || jsonb_build_array(jsonb_build_object(
      'observation_id',obs.id,
      'rfq_line_id',new_line_id,
      'promotion_id',promotion_id
    ));
  end loop;

  return jsonb_build_object(
    'status','promoted',
    'thread_id',p_thread_id,
    'rfq_id',new_rfq_id,
    'line_count',line_count,
    'lines',line_results
  );
end;
$grouped_promotion$;

revoke execute on function private.promote_requested_thread_impl(uuid)
from public,anon;
grant execute on function private.promote_requested_thread_impl(uuid)
to authenticated,service_role;

create or replace function public.promote_requested_thread(
  p_thread_id uuid
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.promote_requested_thread_impl(p_thread_id);
$$;

revoke execute on function public.promote_requested_thread(uuid)
from public,anon;
grant execute on function public.promote_requested_thread(uuid)
to authenticated,service_role;

comment on function public.promote_requested_thread(uuid) is
  'PA2.5 grouped promotion: one fully eligible multi-line requested thread becomes one RFQ with N RFQ Lines and N immutable promotion events.';
