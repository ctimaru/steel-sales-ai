-- COMM-CYCLE1 (founder decisions, 19 Nov 2026): same priority index as
-- 20261117120000_comm_deals2_priority_index.sql, one rule added and mirrored in
-- lib/commercial-deal-model.ts: a sent offer whose valid_until is past is «todo»
-- («Offerta scaduta: rinnova o chiudi»), not «waiting». Everything else unchanged.

create or replace function public.comm_deals2_index(
  p_organization_id uuid,
  p_segment text default 'all',
  p_filter text default '',
  p_query text default '',
  p_limit integer default 20,
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
    case when p_segment in ('sales', 'purchase') then p_segment else 'all' end as segment,
    case when p_filter in ('todo', 'waiting', 'due', 'drafts', 'closed') then p_filter else '' end as filter_key,
    -- Literal search: LIKE wildcards in the user's text are escaped.
    nullif(regexp_replace(left(btrim(coalesce(p_query, '')), 80), '([\\%_])', '\\\1', 'g'), '') as needle,
    least(greatest(coalesce(p_limit, 20), 1), 50) as page_size,
    least(greatest(coalesce(p_offset, 0), 0), 10000) as page_offset,
    now() + interval '7 days' as due_limit
),

-- ── Sales: customer request + offers + orders (via rfq_id) ──────────────────
sales_rfq as (
  select
    'inbound-rfq:' || r.id::text as key, 'inbound-rfq'::text as kind, 'sales'::text as side, r.id,
    r.status as anchor_status, r.due_at,
    lo.status as order_status, lf.status as offer_status, lf.valid_until as offer_valid_until,
    greatest(r.created_at, mo.max_at, mf.max_at) as at,
    concat_ws(' ', r.deal_label, cmp.name, 'RDO-' || upper(left(replace(r.id::text, '-', ''), 6)),
      lo.customer_order_ref, mf.labels, ln.specs) as haystack
  from public.rfqs r
  left join public.companies cmp on cmp.id = r.company_id
  left join lateral (
    select o.status, o.customer_order_ref from public.orders o
    where o.rfq_id = r.id order by o.created_at desc, o.id desc limit 1
  ) lo on true
  left join lateral (
    select f.status, f.valid_until from public.offers f
    where f.rfq_id = r.id order by f.created_at desc, f.id desc limit 1
  ) lf on true
  left join lateral (select max(o.created_at) as max_at from public.orders o where o.rfq_id = r.id) mo on true
  left join lateral (
    select max(f.created_at) as max_at, string_agg(f.deal_label, ' ') as labels
    from public.offers f where f.rfq_id = r.id
  ) mf on true
  left join lateral (
    select string_agg(concat_ws(' ', l.requested_standard, l.requested_grade), ' ') as specs
    from public.rfq_lines l where l.rfq_id = r.id
  ) ln on true
  where r.organization_id = p_organization_id
),
sales_offer as (
  -- Offers without a customer request start their own deal, with their orders.
  select
    'inbound-offer:' || f.id::text, 'inbound-offer', 'sales', f.id,
    null::text, null::timestamptz,
    lo.status, f.status, f.valid_until,
    greatest(f.created_at, mo.max_at),
    concat_ws(' ', f.deal_label, cmp.name, 'RDO-' || upper(left(replace(f.id::text, '-', ''), 6)), lo.customer_order_ref)
  from public.offers f
  left join public.companies cmp on cmp.id = f.company_id
  left join lateral (
    select o.status, o.customer_order_ref from public.orders o
    where o.offer_id = f.id order by o.created_at desc, o.id desc limit 1
  ) lo on true
  left join lateral (select max(o.created_at) as max_at from public.orders o where o.offer_id = f.id) mo on true
  where f.organization_id = p_organization_id and f.rfq_id is null
),
sales_order as (
  -- Orders with neither request nor offer: a deal of their own.
  select
    'inbound-order:' || o.id::text, 'inbound-order', 'sales', o.id,
    null::text, null::timestamptz,
    o.status, null::text, null::date,
    o.created_at,
    concat_ws(' ', o.deal_label, cmp.name, 'RDO-' || upper(left(replace(o.id::text, '-', ''), 6)), o.customer_order_ref)
  from public.orders o
  left join public.companies cmp on cmp.id = o.company_id
  where o.organization_id = p_organization_id and o.rfq_id is null and o.offer_id is null
),
sales_raw as (
  select * from sales_rfq union all select * from sales_offer union all select * from sales_order
),
sales as (
  select s.key, s.kind, s.side, s.id, s.due_at, s.at, s.haystack,
    case
      -- A request closed by hand closes the deal, unless an order is still running
      -- or a received order still waits for confirmation.
      when s.anchor_status in ('closed_won', 'closed_lost', 'cancelled')
        and s.order_status is distinct from 'received'
        and not (s.order_status is not null and s.order_status not in ('received', 'delivered', 'cancelled'))
        then 'closed'
      when s.order_status is not null then case s.order_status
        when 'received' then 'todo' when 'delivered' then 'closed' when 'cancelled' then 'closed'
        else 'progress' end
      -- COMM-CYCLE1: a sent offer past its validity waits for us, not for the customer.
      when s.offer_status = 'sent' and s.offer_valid_until is not null and s.offer_valid_until < current_date then 'todo'
      when s.offer_status is not null then case s.offer_status
        when 'draft' then 'todo' when 'sent' then 'waiting' when 'accepted' then 'todo'
        when 'expired' then 'todo' else 'closed' end
      else case s.anchor_status
        when 'quoted' then 'waiting'
        when 'closed_won' then 'closed' when 'closed_lost' then 'closed' when 'cancelled' then 'closed'
        else 'todo' end
    end as bucket
  from sales_raw s
),

-- ── Purchase: RFQ to suppliers + suppliers, responses and purchase orders ───
purchase as (
  select
    'campaign:' || c.id::text as key, 'campaign'::text as kind, 'purchase'::text as side, c.id,
    case when c.status in ('closed', 'cancelled') then null else c.due_at end as due_at,
    greatest(c.created_at, q.max_at, po.max_at) as at,
    concat_ws(' ', c.title, 'RFQ-' || upper(left(replace(c.id::text, '-', ''), 6)), po.names) as haystack,
    case
      when c.status in ('draft', 'ready') then 'drafts'
      when c.status in ('launched', 'collecting') then case when coalesce(q.responded, 0) > 0 then 'todo' else 'waiting' end
      when c.status = 'awarded' then case
        when coalesce(po.open_count, 0) = 0 or po.has_draft then 'todo'
        when po.has_change then 'todo'
        when po.has_issued then 'waiting'
        else 'progress' end
      else 'closed'
    end as bucket
  from public.buyer_rfq_campaigns c
  left join lateral (
    select count(distinct coalesce(x.supplier_id::text, x.id::text)) as responded,
      max(coalesce(x.submitted_at, x.created_at)) as max_at
    from public.buyer_rfq_quotes x where x.rfq_id = c.id and x.status = 'submitted'
  ) q on true
  left join lateral (
    select
      count(*) filter (where p.status <> 'cancelled') as open_count,
      coalesce(bool_or(p.status = 'draft'), false) as has_draft,
      coalesce(bool_or(p.status in ('change_requested', 'supplier_rejected')), false) as has_change,
      coalesce(bool_or(p.status = 'issued'), false) as has_issued,
      max(p.created_at) as max_at,
      string_agg(p.supplier_name_snapshot, ' ') filter (where p.status <> 'cancelled') as names
    from public.buyer_purchase_order_drafts p where p.rfq_id = c.id
  ) po on true
  where c.organization_id = p_organization_id
),

-- ── Saved bills of material never used by an RFQ: drafts only ───────────────
distinte as (
  select 'distinta:' || d.id::text as key, 'distinta'::text as kind, 'purchase'::text as side, d.id,
    null::timestamptz as due_at, d.created_at as at, coalesce(d.title, '') as haystack, 'drafts'::text as bucket
  from public.buyer_distintas d
  where d.organization_id = p_organization_id
    and not exists (select 1 from public.buyer_rfq_campaigns c where c.source_distinta_id = d.id)
),

deals as (
  select a.*,
    (a.bucket <> 'closed' and a.due_at is not null and a.due_at <= (select due_limit from params)) as is_due
  from (
    select key, kind, side, id, due_at, at, haystack, bucket from sales
    union all select key, kind, side, id, due_at, at, haystack, bucket from purchase
    union all select key, kind, side, id, due_at, at, haystack, bucket from distinte
  ) a
),
ranked as (
  select d.*,
    case d.bucket
      when 'todo' then case when d.is_due then 0 else 1 end
      when 'waiting' then case when d.is_due then 2 else 4 end
      when 'drafts' then 3
      when 'progress' then 5
      else 6
    end as urgency
  from deals d
),
visible as (
  select r.* from ranked r, params p
  where (p.segment = 'all' or r.side = p.segment)
    and (r.kind <> 'distinta' or p.filter_key = 'drafts')
    and (p.filter_key = '' or (p.filter_key = 'due' and r.is_due) or (p.filter_key not in ('', 'due') and r.bucket = p.filter_key))
    and (p.needle is null or r.haystack ilike '%' || p.needle || '%')
),
page as (
  select v.key, v.kind, v.id, v.bucket, v.urgency,
    row_number() over (order by v.urgency, case when v.is_due then v.due_at end asc nulls last,
      v.at desc nulls last, v.key) as pos
  from visible v
),
in_segment as (
  select r.* from ranked r, params p where p.segment = 'all' or r.side = p.segment
)
select jsonb_build_object(
  'contract', 'comm-deals2-v1',
  'total', (select count(*) from visible),
  'keys', coalesce((
    select jsonb_agg(jsonb_build_object('key', pg.key, 'kind', pg.kind, 'id', pg.id) order by pg.pos)
    from page pg, params p
    where pg.pos > p.page_offset and pg.pos <= p.page_offset + p.page_size
  ), '[]'::jsonb),
  'counts', jsonb_build_object(
    'segments', jsonb_build_object(
      'all', (select count(*) from ranked where bucket <> 'closed' and kind <> 'distinta'),
      'sales', (select count(*) from ranked where side = 'sales' and bucket <> 'closed'),
      'purchase', (select count(*) from ranked where side = 'purchase' and bucket <> 'closed' and kind <> 'distinta')
    ),
    'filters', jsonb_build_object(
      'todo', (select count(*) from in_segment where bucket = 'todo'),
      'waiting', (select count(*) from in_segment where bucket = 'waiting'),
      'due', (select count(*) from in_segment where is_due),
      'drafts', (select count(*) from in_segment where bucket = 'drafts'),
      'closed', (select count(*) from in_segment where bucket = 'closed')
    )
  )
);
$$;

comment on function public.comm_deals2_index(uuid, text, text, text, integer, integer) is
  'COMM-DEALS2: read-only, RLS-scoped priority index of Commerciale deals (one row per deal). Mirrors lib/commercial-deal-model.ts.';

revoke all on function public.comm_deals2_index(uuid, text, text, text, integer, integer) from public, anon;
grant execute on function public.comm_deals2_index(uuid, text, text, text, integer, integer) to authenticated, service_role;

-- The lateral lookups use existing indexes: offers_rfq_id_idx, orders_offer_id_idx,
-- idx_rfq_lines_rfq, buyer_rfq_quotes_rfq_supplier_idx,
-- buyer_purchase_order_drafts_rfq_idx, buyer_rfq_campaigns_source_distinta_idx.
