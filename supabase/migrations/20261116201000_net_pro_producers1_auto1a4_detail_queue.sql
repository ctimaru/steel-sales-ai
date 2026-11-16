-- NET-PRO-PRODUCERS1.AUTO1.A.4.2 - private depth-2 HTML queue + technical candidates.
-- Definition only: NO claimed producibility, NO frontend reader, NO public capabilities.
-- Apply only after previous A.3 migrations are present and CI passes.
alter table private.network_producer_auto1_product_pages
 add column if not exists detail_discovery_sha256 text
  check (detail_discovery_sha256 ~ '^[a-f0-9]{64}$'),
 add column if not exists detail_discovery_at timestamptz;

create table if not exists private.network_producer_auto1_detail_pages (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references private.network_producer_auto1_sources(company_id) on delete cascade,
 parent_page_id uuid not null references private.network_producer_auto1_product_pages(id) on delete cascade,
 parent_sha256 text not null check (parent_sha256 ~ '^[a-f0-9]{64}$'),
 source_url text not null check (source_url ~ '^https://[A-Za-z0-9.-]+/[A-Za-z0-9._~/%-]+$' and length(source_url) between 14 and 1200),
 canonical_domain text not null,
 needs_reparse boolean not null default true,
 crawl_depth smallint not null default 2 check (crawl_depth=2),
 status text not null default 'queued' check (status in ('queued','leased','processed','unchanged','blocked','failed')),
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
 unique (company_id,source_url)
);
alter table private.network_producer_auto1_detail_pages enable row level security;
revoke all on private.network_producer_auto1_detail_pages from public,anon,authenticated;
create index if not exists network_producer_auto1a4_due
 on private.network_producer_auto1_detail_pages(next_check_at,status)
 where status in ('queued','leased','processed','unchanged','failed');
create index if not exists network_producer_auto1a4_parent
 on private.network_producer_auto1_detail_pages(parent_page_id);

create table if not exists private.network_producer_auto1_detail_candidates (
 id uuid primary key default gen_random_uuid(),
 detail_page_id uuid not null references private.network_producer_auto1_detail_pages(id) on delete cascade,
 company_id uuid not null references private.network_producer_auto1_sources(company_id) on delete cascade,
 source_url text not null,
 source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
 locator text not null check (locator ~ '^table_row:[1-9][0-9]{0,2}$'),
 source_row_excerpt text not null check (length(source_row_excerpt) between 10 and 240),
 standard text not null,
 grade text not null,
 shape text not null check (shape in ('CHS','SHS','RHS')),
 dimensions_mm jsonb not null check (jsonb_typeof(dimensions_mm)='array'),
 evidence_status text not null default 'pending_verification'
  check (evidence_status in ('pending_verification','stale')),
 observed_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (detail_page_id,source_sha256,locator)
);
alter table private.network_producer_auto1_detail_candidates enable row level security;
revoke all on private.network_producer_auto1_detail_candidates from public,anon,authenticated;
create index if not exists network_producer_auto1a4_candidates_by_company
 on private.network_producer_auto1_detail_candidates(company_id,evidence_status);

-- Enforce per-company, per-parent caps and SHA provenance in database.
create or replace function private.netproducers1_auto1a4_discover(
 p_parent_page_id uuid,p_parent_sha256 text,p_links jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_parent private.network_producer_auto1_product_pages%rowtype;
declare v_root record;
declare v_item jsonb;
declare v_url text;
declare v_considered int:=0;
declare v_recorded int:=0;
begin
 if p_parent_sha256 is null or p_parent_sha256 !~ '^[a-f0-9]{64}$'
    or p_links is null or jsonb_typeof(p_links)<>'array'
    or jsonb_array_length(p_links)>6 then
  raise exception 'Invalid second-level discovery payload' using errcode='22023';
 end if;
 select * into v_parent from private.network_producer_auto1_product_pages
 where id=p_parent_page_id for update;
 if not found or v_parent.last_sha256 is distinct from p_parent_sha256
    or v_parent.status not in ('processed','unchanged','candidate_review')
    or v_parent.last_checked_at < now()-interval '35 days' then
  raise exception 'Current first-level HTML snapshot required' using errcode='42501';
 end if;
 select q.source_url,q.last_sha256,q.canonical_domain,q.last_checked_at,
        c.website_url,c.website_domain,c.country_code,c.publication_status,c.archived_at
 into v_root from private.network_producer_auto1_sources q
 join public.network_companies c on c.id=q.company_id
 where q.company_id=v_parent.company_id for update of q;
 if not found or v_root.last_sha256 is distinct from v_parent.root_sha256
    or v_root.source_url is distinct from v_parent.root_source_url
    or v_root.website_url is distinct from v_root.source_url
    or v_root.website_domain is distinct from v_root.canonical_domain
    or v_parent.canonical_domain is distinct from v_root.canonical_domain
    or v_root.country_code<>'IT' or v_root.publication_status<>'published'
    or v_root.archived_at is not null
    or v_root.last_checked_at < now()-interval '35 days'
    or not exists (
     select 1 from public.network_company_role_assignments a
     join public.network_company_roles r on r.id=a.role_id
     where a.company_id=v_parent.company_id and r.canonical_key='producer' and r.status='active'
    ) then
  raise exception 'Current canonical producer required' using errcode='42501';
 end if;

 -- Any parent SHA change retires old proof, including links no longer present.
 update private.network_producer_auto1_detail_candidates c
 set evidence_status='stale',updated_at=now()
 from private.network_producer_auto1_detail_pages d
 where c.detail_page_id=d.id and d.parent_page_id=p_parent_page_id
   and d.parent_sha256 is distinct from p_parent_sha256
   and c.evidence_status<>'stale';

 for v_item in select value from jsonb_array_elements(p_links) loop
  v_url:=v_item->>'url';
  if jsonb_typeof(v_item)<>'object'
   or v_item->>'depth'<>'2'
   or v_item->>'parent_url' is distinct from v_parent.source_url
   or v_item->>'parent_sha256' is distinct from p_parent_sha256
   or v_url is null
   or v_url !~ '^https://[A-Za-z0-9.-]+/[A-Za-z0-9._~/%-]+$'
   or length(v_url)>1200
   or split_part(v_url,'/',3)<>split_part(v_parent.source_url,'/',3)
   or v_url=v_parent.source_url or v_url=v_root.source_url
   or lower(v_url) ~ '[.](pdf|docx?|xlsx?|zip|png|jpg|jpeg|svg|webp)$'
   or exists (select 1 from private.network_producer_auto1_product_pages x
              where x.company_id=v_parent.company_id and x.source_url=v_url)
  then
   raise exception 'Invalid, duplicate or foreign second-level URL' using errcode='22023';
  end if;
  v_considered:=v_considered+1;
  if not exists (select 1 from private.network_producer_auto1_detail_pages d
                 where d.company_id=v_parent.company_id and d.source_url=v_url) then
   if (select count(*) from private.network_producer_auto1_detail_pages d
       where d.company_id=v_parent.company_id)>=24
      or (select count(*) from private.network_producer_auto1_detail_pages d
          where d.parent_page_id=p_parent_page_id)>=6 then
    continue;
   end if;
  end if;
  insert into private.network_producer_auto1_detail_pages
   (company_id,parent_page_id,parent_sha256,source_url,canonical_domain)
  values (v_parent.company_id,p_parent_page_id,p_parent_sha256,v_url,v_parent.canonical_domain)
  on conflict (company_id,source_url) do update set
   parent_page_id=excluded.parent_page_id,
   parent_sha256=excluded.parent_sha256,
   canonical_domain=excluded.canonical_domain,
   status='queued',next_check_at=now(),last_etag=null,last_modified=null,
   needs_reparse=true,leased_until=null,updated_at=now()
  where private.network_producer_auto1_detail_pages.parent_sha256 is distinct from excluded.parent_sha256
     or private.network_producer_auto1_detail_pages.parent_page_id is distinct from excluded.parent_page_id;
  v_recorded:=v_recorded+1;
 end loop;

 -- An empty valid link set still records the scan and prevents endless re-fetch.
 update private.network_producer_auto1_product_pages
 set detail_discovery_sha256=p_parent_sha256,detail_discovery_at=now(),updated_at=now()
 where id=p_parent_page_id;
 -- Re-parented/changed parent snapshot invalidates prior associations; never publish them.
 update private.network_producer_auto1_detail_candidates c
 set evidence_status='stale',updated_at=now()
 from private.network_producer_auto1_detail_pages d
 where c.detail_page_id=d.id and d.company_id=v_parent.company_id
   and d.parent_page_id=p_parent_page_id
   and d.parent_sha256=p_parent_sha256
   and d.last_checked_at is not null
   and d.status='queued';
 return jsonb_build_object('contract','netproducers-auto1a4-discover-v1',
                          'considered',v_considered,'recorded',v_recorded,'published_capabilities',0);
end;
$body$;

-- Requeue first-level HTML once to bootstrap A.4: conditional GET must be bypassed
-- only when detail_discovery_sha256 differs from the current page SHA.
update private.network_producer_auto1_product_pages
 set next_check_at=now(),updated_at=now()
 where last_sha256 is not null and detail_discovery_sha256 is distinct from last_sha256
   and status in ('processed','unchanged','candidate_review');

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
  where (pg.next_check_at<=now()
      or (pg.last_sha256 is not null
       and pg.detail_discovery_sha256 is distinct from pg.last_sha256
       and pg.last_checked_at<now()-interval '1 day'))
    and (pg.status in ('queued','processed','unchanged','candidate_review','failed')
       or (pg.status='leased' and pg.leased_until<now()))
    and pg.root_sha256=q.last_sha256 and pg.root_source_url=q.source_url
    and pg.canonical_domain=q.canonical_domain
    and q.source_url=c.website_url and q.canonical_domain=c.website_domain
    and c.country_code='IT' and c.publication_status='published' and c.archived_at is null
    and exists(
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
    )
  order by pg.next_check_at,pg.id
  for update of pg skip locked limit p_limit
 ), leased as (
  update private.network_producer_auto1_product_pages pg
  set status='leased',leased_until=now()+interval '10 minutes',
      attempt_count=pg.attempt_count+1,updated_at=now()
  from picked p where pg.id=p.id
  returning pg.id,pg.company_id,pg.source_url,pg.canonical_domain,
            pg.last_sha256,pg.last_etag,pg.last_modified,
            pg.detail_discovery_sha256
 )
 select coalesce(jsonb_agg(jsonb_build_object(
    'page_id',v.id,'company_id',v.company_id,
    'source_url',v.source_url,'canonical_domain',v.canonical_domain,
    'last_sha256',v.last_sha256,
    'etag',case when v.detail_discovery_sha256 is distinct from v.last_sha256 then null else v.last_etag end,
    'last_modified',case when v.detail_discovery_sha256 is distinct from v.last_sha256 then null else v.last_modified end,
    'needs_detail_discovery',v.detail_discovery_sha256 is distinct from v.last_sha256
 ) order by v.company_id,v.source_url),'[]'::jsonb)
 into v_items from leased v;
 return jsonb_build_object('contract','netproducers-auto1a3-claim-v1',
    'count',jsonb_array_length(v_items),'items',v_items);
end;
$body$;

create or replace function private.netproducers1_auto1a4_claim_pages(p_limit integer default 3)
returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_items jsonb;
begin
 if p_limit not between 1 and 5 then
  raise exception 'Second-level batch size must be 1..5' using errcode='22023';
 end if;
 with picked as (
  select d.id
  from private.network_producer_auto1_detail_pages d
  join private.network_producer_auto1_product_pages p on p.id=d.parent_page_id
  join private.network_producer_auto1_sources q on q.company_id=d.company_id
  join public.network_companies c on c.id=d.company_id
  where d.next_check_at<=now()
    and (d.status in ('queued','processed','unchanged','failed')
         or (d.status='leased' and d.leased_until<now()))
    and d.parent_sha256=p.last_sha256
    and p.detail_discovery_sha256=p.last_sha256
    and p.status in ('processed','candidate_review','unchanged')
    and p.root_sha256=q.last_sha256 and p.root_source_url=q.source_url
    and d.canonical_domain=q.canonical_domain and p.canonical_domain=q.canonical_domain
    and q.source_url=c.website_url and q.canonical_domain=c.website_domain
    and c.country_code='IT' and c.publication_status='published' and c.archived_at is null
    and q.last_checked_at>=now()-interval '35 days'
    and p.last_checked_at>=now()-interval '35 days'
    and exists(select 1 from public.network_company_role_assignments a
     join public.network_company_roles r on r.id=a.role_id
     where a.company_id=c.id and r.canonical_key='producer' and r.status='active')
  order by d.next_check_at,d.id
  for update of d skip locked limit p_limit
 ), leased as (
  update private.network_producer_auto1_detail_pages d
  set status='leased',leased_until=now()+interval '10 minutes',
      attempt_count=d.attempt_count+1,updated_at=now()
  from picked p where d.id=p.id
  returning d.id,d.company_id,d.source_url,d.canonical_domain,
            d.last_sha256,d.last_etag,d.last_modified,d.parent_page_id,d.parent_sha256,
            d.needs_reparse
 )
 select coalesce(jsonb_agg(jsonb_build_object(
    'page_id',v.id,'company_id',v.company_id,'source_url',v.source_url,
    'canonical_domain',v.canonical_domain,'parent_page_id',v.parent_page_id,
    'parent_sha256',v.parent_sha256,'last_sha256',v.last_sha256,
    'needs_content_reparse',v.needs_reparse,
    'etag',case when v.needs_reparse then null else v.last_etag end,
    'last_modified',case when v.needs_reparse then null else v.last_modified end
 ) order by v.company_id,v.source_url),'[]'::jsonb)
 into v_items from leased v;
 return jsonb_build_object('contract','netproducers-auto1a4-claim-v1',
   'count',jsonb_array_length(v_items),'items',v_items);
end;
$body$;

create or replace function private.netproducers1_auto1a4_complete_page(
 p_page_id uuid,p_source_sha256 text,p_status text,
 p_candidates jsonb default '[]'::jsonb,p_etag text default null,
 p_last_modified text default null,p_error text default null
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_page private.network_producer_auto1_detail_pages%rowtype;
declare v_parent private.network_producer_auto1_product_pages%rowtype;
declare v_root record;
declare v_item jsonb;
declare v_shape text;
declare v_dims jsonb;
declare v_count int:=0;
begin
 if p_status is null or p_status not in ('processed','unchanged','failed','blocked')
    or p_candidates is null or jsonb_typeof(p_candidates)<>'array'
    or jsonb_array_length(p_candidates)>20
    or (p_source_sha256 is not null and p_source_sha256 !~ '^[a-f0-9]{64}$')
    or (p_status='processed' and p_source_sha256 is null)
    or (p_status<>'processed' and jsonb_array_length(p_candidates)>0)
    or length(coalesce(p_error,''))>220
    or length(coalesce(p_etag,''))>200
    or length(coalesce(p_last_modified,''))>200
 then raise exception 'Invalid second-level completion payload' using errcode='22023';
 end if;
 select * into v_page from private.network_producer_auto1_detail_pages
 where id=p_page_id for update;
 if not found or v_page.status<>'leased' or v_page.leased_until<now() then
  raise exception 'Active second-level lease required' using errcode='42501';
 end if;
 select * into v_parent from private.network_producer_auto1_product_pages
 where id=v_page.parent_page_id for update;
 if not found or v_parent.last_sha256 is distinct from v_page.parent_sha256
    or v_parent.detail_discovery_sha256 is distinct from v_page.parent_sha256
    or v_parent.status not in ('processed','candidate_review','unchanged')
    or v_parent.company_id is distinct from v_page.company_id
    or v_parent.last_checked_at<now()-interval '35 days' then
   raise exception 'Parent snapshot changed or unavailable' using errcode='42501';
 end if;
 select q.source_url,q.last_sha256,q.canonical_domain,q.last_checked_at,
        c.website_url,c.website_domain,c.country_code,c.publication_status,c.archived_at
 into v_root from private.network_producer_auto1_sources q
 join public.network_companies c on c.id=q.company_id
 where q.company_id=v_page.company_id;
 if not found or v_parent.root_sha256 is distinct from v_root.last_sha256
    or v_parent.root_source_url is distinct from v_root.source_url
    or v_root.source_url is distinct from v_root.website_url
    or v_root.canonical_domain is distinct from v_root.website_domain
    or v_page.canonical_domain is distinct from v_root.canonical_domain
    or v_root.country_code<>'IT' or v_root.publication_status<>'published'
    or v_root.archived_at is not null or v_root.last_checked_at<now()-interval '35 days'
    or not exists (
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=v_page.company_id and r.canonical_key='producer' and r.status='active'
    ) then
   raise exception 'Producer identity or source is no longer eligible' using errcode='42501';
 end if;
 if p_status='unchanged' and v_page.last_sha256 is null then
   raise exception 'Cannot validate 304 without prior snapshot' using errcode='22023';
 end if;

 for v_item in select value from jsonb_array_elements(p_candidates) loop
  v_shape:=v_item->>'shape';v_dims:=v_item->'dimensions_mm';
  if jsonb_typeof(v_item)<>'object'
   or v_item->>'source_url' is distinct from v_page.source_url
   or v_item->>'source_sha256' is distinct from p_source_sha256
   or v_item->>'evidence_status'<>'pending_verification'
   or v_item->>'interpretation'<>'same_row_explicit_candidate'
   or coalesce(v_item->>'locator','') !~ '^table_row:[1-9][0-9]{0,2}$'
   or coalesce(v_item->>'standard','') !~ '^EN(10219|10210)([12])?$'
   or coalesce(v_item->>'grade','') !~ '^S(235|275|355|420|460)(JR|J0|J2|M|ML|N|NL)?H$'
   or v_shape not in ('CHS','SHS','RHS')
   or jsonb_typeof(v_dims) is distinct from 'array'
   or (v_shape='CHS' and jsonb_array_length(v_dims)<>2)
   or (v_shape in ('SHS','RHS') and jsonb_array_length(v_dims)<>3)
   or length(coalesce(v_item->>'source_row_excerpt','')) not between 10 and 240
   or exists (
     select 1 from jsonb_array_elements(v_dims) el
     where jsonb_typeof(el.value)<>'number'
        or (jsonb_typeof(el.value)='number' and (el.value::text)::numeric not between 0.01 and 10000)
   )
  then
   raise exception 'Invalid or unsubstantiated technical candidate' using errcode='22023';
  end if;
  insert into private.network_producer_auto1_detail_candidates (
   detail_page_id,company_id,source_url,source_sha256,locator,source_row_excerpt,
   standard,grade,shape,dimensions_mm,evidence_status
  ) values (
   v_page.id,v_page.company_id,v_page.source_url,p_source_sha256,
   v_item->>'locator',v_item->>'source_row_excerpt',
   v_item->>'standard',v_item->>'grade',v_shape,v_dims,'pending_verification'
  ) on conflict (detail_page_id,source_sha256,locator) do update
  set evidence_status='pending_verification',observed_at=now(),updated_at=now()
  where private.network_producer_auto1_detail_candidates.evidence_status='stale';
  v_count:=v_count+1;
 end loop;
 if p_status='processed' and v_page.last_sha256 is distinct from p_source_sha256 then
  update private.network_producer_auto1_detail_candidates
   set evidence_status='stale',updated_at=now()
  where detail_page_id=v_page.id and source_sha256 is distinct from p_source_sha256;
 elsif p_status='blocked' then
  update private.network_producer_auto1_detail_candidates
   set evidence_status='stale',updated_at=now()
  where detail_page_id=v_page.id;
 end if;
 update private.network_producer_auto1_detail_pages
 set status=p_status,last_sha256=coalesce(p_source_sha256,last_sha256),
     needs_reparse=case when p_status='processed' then false else needs_reparse end,
     last_etag=coalesce(p_etag,last_etag),last_modified=coalesce(p_last_modified,last_modified),
     last_checked_at=now(),
     next_check_at=now()+case when p_status='failed' then interval '1 day'
       when p_status='blocked' then interval '14 days' else interval '30 days' end,
     leased_until=null,last_error=left(p_error,220),updated_at=now()
 where id=v_page.id;
 return jsonb_build_object('contract','netproducers-auto1a4-complete-v1',
                          'status',p_status,'candidate_count',v_count,'published_capabilities',0);
end;
$body$;

create or replace function private.netproducers1_auto1a4_status()
returns jsonb language sql stable security definer set search_path=''
as $body$
 select jsonb_build_object(
   'contract','netproducers-auto1a4-status-v1',
   'detail_pages',(select count(*)::int from private.network_producer_auto1_detail_pages),
   'queued',(select count(*)::int from private.network_producer_auto1_detail_pages where status='queued'),
   'processed',(select count(*)::int from private.network_producer_auto1_detail_pages where status in ('processed','unchanged')),
   'pending_candidates',(select count(*)::int from private.network_producer_auto1_detail_candidates where evidence_status='pending_verification'),
   'stale_candidates',(select count(*)::int from private.network_producer_auto1_detail_candidates where evidence_status='stale'),
   'published_capabilities',0
 );
$body$;

create or replace function public.netproducers1_auto1a4_discover(
 p_parent_page_id uuid,p_parent_sha256 text,p_links jsonb default '[]'::jsonb
) returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a4_discover(p_parent_page_id,p_parent_sha256,p_links);
$body$;
create or replace function public.netproducers1_auto1a4_claim_pages(p_limit integer default 3)
returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a4_claim_pages(p_limit);
$body$;
create or replace function public.netproducers1_auto1a4_complete_page(
 p_page_id uuid,p_source_sha256 text,p_status text,p_candidates jsonb default '[]'::jsonb,
 p_etag text default null,p_last_modified text default null,p_error text default null
) returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a4_complete_page(
  p_page_id,p_source_sha256,p_status,p_candidates,p_etag,p_last_modified,p_error
 );
$body$;
create or replace function public.netproducers1_auto1a4_status()
returns jsonb language sql stable security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a4_status();
$body$;

revoke all on function private.netproducers1_auto1a4_discover(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function private.netproducers1_auto1a4_claim_pages(integer) from public,anon,authenticated;
revoke all on function private.netproducers1_auto1a4_complete_page(uuid,text,text,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function private.netproducers1_auto1a4_status() from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a4_discover(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a4_claim_pages(integer) from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a4_complete_page(uuid,text,text,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a4_status() from public,anon,authenticated;
grant execute on function private.netproducers1_auto1a4_discover(uuid,text,jsonb) to service_role;
grant execute on function private.netproducers1_auto1a4_claim_pages(integer) to service_role;
grant execute on function private.netproducers1_auto1a4_complete_page(uuid,text,text,jsonb,text,text,text) to service_role;
grant execute on function private.netproducers1_auto1a4_status() to service_role;
grant execute on function public.netproducers1_auto1a4_discover(uuid,text,jsonb) to service_role;
grant execute on function public.netproducers1_auto1a4_claim_pages(integer) to service_role;
grant execute on function public.netproducers1_auto1a4_complete_page(uuid,text,text,jsonb,text,text,text) to service_role;
grant execute on function public.netproducers1_auto1a4_status() to service_role;
comment on table private.network_producer_auto1_detail_candidates is
 'AUTO1.A.4.2 private and UNVERIFIED technical tuples. Never publish as actual manufacturing capability.';
