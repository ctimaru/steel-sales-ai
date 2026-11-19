-- COMM-CLIENTS1 (founder decision and authorization, 19 Nov 2026): «Aziende»
-- in Ufficio commerciale becomes «Clienti», with two lists:
--   · clients   = companies with at least one order that is not cancelled
--   · prospects = companies with requests (RDO) or offers but no valid order
-- Companies that only exchanged emails are no longer listed here: they stay
-- searchable in «Cerca nello storico». The Network lists (saved, connected)
-- live in the Network and in Fornitori.
--
-- New read-only function; public.p1_company_directory is unchanged.
-- SECURITY INVOKER: every read goes through the caller's RLS. No email text,
-- free-text remarks or prices are read: only names, identity fields, counts and dates.

create or replace function public.comm_clients1_directory(
  p_organization_id uuid,
  p_segment text default 'clients',
  p_query text default '',
  p_limit integer default 50,
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
    case when p_segment = 'prospects' then 'prospects' else 'clients' end as segment,
    -- Literal search: LIKE wildcards in the user's text are escaped.
    nullif(regexp_replace(left(btrim(coalesce(p_query, '')), 80), '([\\%_])', '\\\1', 'g'), '') as needle,
    least(greatest(coalesce(p_limit, 50), 1), 100) as page_size,
    least(greatest(coalesce(p_offset, 0), 0), 20000) as page_offset,
    public.is_organization_member(p_organization_id, false) as allowed
),
r as (
  select x.company_id, count(*)::int as n, max(coalesce(x.requested_at, x.created_at)) as last_at
  from public.rfqs x
  where x.organization_id = p_organization_id and x.company_id is not null
  group by x.company_id
),
o as (
  select x.company_id, count(*)::int as n, max(coalesce(x.offered_at, x.created_at)) as last_at
  from public.offers x
  where x.organization_id = p_organization_id and x.company_id is not null
  group by x.company_id
),
ord as (
  select x.company_id,
    count(*)::int as n,
    count(*) filter (where coalesce(x.status, '') <> 'cancelled')::int as valid_n,
    max(coalesce(x.ordered_at, x.created_at)) filter (where coalesce(x.status, '') <> 'cancelled') as last_order_at,
    max(coalesce(x.ordered_at, x.created_at)) as last_at
  from public.orders x
  where x.organization_id = p_organization_id and x.company_id is not null
  group by x.company_id
),
base as (
  select
    c.id, c.name, c.company_type, c.country, c.vat_number_normalized, c.website,
    coalesce(r.n, 0) as rfq_count,
    coalesce(o.n, 0) as offer_count,
    coalesce(ord.valid_n, 0) as order_count,
    ord.last_order_at,
    -- greatest() ignores nulls.
    greatest(r.last_at, o.last_at, ord.last_at) as last_activity_at,
    case when coalesce(ord.valid_n, 0) > 0 then 'clients' else 'prospects' end as segment
  from public.companies c
  cross join params p
  left join r on r.company_id = c.id
  left join o on o.company_id = c.id
  left join ord on ord.company_id = c.id
  where c.organization_id = p_organization_id
    and p.allowed
    and (r.n is not null or o.n is not null or ord.n is not null)
),
matching as (
  select b.*
  from base b
  cross join params p
  where p.needle is null
    or b.name ilike '%' || p.needle || '%'
    or coalesce(b.vat_number_normalized, '') ilike '%' || replace(upper(p.needle), ' ', '') || '%'
    or coalesce(b.country, '') ilike '%' || p.needle || '%'
),
page as (
  select m.*
  from matching m
  cross join params p
  where m.segment = p.segment
  order by
    case when p.segment = 'clients' then m.last_order_at end desc nulls last,
    m.last_activity_at desc nulls last,
    m.name, m.id
  limit (select page_size from params)
  offset (select page_offset from params)
)
select jsonb_build_object(
  'contract', 'comm-clients1-v1',
  'segment', (select segment from params),
  'total', (select count(*) from matching m cross join params p where m.segment = p.segment),
  'counts', jsonb_build_object(
    'clients', (select count(*) from matching where segment = 'clients'),
    'prospects', (select count(*) from matching where segment = 'prospects')
  ),
  'companies', coalesce((
    select jsonb_agg(jsonb_build_object(
      'company_id', pg.id,
      'name', pg.name,
      'company_type', pg.company_type,
      'country', pg.country,
      'vat_number', pg.vat_number_normalized,
      'website', pg.website,
      'verified', exists (
        select 1 from public.commercial_company_identity_verifications v
        where v.organization_id = p_organization_id and v.company_id = pg.id
      ),
      'rfq_count', pg.rfq_count,
      'offer_count', pg.offer_count,
      'order_count', pg.order_count,
      'last_order_at', pg.last_order_at,
      'last_activity_at', pg.last_activity_at
    ) order by pg.last_order_at desc nulls last, pg.last_activity_at desc nulls last, pg.name, pg.id)
    from page pg
  ), '[]'::jsonb)
);
$$;

comment on function public.comm_clients1_directory(uuid, text, text, integer, integer) is
  'COMM-CLIENTS1: read-only, RLS-scoped list of clients (valid orders) and prospects (requests or offers, no valid order).';

revoke all on function public.comm_clients1_directory(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.comm_clients1_directory(uuid, text, text, integer, integer) to authenticated, service_role;
