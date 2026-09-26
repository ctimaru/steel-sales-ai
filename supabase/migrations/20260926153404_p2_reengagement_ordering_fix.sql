create or replace function public.p2_reengagement_signals(
  p_organization_id uuid,
  p_watch_after_days integer default 45,
  p_dormant_after_days integer default 90,
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
    greatest(1, coalesce(p_watch_after_days,45))::int as watch_days,
    greatest(
      greatest(1, coalesce(p_watch_after_days,45)) + 1,
      coalesce(p_dormant_after_days,90)
    )::int as dormant_days,
    greatest(1, least(coalesce(p_limit,100),500))::int as row_limit,
    greatest(0, coalesce(p_offset,0))::int as row_offset
),
access_check as (
  select public.is_organization_member(p_organization_id,false) as allowed
),
company_rollup as (
  select
    c.id as company_id,
    c.name,
    c.company_type,
    c.country,
    c.website,
    exists (
      select 1
      from public.commercial_company_identity_verifications v
      where v.organization_id=c.organization_id
        and v.company_id=c.id
    ) as verified,
    (select count(*)::int from public.conversations x
      where x.organization_id=c.organization_id and x.company_id=c.id) as conversation_count,
    (select count(*)::int from public.rfqs x
      where x.organization_id=c.organization_id and x.company_id=c.id) as rfq_count,
    (select count(*)::int from public.offers x
      where x.organization_id=c.organization_id and x.company_id=c.id) as offer_count,
    (select count(*)::int from public.orders x
      where x.organization_id=c.organization_id and x.company_id=c.id) as order_count,
    activity.last_activity_at,
    latest.event_type as latest_event_type,
    latest.event_id as latest_event_id,
    latest.event_at as latest_event_at
  from public.companies c
  left join lateral (
    select max(e.event_at) as last_activity_at
    from (
      select max(x.last_activity_at) as event_at
      from public.conversations x
      where x.organization_id=c.organization_id and x.company_id=c.id
      union all
      select max(x.requested_at)
      from public.rfqs x
      where x.organization_id=c.organization_id and x.company_id=c.id
      union all
      select max(x.offered_at)
      from public.offers x
      where x.organization_id=c.organization_id and x.company_id=c.id
      union all
      select max(x.ordered_at)
      from public.orders x
      where x.organization_id=c.organization_id and x.company_id=c.id
    ) e
  ) activity on true
  left join lateral (
    select e.event_type,e.event_id,e.event_at
    from (
      select 'conversation'::text as event_type,x.id as event_id,x.last_activity_at as event_at,1 as event_rank
      from public.conversations x
      where x.organization_id=c.organization_id and x.company_id=c.id
      union all
      select 'rfq',x.id,x.requested_at,2
      from public.rfqs x
      where x.organization_id=c.organization_id and x.company_id=c.id
      union all
      select 'offer',x.id,x.offered_at,3
      from public.offers x
      where x.organization_id=c.organization_id and x.company_id=c.id
      union all
      select 'order',x.id,x.ordered_at,4
      from public.orders x
      where x.organization_id=c.organization_id and x.company_id=c.id
    ) e
    where e.event_at is not null
    order by e.event_at desc,e.event_rank desc,e.event_id
    limit 1
  ) latest on true
  where c.organization_id=p_organization_id
    and (select allowed from access_check)
),
eligible as (
  select
    r.*,
    greatest(
      0,
      floor(extract(epoch from (now()-r.last_activity_at))/86400)
    )::int as inactive_days
  from company_rollup r
  where r.verified
    and r.last_activity_at is not null
    and (r.conversation_count+r.rfq_count+r.offer_count+r.order_count)>0
),
signals as (
  select
    e.*,
    case
      when e.inactive_days >= p.dormant_days then 'dormant'
      when e.inactive_days >= p.watch_days then 'watch'
      else 'active'
    end as signal_state,
    array_remove(array[
      case when e.order_count>0 then 'historical_orders' end,
      case when e.offer_count>0 then 'historical_offers' end,
      case when e.rfq_count>0 then 'historical_rfqs' end,
      case when e.inactive_days >= p.dormant_days then 'inactive_dormant_threshold'
           when e.inactive_days >= p.watch_days then 'inactive_watch_threshold' end
    ]::text[],null) as reason_codes
  from eligible e
  cross join params p
  where e.inactive_days >= p.watch_days
),
paged as (
  select s.*
  from signals s
  order by
    case when s.order_count>0 then 0 else 1 end,
    s.order_count desc,
    s.offer_count desc,
    s.rfq_count desc,
    s.inactive_days desc,
    s.name,
    s.company_id
  limit (select row_limit from params)
  offset (select row_offset from params)
),
rows as (
  select
    jsonb_build_object(
      'company_id',company_id,
      'name',name,
      'company_type',company_type,
      'country',country,
      'website',website,
      'verified',verified,
      'signal_state',signal_state,
      'inactive_days',inactive_days,
      'last_activity_at',last_activity_at,
      'conversation_count',conversation_count,
      'rfq_count',rfq_count,
      'offer_count',offer_count,
      'order_count',order_count,
      'has_order_history',(order_count>0),
      'reason_codes',to_jsonb(reason_codes),
      'latest_evidence',case when latest_event_id is null then null else jsonb_build_object(
        'event_type',latest_event_type,
        'event_id',latest_event_id,
        'event_at',latest_event_at
      ) end
    ) as value,
    order_count,
    offer_count,
    rfq_count,
    inactive_days,
    name,
    company_id
  from paged
),
summary as (
  select jsonb_build_object(
    'total',count(*),
    'watch',count(*) filter (where signal_state='watch'),
    'dormant',count(*) filter (where signal_state='dormant'),
    'with_order_history',count(*) filter (where order_count>0)
  ) as value
  from signals
)
select jsonb_build_object(
  'summary',(select value from summary),
  'signals',coalesce((
    select jsonb_agg(
      value order by
        case when order_count>0 then 0 else 1 end,
        order_count desc,
        offer_count desc,
        rfq_count desc,
        inactive_days desc,
        name,
        company_id
    )
    from rows
  ),'[]'::jsonb),
  'policy',jsonb_build_object(
    'watch_after_days',(select watch_days from params),
    'dormant_after_days',(select dormant_days from params),
    'verified_companies_only',true,
    'historical_activity_required',true,
    'ranking','order_history_then_offer_count_then_rfq_count_then_inactive_days',
    'predictive_score',false,
    'cross_tenant_data',false
  )
);
$$;

comment on function public.p2_reengagement_signals(uuid,integer,integer,integer,integer) is
  'P2.1 tenant-safe deterministic re-engagement signals for verified commercial companies. Ordered deterministically; no predictive score; explicit watch/dormant thresholds and evidence.';
