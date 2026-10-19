-- COMMERCIAL-UNIFY2C.3: one entity = one result. Read-only, caller RLS.
-- Replaces line-level paging of incoming requests with bounded entity search.
-- The same invoker facade searches customer names and technical line content in
-- inbound RFQs, offers and orders without joining multiple lines into duplicates.

create or replace function public.commercial_unify_entity_search_v1(
  p_organization_id uuid,
  p_source text,
  p_query text default '',
  p_limit integer default 30,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with
  params as (
    select
      left(pg_catalog.btrim(coalesce(p_query,'')),80) as q,
      '%' || pg_catalog.regexp_replace(
        left(pg_catalog.btrim(coalesce(p_query,'')),80), '[%_(),"]', ' ', 'g'
      ) || '%' as pattern,
      greatest(1,least(coalesce(p_limit,30),31)) as take,
      greatest(0,least(coalesce(p_offset,0),100000)) as skip
  ),
  membership as (
    select exists(
      select 1 from public.organization_memberships m
      where m.organization_id=p_organization_id
        and m.user_id=(select auth.uid())
        and m.status='active'
    ) as allowed
  ),
  matching as (
    select 'rfqs'::text as kind, r.id, r.status, r.created_at,
           coalesce(c.name,'')::text as company_name
    from public.rfqs r
    left join public.companies c on c.id=r.company_id
      and c.organization_id=r.organization_id
    cross join params p
    cross join membership m
    where p_source='rfqs' and m.allowed and r.organization_id=p_organization_id
      and (
        p.q='' or r.status ilike p.pattern or c.name ilike p.pattern or
        exists(
          select 1 from public.rfq_lines l
          where l.organization_id=r.organization_id and l.rfq_id=r.id
            and (
              l.canonical_product_key ilike p.pattern
              or l.raw_spec_text ilike p.pattern
              or l.requested_grade ilike p.pattern
              or l.requested_standard ilike p.pattern
              or l.notes ilike p.pattern
            )
        )
      )
    union all
    select 'offers', o.id, o.status, o.created_at,
           coalesce(c.name,'')::text
    from public.offers o
    left join public.companies c on c.id=o.company_id
      and c.organization_id=o.organization_id
    cross join params p
    cross join membership m
    where p_source='offers' and m.allowed and o.organization_id=p_organization_id
      and (
        p.q='' or o.status ilike p.pattern or c.name ilike p.pattern or
        exists(
          select 1 from public.offer_lines l
          where l.organization_id=o.organization_id and l.offer_id=o.id
            and (
              l.canonical_product_key ilike p.pattern
              or l.raw_spec_text ilike p.pattern
              or l.source_text ilike p.pattern
            )
        )
      )
    union all
    select 'orders', o.id, o.status, o.created_at,
           coalesce(c.name,'')::text
    from public.orders o
    left join public.companies c on c.id=o.company_id
      and c.organization_id=o.organization_id
    cross join params p
    cross join membership m
    where p_source='orders' and m.allowed and o.organization_id=p_organization_id
      and (
        p.q='' or o.status ilike p.pattern or o.customer_order_ref ilike p.pattern
        or c.name ilike p.pattern or
        exists(
          select 1 from public.order_lines l
          where l.organization_id=o.organization_id and l.order_id=o.id
            and (
              l.canonical_product_key ilike p.pattern
              or l.raw_spec_text ilike p.pattern
            )
        )
      )
  ),
  page as (
    select kind,id,status,created_at,company_name
    from matching
    order by created_at desc nulls last, id desc
    limit (select take from params)
    offset (select skip from params)
  ),
  decorated as (
    select p.kind,p.id,p.status,p.created_at,p.company_name,
      case p.kind
        when 'rfqs' then (
          select coalesce(nullif(l.raw_spec_text,''),nullif(l.canonical_product_key,''),
                   nullif(l.requested_grade,''),nullif(l.requested_standard,''))
          from public.rfq_lines l
          where l.rfq_id=p.id and l.organization_id=p_organization_id
          order by l.created_at asc,l.id asc limit 1
        )
        when 'offers' then (
          select coalesce(nullif(l.raw_spec_text,''),nullif(l.canonical_product_key,''))
          from public.offer_lines l
          where l.offer_id=p.id and l.organization_id=p_organization_id
          order by l.created_at asc,l.id asc limit 1
        )
        else (
          select coalesce(nullif(l.raw_spec_text,''),nullif(l.canonical_product_key,''))
          from public.order_lines l
          where l.order_id=p.id and l.organization_id=p_organization_id
          order by l.created_at asc,l.id asc limit 1
        )
      end as product_preview
    from page p
  )
  select case
    when p_organization_id is null or p_source not in ('rfqs','offers','orders')
      or p_offset is null or p_offset < 0 or p_offset > 100000
      or p_limit is null or p_limit < 1 or p_limit > 31
    then pg_catalog.jsonb_build_object('error','invalid_arguments')
    else pg_catalog.jsonb_build_object(
      'total',(select count(*) from matching),
      'rows',coalesce(
        (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d)
          order by d.created_at desc nulls last, d.id desc) from decorated d),
        '[]'::jsonb
      )
    )
  end
$function$;

revoke all on function public.commercial_unify_entity_search_v1(uuid,text,text,integer,integer)
  from public,anon;
grant execute on function public.commercial_unify_entity_search_v1(uuid,text,text,integer,integer)
  to authenticated;

comment on function public.commercial_unify_entity_search_v1(uuid,text,text,integer,integer)
is 'SECURITY INVOKER, membership + table RLS; paged entity search by company, status and steel line; bounded 31 rows. No mutation or price disclosure.';
