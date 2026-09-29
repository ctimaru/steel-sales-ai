-- P5.2 — Marketplace Feed + Countdown
-- Supplier-side free teaser feed over explicit P5.1 demand.
-- No unlock, no response, no exact technical detail, no anonymous buyer identity.

create or replace function private.p5_2_quantity_band(
  p_quantity numeric,
  p_unit text
)
returns text
language plpgsql
immutable
security invoker
set search_path=''
as $function$
begin
  if p_quantity is null or p_quantity<=0 then
    return null;
  end if;

  case lower(p_unit)
    when 't' then
      if p_quantity<1 then return '<1 t'; end if;
      if p_quantity<5 then return '1–5 t'; end if;
      if p_quantity<20 then return '5–20 t'; end if;
      if p_quantity<50 then return '20–50 t'; end if;
      if p_quantity<100 then return '50–100 t'; end if;
      return '100+ t';
    when 'kg' then
      if p_quantity<100 then return '<100 kg'; end if;
      if p_quantity<500 then return '100–500 kg'; end if;
      if p_quantity<1000 then return '500–1.000 kg'; end if;
      if p_quantity<5000 then return '1.000–5.000 kg'; end if;
      return '5.000+ kg';
    when 'm' then
      if p_quantity<100 then return '<100 m'; end if;
      if p_quantity<500 then return '100–500 m'; end if;
      if p_quantity<1000 then return '500–1.000 m'; end if;
      if p_quantity<5000 then return '1.000–5.000 m'; end if;
      return '5.000+ m';
    when 'pcs' then
      if p_quantity<10 then return '<10 pcs'; end if;
      if p_quantity<50 then return '10–50 pcs'; end if;
      if p_quantity<200 then return '50–200 pcs'; end if;
      if p_quantity<1000 then return '200–1.000 pcs'; end if;
      return '1.000+ pcs';
    else
      return null;
  end case;
end;
$function$;

revoke all on function private.p5_2_quantity_band(numeric,text)
from public,anon,authenticated;

create or replace function private.p5_2_require_feed_actor(
  p_viewer_organization_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
begin
  v_user := (select auth.uid());

  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.organization_memberships om
    where om.organization_id=p_viewer_organization_id
      and om.user_id=v_user
      and om.status='active'
  ) then
    raise exception 'active organization membership required' using errcode='42501';
  end if;

  return v_user;
end;
$function$;

revoke all on function private.p5_2_require_feed_actor(uuid)
from public,anon,authenticated;

create or replace function private.p5_2_teaser_item_impl(
  p_request_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
with request_row as (
  select r.*
  from public.marketplace_requests r
  where r.id=p_request_id
    and r.status='published'
    and r.opens_at<=now()
    and r.closes_at>now()
),
buyer as (
  select
    r.id as request_id,
    case
      when r.visibility_mode='anonymous' then
        jsonb_build_object('visibility_mode','anonymous')
      else coalesce((
        select jsonb_build_object(
          'visibility_mode','named',
          'network_company_id',c.id,
          'display_name',coalesce(nullif(btrim(c.trading_name),''),c.legal_name),
          'country_code',c.country_code,
          'verification_status',c.verification_status,
          'claimed_status',c.claimed_status
        )
        from public.organization_network_company_links l
        join public.network_companies c on c.id=l.network_company_id
        where l.organization_id=r.organization_id
          and l.link_status='active'
          and c.publication_status='published'
        limit 1
      ),jsonb_build_object(
        'visibility_mode','named',
        'profile_available',false
      ))
    end as buyer_json
  from request_row r
),
lines as (
  select
    r.id as request_id,
    coalesce(jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'line_number',l.line_number,
        'product_family_key',pf.canonical_key,
        'product_family_name',pf.display_name,
        'manufacturing_process',l.manufacturing_process,
        'quantity_band',private.p5_2_quantity_band(l.quantity,l.quantity_unit),
        'delivery_country_code',l.delivery_country_code,
        'delivery_region',case when r.visibility_mode='named' then l.delivery_region else null end,
        'has_standard',l.standard_id is not null,
        'has_grade',l.material_grade_id is not null,
        'has_dimensions',(
          l.outer_diameter_mm is not null
          or l.width_mm is not null
          or l.height_mm is not null
          or l.thickness_mm is not null
          or l.length_mm is not null
        ),
        'has_certification',l.certification is not null
      ))
      order by l.line_number
    ),'[]'::jsonb) as teaser_lines,
    count(*)::int as line_count
  from request_row r
  join public.marketplace_request_lines l on l.request_id=r.id
  join public.network_product_families pf on pf.id=l.product_family_id
  group by r.id
)
select jsonb_build_object(
  'request_id',r.id,
  'visibility_mode',r.visibility_mode,
  'effective_status',case
    when r.closes_at<=now()+interval '24 hours' then 'closing_soon'
    else 'open'
  end,
  'opens_at',r.opens_at,
  'closes_at',r.closes_at,
  'seconds_remaining',greatest(floor(extract(epoch from (r.closes_at-now())))::bigint,0),
  'buyer',b.buyer_json,
  'line_count',ln.line_count,
  'teaser_lines',ln.teaser_lines
)
from request_row r
join buyer b on b.request_id=r.id
join lines ln on ln.request_id=r.id;
$function$;

revoke all on function private.p5_2_teaser_item_impl(uuid)
from public,anon,authenticated;

create or replace function private.p5_2_marketplace_feed_impl(
  p_viewer_organization_id uuid,
  p_product_keys text[] default null,
  p_country_codes text[] default null,
  p_closing_within_hours integer default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_items jsonb;
  v_total int;
  v_limit int;
  v_offset int;
  v_product_keys text[];
  v_country_codes text[];
begin
  perform private.p5_2_require_feed_actor(p_viewer_organization_id);

  v_limit := least(greatest(coalesce(p_limit,25),1),100);
  v_offset := greatest(coalesce(p_offset,0),0);
  v_product_keys := case
    when p_product_keys is null or cardinality(p_product_keys)=0 then null
    else p_product_keys
  end;
  v_country_codes := case
    when p_country_codes is null or cardinality(p_country_codes)=0 then null
    else (
      select array_agg(upper(btrim(x)))
      from unnest(p_country_codes) x
      where upper(btrim(x)) ~ '^[A-Z]{2}$'
    )
  end;

  if p_closing_within_hours is not null
     and (p_closing_within_hours<1 or p_closing_within_hours>720) then
    raise exception 'closing_within_hours must be between 1 and 720'
      using errcode='22023';
  end if;

  with base as (
    select r.id,r.closes_at,r.published_at
    from public.marketplace_requests r
    where r.status='published'
      and r.opens_at<=now()
      and r.closes_at>now()
      and r.organization_id<>p_viewer_organization_id
      and (
        v_product_keys is null
        or exists (
          select 1
          from public.marketplace_request_lines l
          join public.network_product_families pf on pf.id=l.product_family_id
          where l.request_id=r.id
            and pf.canonical_key=any(v_product_keys)
        )
      )
      and (
        v_country_codes is null
        or exists (
          select 1
          from public.marketplace_request_lines l
          where l.request_id=r.id
            and l.delivery_country_code=any(v_country_codes)
        )
      )
      and (
        p_closing_within_hours is null
        or r.closes_at<=now()+make_interval(hours=>p_closing_within_hours)
      )
  ),
  counted as (
    select count(*)::int as total from base
  ),
  paged as (
    select id,closes_at,published_at
    from base
    order by closes_at asc,published_at desc,id
    limit v_limit offset v_offset
  )
  select
    coalesce(jsonb_agg(private.p5_2_teaser_item_impl(p.id)
      order by p.closes_at asc,p.published_at desc,p.id),'[]'::jsonb),
    (select total from counted)
  into v_items,v_total
  from paged p;

  return jsonb_build_object(
    'contract','P5.2-feed-v1',
    'generated_at',now(),
    'items',coalesce(v_items,'[]'::jsonb),
    'total',coalesce(v_total,0),
    'limit',v_limit,
    'offset',v_offset
  );
end;
$function$;

revoke all on function private.p5_2_marketplace_feed_impl(uuid,text[],text[],integer,integer,integer)
from public,anon;
grant execute on function private.p5_2_marketplace_feed_impl(uuid,text[],text[],integer,integer,integer)
to authenticated,service_role;

create or replace function public.p5_2_marketplace_feed(
  p_viewer_organization_id uuid,
  p_product_keys text[] default null,
  p_country_codes text[] default null,
  p_closing_within_hours integer default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_2_marketplace_feed_impl(
    p_viewer_organization_id,
    p_product_keys,
    p_country_codes,
    p_closing_within_hours,
    p_limit,
    p_offset
  );
$function$;

revoke all on function public.p5_2_marketplace_feed(uuid,text[],text[],integer,integer,integer)
from public,anon;
grant execute on function public.p5_2_marketplace_feed(uuid,text[],text[],integer,integer,integer)
to authenticated,service_role;

create or replace function private.p5_2_marketplace_teaser_impl(
  p_viewer_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_item jsonb;
begin
  perform private.p5_2_require_feed_actor(p_viewer_organization_id);

  if not exists (
    select 1
    from public.marketplace_requests r
    where r.id=p_request_id
      and r.status='published'
      and r.opens_at<=now()
      and r.closes_at>now()
      and r.organization_id<>p_viewer_organization_id
  ) then
    return null;
  end if;

  v_item := private.p5_2_teaser_item_impl(p_request_id);
  return v_item;
end;
$function$;

revoke all on function private.p5_2_marketplace_teaser_impl(uuid,uuid)
from public,anon;
grant execute on function private.p5_2_marketplace_teaser_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p5_2_marketplace_teaser(
  p_viewer_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_2_marketplace_teaser_impl(
    p_viewer_organization_id,
    p_request_id
  );
$function$;

revoke all on function public.p5_2_marketplace_teaser(uuid,uuid)
from public,anon;
grant execute on function public.p5_2_marketplace_teaser(uuid,uuid)
to authenticated,service_role;

-- P5.2 hardening: a Named request may only become supplier-visible when it
-- has an active, published Network Company identity. Anonymous listings do
-- not require a public Company Profile.
create or replace function private.p5_1_publish_request_impl(
  p_request_id uuid,
  p_closes_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_request public.marketplace_requests%rowtype;
  v_user uuid;
  v_line_count int;
  v_now timestamptz := now();
begin
  select * into v_request
  from public.marketplace_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'marketplace request not found' using errcode='P0002';
  end if;

  v_user := private.p5_1_require_actor(v_request.organization_id,true);

  if v_request.status<>'draft' then
    raise exception 'only draft marketplace requests can be published' using errcode='22023';
  end if;

  select count(*)::int into v_line_count
  from public.marketplace_request_lines
  where request_id=p_request_id;

  if v_line_count<1 then
    raise exception 'marketplace request requires at least one product line' using errcode='22023';
  end if;

  if p_closes_at is null
     or p_closes_at<v_now+interval '1 hour'
     or p_closes_at>v_now+interval '30 days' then
    raise exception 'marketplace close time must be between 1 hour and 30 days from now'
      using errcode='22023';
  end if;

  if v_request.visibility_mode='named'
     and not exists (
       select 1
       from public.organization_network_company_links l
       join public.network_companies c on c.id=l.network_company_id
       where l.organization_id=v_request.organization_id
         and l.link_status='active'
         and c.publication_status='published'
     ) then
    raise exception 'named Marketplace publication requires an active published Network Company profile'
      using errcode='22023';
  end if;

  update public.marketplace_requests
  set
    status='published',
    opens_at=v_now,
    closes_at=p_closes_at,
    published_at=v_now
  where id=p_request_id;

  perform private.p5_1_record_event(
    p_request_id,'published',v_user,v_request.organization_id,
    jsonb_build_object(
      'visibility_mode',v_request.visibility_mode,
      'line_count',v_line_count,
      'closes_at',p_closes_at
    )
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status','published',
    'opens_at',v_now,
    'closes_at',p_closes_at,
    'visibility_mode',v_request.visibility_mode,
    'line_count',v_line_count
  );
end;
$function$;

revoke all on function private.p5_1_publish_request_impl(uuid,timestamptz)
from public,anon;
grant execute on function private.p5_1_publish_request_impl(uuid,timestamptz)
to authenticated,service_role;

comment on function public.p5_2_marketplace_feed(uuid,text[],text[],integer,integer,integer) is
  'P5.2 authenticated cross-organization Marketplace free teaser feed. Returns only open explicit Marketplace demand; excludes exact technical details and anonymous buyer identity.';
comment on function public.p5_2_marketplace_teaser(uuid,uuid) is
  'P5.2 authenticated privacy-safe Marketplace teaser detail. Anonymous requests never expose buyer organization or Network identity.';
comment on function private.p5_2_quantity_band(numeric,text) is
  'P5.2 lossy quantity banding used to avoid exposing exact buyer quantity in the free teaser.';
