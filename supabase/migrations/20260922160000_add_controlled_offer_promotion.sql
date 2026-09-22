-- PA2.17 — controlled Offer promotion service.
-- One complete outbound offered thread becomes one normalized Offer with N Offer Lines.
-- Legacy observations remain immutable evidence; no Company/RFQ inference is performed.

create or replace function public.p1_offer_promotion_readiness(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
begin
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with offered as (
      select
        o.*,
        exists (
          select 1 from public.commercial_review_queue q
          where q.organization_id=o.organization_id
            and q.observation_id=o.id
            and q.status='pending'
        ) pending_review,
        p.id promotion_id,
        p.entity_id promoted_offer_line_id,
        ol.offer_id promoted_offer_id,
        (
          coalesce(o.confidence,0)>=0.90
          and o.direction='outbound'
          and o.canonical_product_id is not null
          and o.canonical_product_key is not null
          and o.quantity is not null
          and o.quantity_unit is not null
          and o.price_value is not null
          and o.price_unit is not null
          and o.currency is not null
          and nullif(btrim(coalesce(o.source_text,'')),'') is not null
          and not exists (
            select 1 from public.commercial_review_queue q
            where q.organization_id=o.organization_id
              and q.observation_id=o.id
              and q.status='pending'
          )
          and p.id is null
        ) eligible
      from public.commercial_observations o
      left join public.current_commercial_entity_promotions p
        on p.organization_id=o.organization_id
       and p.observation_id=o.id
       and p.entity_type='offer_line'
       and p.status='applied'
      left join public.offer_lines ol
        on ol.organization_id=o.organization_id
       and ol.id=p.entity_id
      where o.organization_id=p_organization_id
        and o.item_role='offered'
    ),
    groups as (
      select
        organization_id,
        thread_id,
        count(*)::int line_count,
        count(*) filter(where eligible)::int eligible_count,
        count(*) filter(where promotion_id is not null)::int promoted_count,
        count(distinct promoted_offer_id) filter(where promoted_offer_id is not null)::int promoted_offer_count,
        count(distinct currency) filter(where currency is not null)::int currency_count,
        min(promoted_offer_id::text) filter(where promoted_offer_id is not null)::uuid promoted_offer_id,
        bool_or(coalesce(confidence,0)<0.90) has_low_confidence,
        bool_or(direction is distinct from 'outbound') has_non_outbound,
        bool_or(canonical_product_id is null or canonical_product_key is null) has_missing_canonical,
        bool_or(quantity is null or quantity_unit is null) has_missing_quantity,
        bool_or(price_value is null or price_unit is null) has_missing_price,
        bool_or(currency is null) has_missing_currency,
        bool_or(pending_review) has_pending_review,
        bool_or(nullif(btrim(coalesce(source_text,'')),'') is null) has_missing_source_text
      from offered
      group by organization_id,thread_id
    ),
    classified as (
      select
        g.*,
        case
          when promoted_count=line_count and promoted_offer_count=1 then 'already_promoted'
          when promoted_count>0 then 'partial_promoted'
          when eligible_count=line_count and currency_count=1 then 'ready'
          else 'blocked'
        end readiness_status,
        array_remove(array[
          case when promoted_count>0 and not (promoted_count=line_count and promoted_offer_count=1) then 'partial_promotion_state' end,
          case when has_pending_review then 'pending_review' end,
          case when has_low_confidence then 'low_confidence' end,
          case when has_non_outbound then 'non_outbound_offer' end,
          case when has_missing_canonical then 'missing_canonical_identity' end,
          case when has_missing_quantity then 'missing_quantity' end,
          case when has_missing_price then 'missing_price' end,
          case when has_missing_currency then 'missing_currency' end,
          case when has_missing_source_text then 'missing_source_text' end,
          case when currency_count>1 then 'mixed_currency_thread' end,
          case when promoted_count=0 and eligible_count<line_count then 'incomplete_offer_thread' end
        ]::text[],null) reasons
      from groups g
    ),
    summary as (
      select jsonb_build_object(
        'offer_threads',count(*),
        'offered_observations',(select count(*) from offered),
        'ready_threads',count(*) filter(where readiness_status='ready'),
        'ready_observations',coalesce(sum(line_count) filter(where readiness_status='ready'),0),
        'blocked_threads',count(*) filter(where readiness_status='blocked'),
        'partial_promoted_threads',count(*) filter(where readiness_status='partial_promoted'),
        'already_promoted_threads',count(*) filter(where readiness_status='already_promoted')
      ) value
      from classified
    ),
    rows as (
      select jsonb_build_object(
        'thread_id',c.thread_id,
        'readiness_status',c.readiness_status,
        'reasons',to_jsonb(c.reasons),
        'line_count',c.line_count,
        'eligible_count',c.eligible_count,
        'promoted_count',c.promoted_count,
        'promoted_offer_id',c.promoted_offer_id,
        'source_filename',(
          select min(o.source_filename) from offered o where o.thread_id=c.thread_id
        ),
        'lines',coalesce((
          select jsonb_agg(jsonb_build_object(
            'observation_id',o.id,
            'direction',o.direction,
            'confidence',o.confidence,
            'canonical_product_key',o.canonical_product_key,
            'quantity',o.quantity,
            'quantity_unit',o.quantity_unit,
            'price_value',o.price_value,
            'price_unit',o.price_unit,
            'currency',o.currency,
            'source_text',o.source_text
          ) order by o.id)
          from offered o where o.thread_id=c.thread_id
        ),'[]'::jsonb)
      ) value
      from classified c
      order by
        case c.readiness_status when 'ready' then 0 when 'blocked' then 1 when 'partial_promoted' then 2 else 3 end,
        c.line_count asc,c.thread_id
      limit greatest(1,least(coalesce(p_limit,100),500))
    )
    select jsonb_build_object(
      'summary',(select value from summary),
      'threads',coalesce((select jsonb_agg(value) from rows),'[]'::jsonb),
      'policy',jsonb_build_object(
        'confidence_threshold',0.90,
        'requires_outbound',true,
        'requires_complete_thread',true,
        'requires_single_currency',true,
        'requires_canonical_identity',true,
        'requires_quantity',true,
        'requires_price',true,
        'requires_no_pending_review',true,
        'company_inference',false,
        'rfq_inference',false,
        'bulk_auto_promotion',false
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_promotion_readiness(uuid,integer) from public,anon;
grant execute on function public.p1_offer_promotion_readiness(uuid,integer) to authenticated,service_role;

create or replace function private.promote_offered_thread_impl(
  p_organization_id uuid,
  p_thread_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_thread public.commercial_threads%rowtype;
  line_count integer;
  eligible_count integer;
  promoted_count integer;
  promoted_offer_count integer;
  currency_count integer;
  existing_offer_id uuid;
  offer_currency text;
  offered_at timestamptz;
  new_offer_id uuid := gen_random_uuid();
  new_line_id uuid;
  promotion_id bigint;
  obs public.commercial_observations%rowtype;
  line_results jsonb := '[]'::jsonb;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'Active organization write membership required';
  end if;

  select * into target_thread
  from public.commercial_threads
  where organization_id=p_organization_id and id=p_thread_id;

  if not found then raise exception 'Commercial thread not found in organization'; end if;

  perform pg_advisory_xact_lock(hashtextextended('offer:'||p_thread_id::text,0));

  select
    count(*)::int,
    count(*) filter(
      where coalesce(o.confidence,0)>=0.90
        and o.direction='outbound'
        and o.canonical_product_id is not null
        and o.canonical_product_key is not null
        and o.quantity is not null and o.quantity_unit is not null
        and o.price_value is not null and o.price_unit is not null
        and o.currency is not null
        and nullif(btrim(coalesce(o.source_text,'')),'') is not null
        and not exists (
          select 1 from public.commercial_review_queue q
          where q.organization_id=o.organization_id and q.observation_id=o.id and q.status='pending'
        )
        and p.id is null
    )::int,
    count(*) filter(where p.id is not null)::int,
    count(distinct ol.offer_id) filter(where ol.offer_id is not null)::int,
    count(distinct o.currency) filter(where o.currency is not null)::int,
    min(ol.offer_id::text) filter(where ol.offer_id is not null)::uuid,
    min(o.currency) filter(where o.currency is not null),
    min(o.created_at)
  into line_count,eligible_count,promoted_count,promoted_offer_count,currency_count,
       existing_offer_id,offer_currency,offered_at
  from public.commercial_observations o
  left join public.current_commercial_entity_promotions p
    on p.organization_id=o.organization_id and p.observation_id=o.id
   and p.entity_type='offer_line' and p.status='applied'
  left join public.offer_lines ol
    on ol.organization_id=o.organization_id and ol.id=p.entity_id
  where o.organization_id=p_organization_id
    and o.thread_id=p_thread_id
    and o.item_role='offered';

  if line_count=0 then raise exception 'Thread has no offered observations'; end if;

  if promoted_count=line_count and promoted_offer_count=1 then
    return jsonb_build_object(
      'status','already_promoted','thread_id',p_thread_id,'offer_id',existing_offer_id,
      'line_count',line_count,
      'lines',coalesce((
        select jsonb_agg(jsonb_build_object(
          'observation_id',o.id,'offer_line_id',p.entity_id,'promotion_id',p.id
        ) order by o.id)
        from public.commercial_observations o
        join public.current_commercial_entity_promotions p
          on p.organization_id=o.organization_id and p.observation_id=o.id
         and p.entity_type='offer_line' and p.status='applied'
        where o.organization_id=p_organization_id and o.thread_id=p_thread_id and o.item_role='offered'
      ),'[]'::jsonb)
    );
  end if;

  if promoted_count>0 then raise exception 'Partial promotion state blocks Offer promotion'; end if;

  if eligible_count<>line_count or currency_count<>1 then
    return jsonb_build_object(
      'status','blocked','thread_id',p_thread_id,'line_count',line_count,
      'eligible_line_count',eligible_count,'currency_count',currency_count
    );
  end if;

  insert into public.offers(
    id,owner_id,organization_id,created_by_user_id,assigned_to_user_id,
    offered_at,status,currency,notes
  ) values (
    new_offer_id,actor_id,p_organization_id,actor_id,actor_id,
    offered_at,'sent',offer_currency,
    concat('Controlled Offer promotion from commercial thread ',p_thread_id,
           '. Company/RFQ intentionally unresolved.')
  );

  for obs in
    select o.* from public.commercial_observations o
    where o.organization_id=p_organization_id and o.thread_id=p_thread_id and o.item_role='offered'
    order by o.id
  loop
    new_line_id := gen_random_uuid();

    insert into public.offer_lines(
      id,owner_id,organization_id,offer_id,
      quantity,quantity_unit,price_value,price_unit,
      source_text,confidence,canonical_product_id,canonical_product_key,
      source_observation_id,raw_spec_text
    ) values (
      new_line_id,actor_id,p_organization_id,new_offer_id,
      obs.quantity,obs.quantity_unit,obs.price_value,obs.price_unit,
      obs.source_text,obs.confidence,obs.canonical_product_id,obs.canonical_product_key,
      obs.id,obs.source_text
    );

    promotion_id := private.record_commercial_entity_promotion_impl(
      p_organization_id,obs.id,'offer_line',new_line_id,
      null,'created','applied',obs.confidence,'deterministic_match',
      null,null,jsonb_build_object(
        'phase','PA2.17','service','controlled_offered_thread_promotion',
        'thread_id',p_thread_id,'company_inference',false,'rfq_inference',false
      )
    );

    line_results := line_results || jsonb_build_array(jsonb_build_object(
      'observation_id',obs.id,'offer_line_id',new_line_id,'promotion_id',promotion_id
    ));
  end loop;

  return jsonb_build_object(
    'status','promoted','thread_id',p_thread_id,'offer_id',new_offer_id,
    'line_count',line_count,'lines',line_results,
    'control_phase','PA2.17','execution_mode','single_thread_explicit'
  );
end;
$$;

revoke execute on function private.promote_offered_thread_impl(uuid,uuid) from public,anon;
grant execute on function private.promote_offered_thread_impl(uuid,uuid) to authenticated,service_role;

create or replace function public.p1_promote_ready_offer_thread(
  p_organization_id uuid,
  p_thread_id uuid
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.promote_offered_thread_impl(p_organization_id,p_thread_id);
$$;

revoke all on function public.p1_promote_ready_offer_thread(uuid,uuid) from public,anon;
grant execute on function public.p1_promote_ready_offer_thread(uuid,uuid) to authenticated,service_role;

comment on function public.p1_promote_ready_offer_thread(uuid,uuid) is
  'PA2.17 explicit whole-thread Offer promotion. Requires every offered line to be outbound and complete, one currency, no pending review; performs no Company or RFQ inference.';

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
        o.id,o.item_role,o.thread_id,o.confidence,o.grade,o.standard,o.direction,
        o.source_filename,o.source_text,o.canonical_product_key,o.canonical_product_id,
        o.quantity,o.quantity_unit,o.length_mm,o.price_value,o.price_unit,o.currency,
        case
          when o.item_role='requested' then exists (
            select 1 from public.current_commercial_entity_promotions p
            where p.organization_id=o.organization_id and p.observation_id=o.id
              and p.entity_type='rfq_line' and p.status='applied'
          )
          when o.item_role='offered' then exists (
            select 1 from public.current_commercial_entity_promotions p
            where p.organization_id=o.organization_id and p.observation_id=o.id
              and p.entity_type='offer_line' and p.status='applied'
          )
          when o.item_role='ordered' then exists (
            select 1 from public.order_lines l
            where l.organization_id=o.organization_id and l.source_observation_id=o.id
          )
          else false
        end normalized,
        exists (
          select 1 from public.commercial_review_queue q
          where q.organization_id=o.organization_id and q.observation_id=o.id and q.status='pending'
        ) pending_review,
        (select count(*) from public.commercial_observations x
          where x.organization_id=o.organization_id and x.thread_id=o.thread_id and x.item_role=o.item_role) same_role_lines,
        (select count(*) from public.commercial_observations x
          where x.organization_id=o.organization_id and x.thread_id=o.thread_id and x.item_role='offered'
            and coalesce(x.confidence,0)>=0.90 and x.direction='outbound'
            and x.canonical_product_id is not null and x.canonical_product_key is not null
            and x.quantity is not null and x.quantity_unit is not null
            and x.price_value is not null and x.price_unit is not null and x.currency is not null
            and nullif(btrim(coalesce(x.source_text,'')),'') is not null
            and not exists(select 1 from public.commercial_review_queue q
              where q.organization_id=x.organization_id and q.observation_id=x.id and q.status='pending')
            and not exists(select 1 from public.current_commercial_entity_promotions p
              where p.organization_id=x.organization_id and p.observation_id=x.id
                and p.entity_type='offer_line' and p.status='applied')
        ) offered_eligible_lines,
        (select count(distinct x.currency) from public.commercial_observations x
          where x.organization_id=o.organization_id and x.thread_id=o.thread_id and x.item_role='offered'
            and x.currency is not null) offered_currency_count
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
            and coalesce(confidence,0)>=0.90 and canonical_product_key is not null
            and quantity is not null and quantity_unit is not null and length_mm is not null
            and nullif(btrim(coalesce(source_text,'')),'') is not null and same_role_lines=1
            then 'ready'
          when item_role='offered'
            and offered_eligible_lines=same_role_lines and offered_currency_count=1
            then 'ready'
          else 'blocked'
        end backlog_status,
        array_remove(array[
          case when pending_review then 'pending_review' end,
          case when coalesce(confidence,0)<0.90 then 'low_confidence' end,
          case when canonical_product_key is null then 'missing_canonical_identity' end,
          case when quantity is null or quantity_unit is null then 'missing_quantity' end,
          case when length_mm is null and item_role='requested' then 'missing_length' end,
          case when nullif(btrim(coalesce(source_text,'')),'') is null then 'missing_source_text' end,
          case when item_role='requested' and same_role_lines>1 then 'multi_line_thread' end,
          case when item_role='offered' and direction is distinct from 'outbound' then 'non_outbound_offer' end,
          case when item_role='offered' and (price_value is null or price_unit is null) then 'missing_price' end,
          case when item_role='offered' and currency is null then 'missing_currency' end,
          case when item_role='offered' and offered_currency_count>1 then 'mixed_currency_thread' end,
          case when item_role='offered' and offered_eligible_lines<same_role_lines then 'incomplete_offer_thread' end,
          case when item_role='ordered' then 'order_promotion_not_enabled' end,
          case when item_role='delivered' then 'delivery_is_evidence_only' end
        ]::text[],null) reasons
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
        'coverage_pct',round(100.0*count(*) filter(where normalized) /
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
        'offer_promotion_enabled',true,
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
