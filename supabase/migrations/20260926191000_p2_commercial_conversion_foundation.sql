-- P2.5 — Commercial Outcome Attribution & Conversion Foundation.
-- Conversion intelligence is exposed only on deterministic, attributed relationships.

create or replace function private.p2_reconcile_commercial_outcome_attribution_impl(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  offer_updated integer := 0;
  order_updated integer := 0;
  offer_source_conflicts integer := 0;
  order_source_conflicts integer := 0;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'Active organization write membership required';
  end if;

  with source_rows as (
    select
      o.id,
      o.company_id as existing_company_id,
      src.company_id as source_company_id
    from public.offers o
    left join public.conversations c
      on c.organization_id=o.organization_id
     and c.id=o.conversation_id
    left join public.rfqs r
      on r.organization_id=o.organization_id
     and r.id=o.rfq_id
    cross join lateral (
      select distinct candidate.company_id
      from (
        values (c.company_id),(r.company_id)
      ) candidate(company_id)
      where candidate.company_id is not null
        and exists (
          select 1
          from public.commercial_company_identity_verifications v
          where v.organization_id=o.organization_id
            and v.company_id=candidate.company_id
        )
    ) src
    where o.organization_id=p_organization_id
  ),
  rollup as (
    select
      o.id,
      o.company_id as existing_company_id,
      count(distinct s.source_company_id)::int as source_company_count,
      min(s.source_company_id::text)::uuid as source_company_id
    from public.offers o
    left join source_rows s on s.id=o.id
    where o.organization_id=p_organization_id
    group by o.id,o.company_id
  )
  select count(*)::int
  into offer_source_conflicts
  from rollup
  where source_company_count>1
     or (
       existing_company_id is not null
       and source_company_count=1
       and existing_company_id<>source_company_id
     );

  with source_rows as (
    select
      o.id,
      src.company_id as source_company_id
    from public.offers o
    left join public.conversations c
      on c.organization_id=o.organization_id
     and c.id=o.conversation_id
    left join public.rfqs r
      on r.organization_id=o.organization_id
     and r.id=o.rfq_id
    cross join lateral (
      select distinct candidate.company_id
      from (
        values (c.company_id),(r.company_id)
      ) candidate(company_id)
      where candidate.company_id is not null
        and exists (
          select 1
          from public.commercial_company_identity_verifications v
          where v.organization_id=o.organization_id
            and v.company_id=candidate.company_id
        )
    ) src
    where o.organization_id=p_organization_id
  ),
  rollup as (
    select
      o.id,
      o.company_id as existing_company_id,
      count(distinct s.source_company_id)::int as source_company_count,
      min(s.source_company_id::text)::uuid as source_company_id
    from public.offers o
    left join source_rows s on s.id=o.id
    where o.organization_id=p_organization_id
    group by o.id,o.company_id
  )
  update public.offers o
  set company_id=r.source_company_id
  from rollup r
  where o.organization_id=p_organization_id
    and o.id=r.id
    and o.company_id is null
    and r.source_company_count=1;

  get diagnostics offer_updated=row_count;

  with source_rows as (
    select
      o.id,
      src.company_id as source_company_id
    from public.orders o
    left join public.conversations c
      on c.organization_id=o.organization_id
     and c.id=o.conversation_id
    left join public.rfqs r
      on r.organization_id=o.organization_id
     and r.id=o.rfq_id
    left join public.offers f
      on f.organization_id=o.organization_id
     and f.id=o.offer_id
    cross join lateral (
      select distinct candidate.company_id
      from (
        values (c.company_id),(r.company_id),(f.company_id)
      ) candidate(company_id)
      where candidate.company_id is not null
        and exists (
          select 1
          from public.commercial_company_identity_verifications v
          where v.organization_id=o.organization_id
            and v.company_id=candidate.company_id
        )
    ) src
    where o.organization_id=p_organization_id
  ),
  rollup as (
    select
      o.id,
      o.company_id as existing_company_id,
      count(distinct s.source_company_id)::int as source_company_count,
      min(s.source_company_id::text)::uuid as source_company_id
    from public.orders o
    left join source_rows s on s.id=o.id
    where o.organization_id=p_organization_id
    group by o.id,o.company_id
  )
  select count(*)::int
  into order_source_conflicts
  from rollup
  where source_company_count>1
     or (
       existing_company_id is not null
       and source_company_count=1
       and existing_company_id<>source_company_id
     );

  with source_rows as (
    select
      o.id,
      src.company_id as source_company_id
    from public.orders o
    left join public.conversations c
      on c.organization_id=o.organization_id
     and c.id=o.conversation_id
    left join public.rfqs r
      on r.organization_id=o.organization_id
     and r.id=o.rfq_id
    left join public.offers f
      on f.organization_id=o.organization_id
     and f.id=o.offer_id
    cross join lateral (
      select distinct candidate.company_id
      from (
        values (c.company_id),(r.company_id),(f.company_id)
      ) candidate(company_id)
      where candidate.company_id is not null
        and exists (
          select 1
          from public.commercial_company_identity_verifications v
          where v.organization_id=o.organization_id
            and v.company_id=candidate.company_id
        )
    ) src
    where o.organization_id=p_organization_id
  ),
  rollup as (
    select
      o.id,
      o.company_id as existing_company_id,
      count(distinct s.source_company_id)::int as source_company_count,
      min(s.source_company_id::text)::uuid as source_company_id
    from public.orders o
    left join source_rows s on s.id=o.id
    where o.organization_id=p_organization_id
    group by o.id,o.company_id
  )
  update public.orders o
  set company_id=r.source_company_id
  from rollup r
  where o.organization_id=p_organization_id
    and o.id=r.id
    and o.company_id is null
    and r.source_company_count=1;

  get diagnostics order_updated=row_count;

  return jsonb_build_object(
    'status','reconciled',
    'organization_id',p_organization_id,
    'offers_attributed',offer_updated,
    'orders_attributed',order_updated,
    'offer_source_conflicts',offer_source_conflicts,
    'order_source_conflicts',order_source_conflicts
  );
end;
$$;

revoke execute on function private.p2_reconcile_commercial_outcome_attribution_impl(uuid)
  from public,anon;
grant execute on function private.p2_reconcile_commercial_outcome_attribution_impl(uuid)
  to authenticated,service_role;

create or replace function public.p2_reconcile_commercial_outcome_attribution(
  p_organization_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.p2_reconcile_commercial_outcome_attribution_impl(p_organization_id);
$$;

revoke all on function public.p2_reconcile_commercial_outcome_attribution(uuid)
  from public,anon;
grant execute on function public.p2_reconcile_commercial_outcome_attribution(uuid)
  to authenticated,service_role;

create or replace function public.p2_commercial_conversion_foundation(
  p_organization_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with params as (
  select
    greatest(1,least(coalesce(p_limit,100),500))::int as row_limit,
    greatest(0,coalesce(p_offset,0))::int as row_offset
),
access_check as (
  select public.is_organization_member(p_organization_id,false) as allowed
),
verified_companies as (
  select distinct v.company_id
  from public.commercial_company_identity_verifications v
  where v.organization_id=p_organization_id
    and (select allowed from access_check)
),
offer_base as (
  select
    o.id,
    o.offered_at as event_at,
    o.status,
    o.company_id,
    co.name as company_name,
    o.conversation_id,
    o.rfq_id,
    count(distinct ol.id)::int as line_count,
    count(distinct ol.id) filter(where ol.canonical_product_id is not null)::int as canonical_line_count,
    count(distinct ord.id)::int as linked_order_count,
    (o.company_id in (select company_id from verified_companies)) as verified_company,
    r.company_id as rfq_company_id
  from public.offers o
  left join public.companies co
    on co.organization_id=o.organization_id and co.id=o.company_id
  left join public.rfqs r
    on r.organization_id=o.organization_id and r.id=o.rfq_id
  left join public.offer_lines ol
    on ol.organization_id=o.organization_id and ol.offer_id=o.id
  left join public.orders ord
    on ord.organization_id=o.organization_id and ord.offer_id=o.id
  where o.organization_id=p_organization_id
    and (select allowed from access_check)
  group by o.id,o.offered_at,o.status,o.company_id,co.name,o.conversation_id,o.rfq_id,r.company_id
),
order_base as (
  select
    o.id,
    o.ordered_at as event_at,
    o.status,
    o.company_id,
    co.name as company_name,
    o.conversation_id,
    o.rfq_id,
    o.offer_id,
    count(distinct ol.id)::int as line_count,
    count(distinct ol.id) filter(where ol.canonical_product_id is not null)::int as canonical_line_count,
    (o.company_id in (select company_id from verified_companies)) as verified_company,
    r.company_id as rfq_company_id,
    f.company_id as offer_company_id
  from public.orders o
  left join public.companies co
    on co.organization_id=o.organization_id and co.id=o.company_id
  left join public.rfqs r
    on r.organization_id=o.organization_id and r.id=o.rfq_id
  left join public.offers f
    on f.organization_id=o.organization_id and f.id=o.offer_id
  left join public.order_lines ol
    on ol.organization_id=o.organization_id and ol.order_id=o.id
  where o.organization_id=p_organization_id
    and (select allowed from access_check)
  group by
    o.id,o.ordered_at,o.status,o.company_id,co.name,o.conversation_id,o.rfq_id,o.offer_id,
    r.company_id,f.company_id
),
eligible_offers as (
  select b.*
  from offer_base b
  where b.verified_company
    and b.rfq_id is not null
    and b.rfq_company_id=b.company_id
),
converted_offers as (
  select distinct e.id
  from eligible_offers e
  join public.orders o
    on o.organization_id=p_organization_id
   and o.offer_id=e.id
   and o.company_id=e.company_id
),
outcome_conversations as (
  select conversation_id
  from public.offers
  where organization_id=p_organization_id and conversation_id is not null
  union
  select conversation_id
  from public.orders
  where organization_id=p_organization_id and conversation_id is not null
),
outcome_recovery as (
  select
    count(*)::int as recovered_messages,
    count(distinct r.conversation_id)::int as recovered_conversations
  from public.commercial_message_identity_recoveries r
  where r.organization_id=p_organization_id
    and r.conversation_id in (select conversation_id from outcome_conversations)
    and (select allowed from access_check)
),
relationship_readiness as (
  select case
    when (select allowed from access_check)
      then public.p1_operational_relationship_readiness(p_organization_id,500)
    else jsonb_build_object('summary',jsonb_build_object('ready_total',0))
  end as payload
),
offer_rows as (
  select
    'offer'::text as entity_type,
    b.id as entity_id,
    b.event_at,
    b.status,
    b.company_id,
    b.company_name,
    b.conversation_id,
    b.rfq_id,
    null::uuid as offer_id,
    b.line_count,
    b.canonical_line_count,
    b.linked_order_count,
    case
      when b.company_id is null then 'identity_gap'
      when not b.verified_company then 'unverified_company'
      when b.rfq_id is null then 'relationship_gap'
      when b.rfq_company_id is distinct from b.company_id then 'relationship_company_gap'
      when b.linked_order_count>0 then 'converted'
      else 'open_offer'
    end as analysis_status
  from offer_base b
),
order_rows as (
  select
    'order'::text as entity_type,
    b.id as entity_id,
    b.event_at,
    b.status,
    b.company_id,
    b.company_name,
    b.conversation_id,
    b.rfq_id,
    b.offer_id,
    b.line_count,
    b.canonical_line_count,
    0::int as linked_order_count,
    case
      when b.company_id is null then 'identity_gap'
      when not b.verified_company then 'unverified_company'
      when b.offer_id is null and b.rfq_id is null then 'relationship_gap'
      when b.offer_id is not null and b.offer_company_id is distinct from b.company_id
        then 'relationship_company_gap'
      when b.rfq_id is not null and b.rfq_company_id is distinct from b.company_id
        then 'relationship_company_gap'
      else 'linked_order'
    end as analysis_status
  from order_base b
),
outcome_rows as (
  select * from offer_rows
  union all
  select * from order_rows
),
paged as (
  select *
  from outcome_rows
  order by
    case analysis_status
      when 'identity_gap' then 0
      when 'unverified_company' then 1
      when 'relationship_gap' then 2
      when 'relationship_company_gap' then 3
      when 'open_offer' then 4
      when 'linked_order' then 5
      else 6
    end,
    event_at desc nulls last,
    entity_type,
    entity_id
  limit (select row_limit from params)
  offset (select row_offset from params)
),
summary as (
  select jsonb_build_object(
    'rfq_count',(
      select count(*) from public.rfqs
      where organization_id=p_organization_id and (select allowed from access_check)
    ),
    'offer_count',(select count(*) from offer_base),
    'order_count',(select count(*) from order_base),
    'attributed_rfq_count',(
      select count(*) from public.rfqs r
      where r.organization_id=p_organization_id
        and r.company_id in (select company_id from verified_companies)
        and (select allowed from access_check)
    ),
    'attributed_offer_count',(select count(*) from offer_base where verified_company),
    'attributed_order_count',(select count(*) from order_base where verified_company),
    'canonical_offer_line_count',(select coalesce(sum(canonical_line_count),0) from offer_base),
    'canonical_order_line_count',(select coalesce(sum(canonical_line_count),0) from order_base),
    'offer_rfq_linked_count',(select count(*) from offer_base where rfq_id is not null),
    'order_offer_linked_count',(select count(*) from order_base where offer_id is not null),
    'order_rfq_linked_count',(select count(*) from order_base where rfq_id is not null),
    'conversion_eligible_offer_count',(select count(*) from eligible_offers),
    'converted_offer_count',(select count(*) from converted_offers),
    'open_offer_followup_count',(
      select count(*)
      from eligible_offers e
      where not exists (select 1 from converted_offers c where c.id=e.id)
    ),
    'identity_gap_offer_count',(select count(*) from offer_rows where analysis_status='identity_gap'),
    'identity_gap_order_count',(select count(*) from order_rows where analysis_status='identity_gap'),
    'relationship_gap_offer_count',(
      select count(*) from offer_rows
      where analysis_status in ('relationship_gap','relationship_company_gap')
    ),
    'relationship_gap_order_count',(
      select count(*) from order_rows
      where analysis_status in ('relationship_gap','relationship_company_gap')
    ),
    'outcome_conversation_count',(select count(*) from outcome_conversations),
    'outcome_company_conversation_count',(
      select count(*)
      from public.conversations c
      where c.organization_id=p_organization_id
        and c.id in (select conversation_id from outcome_conversations)
        and c.company_id in (select company_id from verified_companies)
        and (select allowed from access_check)
    ),
    'outcome_recovered_message_count',(select recovered_messages from outcome_recovery),
    'outcome_recovered_conversation_count',(select recovered_conversations from outcome_recovery),
    'relationship_ready_count',
      coalesce(((select payload from relationship_readiness)#>>'{summary,ready_total}')::int,0),
    'conversion_rate_pct',case
      when (select count(*) from eligible_offers)=0 then null
      else round(
        100.0*(select count(*) from converted_offers)::numeric
        /(select count(*) from eligible_offers)::numeric,
        1
      )
    end
  ) as value
)
select jsonb_build_object(
  'summary',(select value from summary),
  'outcomes',coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'entity_type',entity_type,
        'entity_id',entity_id,
        'event_at',event_at,
        'status',status,
        'company_id',company_id,
        'company_name',company_name,
        'conversation_id',conversation_id,
        'rfq_id',rfq_id,
        'offer_id',offer_id,
        'line_count',line_count,
        'canonical_line_count',canonical_line_count,
        'linked_order_count',linked_order_count,
        'analysis_status',analysis_status
      )
      order by
        case analysis_status
          when 'identity_gap' then 0
          when 'unverified_company' then 1
          when 'relationship_gap' then 2
          when 'relationship_company_gap' then 3
          when 'open_offer' then 4
          when 'linked_order' then 5
          else 6
        end,
        event_at desc nulls last,
        entity_type,
        entity_id
    )
    from paged
  ),'[]'::jsonb),
  'policy',jsonb_build_object(
    'verified_company_required',true,
    'explicit_relationship_required_for_conversion',true,
    'conversion_denominator','verified_company_plus_same_company_rfq_link',
    'missing_identity_is_not_loss',true,
    'missing_relationship_is_not_loss',true,
    'conversion_rate_nullable',true,
    'predictive_score',false,
    'cross_thread_similarity',false,
    'email_domain_inference',false,
    'filename_inference',false,
    'subject_inference',false,
    'bulk_relationship_activation',false
  )
);
$$;

revoke all on function public.p2_commercial_conversion_foundation(uuid,integer,integer)
  from public,anon;
grant execute on function public.p2_commercial_conversion_foundation(uuid,integer,integer)
  to authenticated,service_role;

comment on function public.p2_reconcile_commercial_outcome_attribution(uuid) is
  'P2.5 reconciles Offer/Order Company attribution only when verified Conversation/RFQ/Offer sources converge. It never infers Company from domain, filename or subject.';

comment on function public.p2_commercial_conversion_foundation(uuid,integer,integer) is
  'P2.5 evidence-first conversion foundation. Missing identity and relationship coverage are reported as data gaps; conversion rate is null until the deterministic denominator exists.';
