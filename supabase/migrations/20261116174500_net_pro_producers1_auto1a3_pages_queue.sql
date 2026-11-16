-- NET-PRO-PRODUCERS1.AUTO1.A.3 — first-party product/catalog pages.
-- Keep the existing homepage queue. Page-specific provenance, hash, lease and
-- consent to crawl are independent. No PDF copying, exact SKU claims or new SKU.
alter table private.network_producer_auto1_sources
  add column if not exists product_discovery_sha256 text
    check (product_discovery_sha256 ~ '^[a-f0-9]{64}$'),
  add column if not exists product_discovery_at timestamptz;

alter table private.network_producer_auto1_candidates
 drop constraint if exists network_producer_auto1_candidates_evidence_status_check;
alter table private.network_producer_auto1_candidates
 add constraint network_producer_auto1_candidates_evidence_status_check
 check (evidence_status in ('pending_verification','pending_page_verification','rejected','confirmed'));

create table if not exists private.network_producer_auto1_product_pages (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references private.network_producer_auto1_sources(company_id) on delete cascade,
 source_url text not null check (
    source_url ~ '^https://[A-Za-z0-9.-]+/[A-Za-z0-9._~/%-]+$'
    and length(source_url) between 14 and 1200
 ),
 root_source_url text not null,
 root_sha256 text not null check (root_sha256 ~ '^[a-f0-9]{64}$'),
 canonical_domain text not null,
 page_kind text not null check (page_kind in ('products','catalog','standards')),
 status text not null default 'queued'
  check (status in ('queued','leased','processed','unchanged','candidate_review','blocked','failed')),
 last_sha256 text check (last_sha256 ~ '^[a-f0-9]{64}$'),
 last_etag text check (length(last_etag)<=200),
 last_modified text check (length(last_modified)<=200),
 last_checked_at timestamptz,
 next_check_at timestamptz not null default now(),
 leased_until timestamptz,
 attempt_count int not null default 0 check (attempt_count between 0 and 10000),
 last_error text check (length(last_error)<=220),
 discovered_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(company_id,source_url)
);
alter table private.network_producer_auto1_product_pages enable row level security;
revoke all on private.network_producer_auto1_product_pages from public,anon,authenticated;
create index if not exists network_producer_auto1a3_due
 on private.network_producer_auto1_product_pages(status,next_check_at)
 where status in ('queued','leased','processed','unchanged','candidate_review','failed');
create index if not exists network_producer_auto1a3_company
 on private.network_producer_auto1_product_pages(company_id);

-- Current homepage snapshot is the only authority for suggested links.
-- Invalid/foreign links cause a transaction failure, not a partial grant.
create or replace function private.netproducers1_auto1a3_discover(
 p_company_id uuid,p_home_sha256 text,p_pages jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_root record;
declare v_item jsonb;
declare v_url text;
declare v_kind text;
declare v_host text;
declare v_n int:=0;
declare v_count int;
begin
 if p_home_sha256 is null or p_home_sha256 !~ '^[a-f0-9]{64}$'
 or p_pages is null or jsonb_typeof(p_pages)<>'array'
 or jsonb_array_length(p_pages)>8 then
   raise exception 'Invalid bounded discovery payload' using errcode='22023';
 end if;

 select q.*,c.website_url,c.website_domain,c.country_code,
        c.publication_status,c.archived_at
 into v_root
 from private.network_producer_auto1_sources q
 join public.network_companies c on c.id=q.company_id
 where q.company_id=p_company_id
 for update of q;
 if not found or v_root.last_sha256 is distinct from p_home_sha256
    or v_root.status not in ('processed','candidate_review','unchanged')
    or v_root.source_url is distinct from v_root.website_url
    or v_root.canonical_domain is distinct from v_root.website_domain
    or v_root.country_code<>'IT'
    or v_root.publication_status<>'published' or v_root.archived_at is not null
    or not exists(
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=p_company_id and r.canonical_key='producer' and r.status='active'
    )
 then
   raise exception 'Current canonical producer homepage required' using errcode='42501';
 end if;

 for v_item in select value from jsonb_array_elements(p_pages) loop
  if jsonb_typeof(v_item)<>'object' then
    raise exception 'Page must be an object' using errcode='22023';
  end if;
  v_url:=v_item->>'url';
  v_kind:=v_item->>'kind';
  if v_url is null or length(v_url)>1200
    or v_url !~ '^https://[A-Za-z0-9.-]+/[A-Za-z0-9._~/%-]+$'
    or v_kind not in ('products','catalog','standards')
    or v_url=v_root.source_url
    or lower(v_url) ~ '[.](pdf|zip|docx?|xlsx?|png|jpg|jpeg|svg)$'
  then
    raise exception 'Non-HTML or non-canonical discovered URL' using errcode='22023';
  end if;
  v_host:=lower(regexp_replace(split_part(v_url,'/',3),'^www[.]',''));
  if v_host<>v_root.canonical_domain then
    raise exception 'Foreign product page denied' using errcode='42501';
  end if;
  select count(*)::int into v_count
  from private.network_producer_auto1_product_pages
  where company_id=p_company_id;
  if v_count>=8 and not exists (
    select 1 from private.network_producer_auto1_product_pages
    where company_id=p_company_id and source_url=v_url
  ) then
    continue;
  end if;
  insert into private.network_producer_auto1_product_pages
    (company_id,source_url,root_source_url,root_sha256,canonical_domain,page_kind)
  values(p_company_id,v_url,v_root.source_url,p_home_sha256,
    v_root.canonical_domain,v_kind)
  on conflict (company_id,source_url) do update set
    root_sha256=excluded.root_sha256,
    root_source_url=excluded.root_source_url,
    page_kind=excluded.page_kind,
    canonical_domain=excluded.canonical_domain,
    next_check_at=least(private.network_producer_auto1_product_pages.next_check_at,now()),
    updated_at=now()
  where private.network_producer_auto1_product_pages.root_sha256
        is distinct from excluded.root_sha256;
  v_n:=v_n+1;
 end loop;
 update private.network_producer_auto1_sources
 set product_discovery_sha256=p_home_sha256,
     product_discovery_at=now(),updated_at=now()
 where company_id=p_company_id;
 return jsonb_build_object('contract','netproducers-auto1a3-discover-v1',
   'considered',v_n,'recorded_total',(
     select count(*)::int from private.network_producer_auto1_product_pages where company_id=p_company_id
   ),'published_capabilities',0);
end;
$body$;

-- Use the original homepage queue; first fetch the HTML once for discovery.
-- Once the hash is recorded, conditional GETs resume as usual.
create or replace function private.netproducers1_auto1_claim(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_items jsonb;
begin
 if p_limit not between 1 and 25 then
   raise exception 'Claim batch size must be between 1 and 25' using errcode='22023';
 end if;
 with picked as (
  select q.company_id
  from private.network_producer_auto1_sources q
  join public.network_companies c on c.id=q.company_id
  where q.next_check_at<=now()
    and (q.status in ('queued','unchanged','processed','candidate_review','failed')
      or (q.status='leased' and q.leased_until<now()))
    and c.country_code='IT' and c.publication_status='published' and c.archived_at is null
    and c.website_domain=q.canonical_domain and c.website_url=q.source_url
    and exists (
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
    )
  -- Revisit already-fetched homepages that lack product-link discovery first.
  -- Each snapshot is prioritized only once (product_discovery_sha256 set on completion).
  order by case when q.last_sha256 is not null
                      and q.product_discovery_sha256 is distinct from q.last_sha256
                then 0 else 1 end, q.next_check_at,q.company_id
  for update of q skip locked
  limit p_limit
 ), leased as (
  update private.network_producer_auto1_sources q
  set status='leased',leased_until=now()+interval '10 minutes',
      attempt_count=q.attempt_count+1,updated_at=now()
  from picked p where q.company_id=p.company_id
  returning q.company_id,q.source_url,q.canonical_domain,q.last_sha256,
            q.last_etag,q.last_modified,q.product_discovery_sha256
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'company_id',v.company_id,'source_url',v.source_url,
   'canonical_domain',v.canonical_domain,'last_sha256',v.last_sha256,
   'etag',case when v.product_discovery_sha256 is distinct from v.last_sha256
                then null else v.last_etag end,
   'last_modified',case when v.product_discovery_sha256 is distinct from v.last_sha256
                then null else v.last_modified end,
   'needs_discovery',v.product_discovery_sha256 is distinct from v.last_sha256
 ) order by v.company_id),'[]'::jsonb)
 into v_items from leased v;
 return jsonb_build_object('contract','netproducers1-auto1-claim-v1',
                          'count',jsonb_array_length(v_items),'items',v_items);
end;
$body$;
-- Existing grants for private/public netproducers1_auto1_claim remain intact.

create or replace function private.netproducers1_auto1a3_claim_pages(p_limit integer default 5)
returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_items jsonb;
begin
 if p_limit not between 1 and 15 then
   raise exception 'Page batch size must be 1..15' using errcode='22023';
 end if;
 with picked as (
  select pg.id
  from private.network_producer_auto1_product_pages pg
  join private.network_producer_auto1_sources q on q.company_id=pg.company_id
  join public.network_companies c on c.id=pg.company_id
  where pg.next_check_at<=now()
    and (pg.status in ('queued','processed','unchanged','candidate_review','failed')
       or (pg.status='leased' and pg.leased_until<now()))
    and pg.root_sha256=q.last_sha256
    and pg.root_source_url=q.source_url
    and pg.canonical_domain=q.canonical_domain
    and q.source_url=c.website_url and q.canonical_domain=c.website_domain
    and c.country_code='IT' and c.publication_status='published' and c.archived_at is null
    and exists(
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
    )
  order by pg.next_check_at,pg.id
  for update of pg skip locked
  limit p_limit
 ), leased as (
  update private.network_producer_auto1_product_pages pg
  set status='leased',leased_until=now()+interval '10 minutes',
      attempt_count=pg.attempt_count+1,updated_at=now()
  from picked p where pg.id=p.id
  returning pg.id,pg.company_id,pg.source_url,pg.canonical_domain,
            pg.last_sha256,pg.last_etag,pg.last_modified
 )
 select coalesce(jsonb_agg(jsonb_build_object(
    'page_id',v.id,'company_id',v.company_id,
    'source_url',v.source_url,'canonical_domain',v.canonical_domain,
    'last_sha256',v.last_sha256,'etag',v.last_etag,'last_modified',v.last_modified
 ) order by v.company_id,v.source_url),'[]'::jsonb)
 into v_items from leased v;
 return jsonb_build_object('contract','netproducers-auto1a3-claim-v1',
    'count',jsonb_array_length(v_items),'items',v_items);
end;
$body$;

create or replace function private.netproducers1_auto1a3_complete_page(
 p_page_id uuid,p_source_sha256 text,p_status text,
 p_candidates jsonb default '[]'::jsonb,
 p_etag text default null,p_last_modified text default null,p_error text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_page private.network_producer_auto1_product_pages%rowtype;
declare v_item jsonb;
declare v_count int:=0;
declare v_root record;
begin
 if p_status not in ('processed','unchanged','failed','blocked')
  or p_candidates is null or jsonb_typeof(p_candidates)<>'array'
  or jsonb_array_length(p_candidates)>25
  or (p_source_sha256 is not null and p_source_sha256 !~ '^[a-f0-9]{64}$')
  or length(coalesce(p_error,''))>220
  or length(coalesce(p_etag,''))>200
  or length(coalesce(p_last_modified,''))>200
 then
  raise exception 'Invalid bounded page result' using errcode='22023';
 end if;
 if p_status<>'processed' and jsonb_array_length(p_candidates)>0
    or p_status='processed' and p_source_sha256 is null then
  raise exception 'Only fetched HTML may provide technical evidence' using errcode='22023';
 end if;
 select * into v_page
 from private.network_producer_auto1_product_pages
 where id=p_page_id for update;
 if not found or v_page.status<>'leased' or v_page.leased_until<now() then
   raise exception 'Active page lease required' using errcode='42501';
 end if;
 select q.source_url,q.last_sha256,q.canonical_domain,
        c.website_url,c.website_domain,c.country_code,c.publication_status,c.archived_at
 into v_root from private.network_producer_auto1_sources q
 join public.network_companies c on c.id=q.company_id
 where q.company_id=v_page.company_id;
 if not found or v_root.last_sha256 is distinct from v_page.root_sha256
 or v_root.source_url is distinct from v_page.root_source_url
 or v_root.website_url is distinct from v_root.source_url
 or v_root.website_domain is distinct from v_page.canonical_domain
 or v_root.canonical_domain is distinct from v_page.canonical_domain
 or v_root.country_code<>'IT' or v_root.publication_status<>'published'
 or v_root.archived_at is not null or not exists(
   select 1 from public.network_company_role_assignments a
   join public.network_company_roles r on r.id=a.role_id
   where a.company_id=v_page.company_id and r.canonical_key='producer' and r.status='active'
 ) then
   raise exception 'Current first-party product page required' using errcode='42501';
 end if;
 for v_item in select value from jsonb_array_elements(p_candidates) loop
   if jsonb_typeof(v_item)<>'object'
   or v_item->>'claim_kind' not in (
      'manufacturing_process','technical_standard','steel_grade',
      'section_shape','dimension_range'
   )
   or char_length(coalesce(v_item->>'claim_value','')) not between 2 and 160
   or char_length(coalesce(v_item->>'evidence_excerpt','')) not between 3 and 240
   or position(lower(v_item->>'claim_value')
      in lower(coalesce(v_item->>'evidence_excerpt','')))=0
   then
     raise exception 'Unverifiable page candidate' using errcode='22023';
   end if;
   insert into private.network_producer_auto1_candidates
    (company_id,claim_kind,claim_value,source_url,source_sha256,
     evidence_excerpt,evidence_status)
   values (v_page.company_id,v_item->>'claim_kind',v_item->>'claim_value',
      v_page.source_url,p_source_sha256,v_item->>'evidence_excerpt',
      'pending_page_verification')
   on conflict(company_id,claim_kind,claim_value,source_url,source_sha256)
   do nothing;
   v_count:=v_count+1;
 end loop;
 update private.network_producer_auto1_product_pages pg
 set status=case when p_status='processed' and v_count>0
                 then 'candidate_review' else p_status end,
     last_sha256=coalesce(p_source_sha256,last_sha256),
     last_etag=coalesce(p_etag,last_etag),
     last_modified=coalesce(p_last_modified,last_modified),
     last_checked_at=now(),
     next_check_at=now()+case
        when p_status='failed' then interval '1 day'
        when p_status='blocked' then interval '14 days'
        else interval '30 days' end,
     leased_until=null,last_error=left(p_error,220),updated_at=now()
 where pg.id=p_page_id;
 return jsonb_build_object('contract','netproducers-auto1a3-complete-v1',
   'status',p_status,'candidate_count',v_count,'published_capabilities',0);
end;
$body$;

create or replace function private.netproducers1_auto1a3_status()
returns jsonb language sql stable security definer set search_path=''
as $body$
 select jsonb_build_object(
  'contract','netproducers-auto1a3-status-v1',
  'pages',count(*)::int,
  'queued',count(*) filter (where status='queued')::int,
  'processed',count(*) filter (where status='processed')::int,
  'candidate_review',count(*) filter (where status='candidate_review')::int,
  'blocked',count(*) filter (where status='blocked')::int,
  'failed',count(*) filter (where status='failed')::int,
  'pending_page_candidates',(
   select count(*)::int from private.network_producer_auto1_candidates
   where evidence_status='pending_page_verification'
  ),
  'published_capabilities',0
 ) from private.network_producer_auto1_product_pages;
$body$;

-- Data API: service-role only wrappers. No browser can inject URLs or lease pages.
create or replace function public.netproducers1_auto1a3_discover(
 p_company_id uuid,p_home_sha256 text,p_pages jsonb default '[]'::jsonb
) returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a3_discover(p_company_id,p_home_sha256,p_pages);
$body$;
create or replace function public.netproducers1_auto1a3_claim_pages(
 p_limit integer default 5
) returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a3_claim_pages(p_limit);
$body$;
create or replace function public.netproducers1_auto1a3_complete_page(
 p_page_id uuid,p_source_sha256 text,p_status text,
 p_candidates jsonb default '[]'::jsonb,
 p_etag text default null,p_last_modified text default null,p_error text default null
) returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a3_complete_page(
   p_page_id,p_source_sha256,p_status,p_candidates,p_etag,p_last_modified,p_error
 );
$body$;
create or replace function public.netproducers1_auto1a3_status()
returns jsonb language sql stable security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a3_status();
$body$;

revoke all on function private.netproducers1_auto1a3_discover(uuid,text,jsonb)
 from public,anon,authenticated;
revoke all on function private.netproducers1_auto1a3_claim_pages(integer)
 from public,anon,authenticated;
revoke all on function private.netproducers1_auto1a3_complete_page(uuid,text,text,jsonb,text,text,text)
 from public,anon,authenticated;
revoke all on function private.netproducers1_auto1a3_status()
 from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a3_discover(uuid,text,jsonb)
 from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a3_claim_pages(integer)
 from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a3_complete_page(uuid,text,text,jsonb,text,text,text)
 from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a3_status()
 from public,anon,authenticated;
grant execute on function private.netproducers1_auto1a3_discover(uuid,text,jsonb)
 to service_role;
grant execute on function private.netproducers1_auto1a3_claim_pages(integer)
 to service_role;
grant execute on function private.netproducers1_auto1a3_complete_page(uuid,text,text,jsonb,text,text,text)
 to service_role;
grant execute on function private.netproducers1_auto1a3_status()
 to service_role;
grant execute on function public.netproducers1_auto1a3_discover(uuid,text,jsonb)
 to service_role;
grant execute on function public.netproducers1_auto1a3_claim_pages(integer)
 to service_role;
grant execute on function public.netproducers1_auto1a3_complete_page(uuid,text,text,jsonb,text,text,text)
 to service_role;
grant execute on function public.netproducers1_auto1a3_status()
 to service_role;

-- One-time gentle rescan of prior successful homepages: collect first-party
-- product links without manual URL imports. Blocked/failed sites stay untouched.
update private.network_producer_auto1_sources
set next_check_at=now()
where last_sha256 is not null
 and status in ('processed','candidate_review','unchanged')
 and product_discovery_sha256 is null
 and last_checked_at >=now()-interval '35 days';

comment on table private.network_producer_auto1_product_pages is
 'Private per-page first-party product/catalog queue with canonical root SHA and independent URL/content hash; source mentions only, no inferred SKU.';
