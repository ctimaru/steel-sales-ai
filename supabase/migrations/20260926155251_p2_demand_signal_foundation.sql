create or replace function public.p2_demand_signals(
  p_organization_id uuid,
  p_window_days integer default 30,
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
    case when coalesce(p_window_days,30)=90 then 90 else 30 end::int as window_days,
    greatest(1,least(coalesce(p_limit,100),500))::int as row_limit,
    greatest(0,coalesce(p_offset,0))::int as row_offset
),
access_check as (
  select public.is_organization_member(p_organization_id,false) as allowed
),
base as (
  select
    rl.id as rfq_line_id,
    r.id as rfq_id,
    r.company_id,
    c.name as company_name,
    r.requested_at,
    rl.canonical_product_id,
    rl.canonical_product_key,
    rl.requested_quantity,
    nullif(upper(btrim(coalesce(rl.quantity_unit,''))),'') as quantity_unit,
    rl.raw_spec_text,
    rl.requested_grade,
    rl.requested_standard
  from public.rfq_lines rl
  join public.rfqs r
    on r.organization_id=rl.organization_id
   and r.id=rl.rfq_id
  left join public.companies c
    on c.organization_id=r.organization_id
   and c.id=r.company_id
  cross join params p
  where rl.organization_id=p_organization_id
    and (select allowed from access_check)
    and rl.canonical_product_id is not null
    and r.requested_at is not null
    and r.requested_at >= now()-make_interval(days => p.window_days)
),
repeated_groups as (
  select
    'repeated_account'::text as signal_type,
    b.canonical_product_id,
    max(b.canonical_product_key) as canonical_product_key,
    b.company_id,
    max(b.company_name) as company_name,
    count(distinct b.rfq_id)::int as distinct_rfq_count,
    count(distinct b.company_id)::int as distinct_company_count,
    min(b.requested_at) as first_requested_at,
    max(b.requested_at) as latest_requested_at
  from base b
  where b.company_id is not null
  group by b.canonical_product_id,b.company_id
  having count(distinct b.rfq_id)>=2
),
multi_groups as (
  select
    'multi_account'::text as signal_type,
    b.canonical_product_id,
    max(b.canonical_product_key) as canonical_product_key,
    null::uuid as company_id,
    null::text as company_name,
    count(distinct b.rfq_id)::int as distinct_rfq_count,
    count(distinct b.company_id)::int as distinct_company_count,
    min(b.requested_at) as first_requested_at,
    max(b.requested_at) as latest_requested_at
  from base b
  where b.company_id is not null
  group by b.canonical_product_id
  having count(distinct b.company_id)>=2
),
signals as (
  select * from repeated_groups
  union all
  select * from multi_groups
),
enriched as (
  select
    s.*,
    coalesce(
      (
        select b.raw_spec_text
        from base b
        where b.canonical_product_id=s.canonical_product_id
          and (
            (s.signal_type='repeated_account' and b.company_id=s.company_id)
            or (s.signal_type='multi_account' and b.company_id is not null)
          )
          and nullif(btrim(coalesce(b.raw_spec_text,'')),'') is not null
        order by b.requested_at desc,b.rfq_line_id
        limit 1
      ),
      s.canonical_product_key,
      s.canonical_product_id::text
    ) as product_label,
    coalesce(
      (
        select jsonb_agg(q.value order by q.unit)
        from (
          select
            b.quantity_unit as unit,
            jsonb_build_object(
              'unit',b.quantity_unit,
              'total_quantity',sum(b.requested_quantity),
              'line_count',count(*)::int
            ) as value
          from base b
          where b.canonical_product_id=s.canonical_product_id
            and (
              (s.signal_type='repeated_account' and b.company_id=s.company_id)
              or (s.signal_type='multi_account' and b.company_id is not null)
            )
            and b.requested_quantity is not null
            and b.quantity_unit is not null
          group by b.quantity_unit
        ) q
      ),
      '[]'::jsonb
    ) as quantity_summaries,
    coalesce(
      (
        select jsonb_agg(e.value order by e.requested_at desc,e.rfq_line_id)
        from (
          select
            b.requested_at,
            b.rfq_line_id,
            jsonb_build_object(
              'rfq_id',b.rfq_id,
              'rfq_line_id',b.rfq_line_id,
              'company_id',b.company_id,
              'company_name',b.company_name,
              'requested_at',b.requested_at,
              'raw_spec_text',b.raw_spec_text,
              'requested_grade',b.requested_grade,
              'requested_standard',b.requested_standard,
              'requested_quantity',b.requested_quantity,
              'quantity_unit',b.quantity_unit
            ) as value
          from base b
          where b.canonical_product_id=s.canonical_product_id
            and (
              (s.signal_type='repeated_account' and b.company_id=s.company_id)
              or (s.signal_type='multi_account' and b.company_id is not null)
            )
          order by b.requested_at desc,b.rfq_line_id
          limit 8
        ) e
      ),
      '[]'::jsonb
    ) as evidence,
    coalesce(
      (
        select jsonb_agg(x.company_name order by x.company_name)
        from (
          select distinct b.company_name
          from base b
          where b.canonical_product_id=s.canonical_product_id
            and b.company_id is not null
            and (
              s.signal_type='multi_account'
              or b.company_id=s.company_id
            )
            and b.company_name is not null
        ) x
      ),
      '[]'::jsonb
    ) as company_names
  from signals s
),
paged as (
  select e.*
  from enriched e
  order by
    case when e.signal_type='multi_account' then 0 else 1 end,
    e.distinct_company_count desc,
    e.distinct_rfq_count desc,
    e.latest_requested_at desc,
    e.canonical_product_key,
    e.company_name nulls last,
    e.canonical_product_id
  limit (select row_limit from params)
  offset (select row_offset from params)
),
rows as (
  select
    jsonb_build_object(
      'signal_type',signal_type,
      'canonical_product_id',canonical_product_id,
      'canonical_product_key',canonical_product_key,
      'product_label',product_label,
      'company_id',company_id,
      'company_name',company_name,
      'company_names',company_names,
      'distinct_rfq_count',distinct_rfq_count,
      'distinct_company_count',distinct_company_count,
      'first_requested_at',first_requested_at,
      'latest_requested_at',latest_requested_at,
      'quantity_summaries',quantity_summaries,
      'evidence',evidence
    ) as value,
    signal_type,
    distinct_company_count,
    distinct_rfq_count,
    latest_requested_at,
    canonical_product_key,
    company_name,
    canonical_product_id
  from paged
),
summary as (
  select jsonb_build_object(
    'normalized_line_count',(select count(*) from base),
    'distinct_rfq_count',(select count(distinct rfq_id) from base),
    'distinct_product_count',(select count(distinct canonical_product_id) from base),
    'attributed_line_count',(select count(*) from base where company_id is not null),
    'unattributed_line_count',(select count(*) from base where company_id is null),
    'attributed_rfq_count',(select count(distinct rfq_id) from base where company_id is not null),
    'unattributed_rfq_count',(select count(distinct rfq_id) from base where company_id is null),
    'distinct_company_count',(select count(distinct company_id) from base where company_id is not null),
    'signal_count',(select count(*) from signals),
    'repeated_account_signal_count',(select count(*) from signals where signal_type='repeated_account'),
    'multi_account_signal_count',(select count(*) from signals where signal_type='multi_account'),
    'first_requested_at',(select min(requested_at) from base),
    'latest_requested_at',(select max(requested_at) from base)
  ) as value
)
select jsonb_build_object(
  'summary',(select value from summary),
  'signals',coalesce((
    select jsonb_agg(
      value order by
        case when signal_type='multi_account' then 0 else 1 end,
        distinct_company_count desc,
        distinct_rfq_count desc,
        latest_requested_at desc,
        canonical_product_key,
        company_name nulls last,
        canonical_product_id
    )
    from rows
  ),'[]'::jsonb),
  'policy',jsonb_build_object(
    'window_days',(select window_days from params),
    'supported_windows',jsonb_build_array(30,90),
    'canonical_product_required',true,
    'company_attribution_required_for_signals',true,
    'repeated_account_min_distinct_rfqs',2,
    'multi_account_min_distinct_companies',2,
    'quantity_aggregation','per_unit_only',
    'predictive_score',false,
    'external_market_data',false,
    'cross_tenant_benchmark',false,
    'language','account_demand_or_multi_account_demand'
  )
);
$$;

revoke all on function public.p2_demand_signals(uuid,integer,integer,integer)
  from public,anon;
grant execute on function public.p2_demand_signals(uuid,integer,integer,integer)
  to authenticated,service_role;

comment on function public.p2_demand_signals(uuid,integer,integer,integer) is
  'P2.2 tenant-safe deterministic RFQ demand signals. Canonical product and company attribution gates; 30/90-day windows; quantities aggregated per unit only; no predictive or external market scoring.';
