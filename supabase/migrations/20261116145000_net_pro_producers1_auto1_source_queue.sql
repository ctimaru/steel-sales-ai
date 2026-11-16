-- NET-PRO-PRODUCERS1.AUTO1.A
-- Incremental producer website checks, provenance and private candidate evidence.
-- Uses the EXISTING producers module. No new paid SKU or entitlement.
-- No candidates are exposed to Network PRO until a separate conservative verifier
-- explicitly approves the claim; no product combinations can be inferred.
create table if not exists private.network_producer_auto1_sources (
  company_id uuid primary key references public.network_companies(id) on delete cascade,
  canonical_domain text not null check (
    canonical_domain ~ '^[a-z0-9][a-z0-9.-]{2,250}$'
  ),
  source_url text not null check (
    source_url ~ '^https://[^[:space:]<>]+$' and length(source_url)<=1200
  ),
  status text not null default 'queued' check (
    status in ('queued','leased','processed','unchanged','candidate_review','blocked','failed')
  ),
  last_sha256 text check (last_sha256 ~ '^[a-f0-9]{64}$'),
  last_etag text check (length(last_etag)<=200),
  last_modified text check (length(last_modified)<=200),
  last_checked_at timestamptz,
  next_check_at timestamptz not null default now(),
  leased_until timestamptz,
  attempt_count int not null default 0 check (attempt_count between 0 and 10000),
  last_error text check (length(last_error)<=220),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.network_producer_auto1_sources enable row level security;
revoke all on private.network_producer_auto1_sources from public,anon,authenticated;
create index if not exists network_producer_auto1_due_idx
  on private.network_producer_auto1_sources(status,next_check_at)
  where status in ('queued','unchanged','processed','candidate_review','failed','leased');

create table if not exists private.network_producer_auto1_candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references private.network_producer_auto1_sources(company_id)
    on delete cascade,
  claim_kind text not null check (
    claim_kind in ('manufacturing_process','technical_standard','steel_grade','section_shape','dimension_range')
  ),
  claim_value text not null check (char_length(claim_value) between 2 and 160),
  source_url text not null check (
    source_url ~ '^https://[^[:space:]<>]+$' and length(source_url)<=1200
  ),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_excerpt text not null check (char_length(evidence_excerpt) between 3 and 240),
  evidence_status text not null default 'pending_verification' check (
    evidence_status in ('pending_verification','rejected','confirmed')
  ),
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,claim_kind,claim_value,source_url,source_sha256)
);
alter table private.network_producer_auto1_candidates enable row level security;
revoke all on private.network_producer_auto1_candidates from public,anon,authenticated;
create index if not exists network_producer_auto1_candidates_review_idx
  on private.network_producer_auto1_candidates(evidence_status,observed_at);

-- Returns only a bounded set of canonical *research* candidates. Producer
-- role does not establish that this company actually manufactures steel tubes.
create or replace function private.netproducers1_auto1_seed(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_added integer;
begin
  if p_limit not between 1 and 100 then
    raise exception 'Seed batch size must be between 1 and 100' using errcode='22023';
  end if;
  with eligible as (
    select c.id,c.website_url,c.website_domain
    from public.network_companies c
    where c.country_code='IT'
      and c.publication_status='published' and c.archived_at is null
      and c.website_url ~ '^https://[^[:space:]<>]+$'
      and c.website_domain ~ '^[a-z0-9][a-z0-9.-]{2,250}$'
      and lower(regexp_replace(split_part(split_part(c.website_url,'/',3),':',1),'^www[.]',''))=c.website_domain
      and not exists (select 1 from private.network_producer_auto1_sources q where q.company_id=c.id)
      and exists (
        select 1 from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
      )
    order by c.created_at,c.id
    limit p_limit
  ), inserted as (
    insert into private.network_producer_auto1_sources
      (company_id,canonical_domain,source_url)
    select id,lower(website_domain),website_url from eligible
    on conflict(company_id) do nothing
    returning company_id
  )
  select count(*)::int into v_added from inserted;
  return jsonb_build_object('contract','netproducers1-auto1-seed-v1',
    'added',v_added,'limit',p_limit,'status','seeded');
end;
$body$;

-- Durable, concurrency-safe lease. Work is done by an authorized Railway worker,
-- never by an unauthenticated browser or a client-supplied URL.
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
    and c.website_domain=q.canonical_domain
    and c.website_url=q.source_url
    and exists (
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
    )
  order by q.next_check_at,q.company_id
  for update of q skip locked
  limit p_limit
 ), leased as (
  update private.network_producer_auto1_sources q
  set status='leased',leased_until=now()+interval '10 minutes',
      attempt_count=q.attempt_count+1,updated_at=now()
  from picked p where q.company_id=p.company_id
  returning q.company_id,q.source_url,q.canonical_domain,q.last_sha256,
            q.last_etag,q.last_modified
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'company_id',v.company_id,'source_url',v.source_url,
   'canonical_domain',v.canonical_domain,
   'last_sha256',v.last_sha256,
   'etag',v.last_etag,'last_modified',v.last_modified
 ) order by v.company_id),'[]'::jsonb)
 into v_items from leased v;
 return jsonb_build_object('contract','netproducers1-auto1-claim-v1',
                          'count',jsonb_array_length(v_items),'items',v_items);
end;
$body$;

-- Persist a page fingerprint and short candidate assertions ONLY. No claim is
-- made publicly visible; a distinct verifier handles evidence/rights/identity.
create or replace function private.netproducers1_auto1_complete(
 p_company_id uuid, p_source_sha256 text, p_status text,
 p_candidates jsonb default '[]'::jsonb,
 p_etag text default null, p_last_modified text default null,
 p_error text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_source private.network_producer_auto1_sources%rowtype;
declare v_item jsonb;
declare v_count int:=0;
begin
 if p_status not in ('processed','unchanged','blocked','failed') then
   raise exception 'Invalid processing outcome' using errcode='22023';
 end if;
 if p_source_sha256 is not null and p_source_sha256 !~ '^[a-f0-9]{64}$' then
   raise exception 'Invalid page fingerprint' using errcode='22023';
 end if;
 if p_candidates is null or jsonb_typeof(p_candidates)<>'array'
    or jsonb_array_length(p_candidates)>25 then
   raise exception 'Only 0-25 bounded technical candidates allowed' using errcode='22023';
 end if;
 if p_etag is not null and length(p_etag)>200
    or p_last_modified is not null and length(p_last_modified)>200
    or p_error is not null and length(p_error)>220 then
   raise exception 'Source metadata too long' using errcode='22023';
 end if;
 select * into v_source
 from private.network_producer_auto1_sources
 where company_id=p_company_id for update;
 if not found or v_source.status<>'leased'
    or v_source.leased_until<now() then
   raise exception 'Active lease required' using errcode='42501';
 end if;
 if p_status<>'processed' and jsonb_array_length(p_candidates)<>0 then
   raise exception 'Only a fetched document may yield new candidates' using errcode='22023';
 end if;
 if p_status='processed' and p_source_sha256 is null then
   raise exception 'Fetched document must have a sha256 fingerprint' using errcode='22023';
 end if;
 for v_item in select value from jsonb_array_elements(p_candidates) loop
   if v_item->>'claim_kind' not in (
       'manufacturing_process','technical_standard','steel_grade','section_shape','dimension_range')
     or char_length(coalesce(v_item->>'claim_value','')) not between 2 and 160
     or char_length(coalesce(v_item->>'evidence_excerpt','')) not between 3 and 240
     or position(lower(v_item->>'claim_value')
          in lower(coalesce(v_item->>'evidence_excerpt','')))=0
   then
     raise exception 'Unverifiable technical candidate' using errcode='22023';
   end if;
   insert into private.network_producer_auto1_candidates
       (company_id,claim_kind,claim_value,source_url,source_sha256,evidence_excerpt)
   values (p_company_id,v_item->>'claim_kind',v_item->>'claim_value',
           v_source.source_url,p_source_sha256,v_item->>'evidence_excerpt')
   on conflict(company_id,claim_kind,claim_value,source_url,source_sha256) do nothing;
   v_count:=v_count+1;
 end loop;
 update private.network_producer_auto1_sources q
 set status=case when p_status='processed' and v_count>0 then 'candidate_review'
                 else p_status end,
     last_sha256=coalesce(p_source_sha256,last_sha256),
     last_etag=coalesce(p_etag,last_etag),
     last_modified=coalesce(p_last_modified,last_modified),
     last_checked_at=now(),leased_until=null,
     next_check_at=now()+case
       when p_status='failed' then interval '1 day'
       when p_status='blocked' then interval '14 days'
       else interval '30 days' end,
     last_error=left(p_error,220),updated_at=now()
 where q.company_id=p_company_id;
 return jsonb_build_object('contract','netproducers1-auto1-complete-v1',
    'status',p_status,'candidate_count',v_count,
    'published_claims',0);
end;
$body$;

create or replace function private.netproducers1_auto1_status()
returns jsonb language sql stable security definer set search_path=''
as $body$
 select jsonb_build_object(
  'contract','netproducers1-auto1-status-v1',
  'sources',count(*)::int,
  'queued',count(*) filter (where status='queued')::int,
  'leased',count(*) filter (where status='leased')::int,
  'processed',count(*) filter (where status='processed')::int,
  'candidate_review',count(*) filter (where status='candidate_review')::int,
  'needs_recheck',count(*) filter (where next_check_at<=now())::int,
  'candidates',(select count(*)::int from private.network_producer_auto1_candidates),
  'auto_published_claims',0
 ) from private.network_producer_auto1_sources;
$body$;

revoke all on function private.netproducers1_auto1_seed(integer) from public,anon,authenticated;
revoke all on function private.netproducers1_auto1_claim(integer) from public,anon,authenticated;
revoke all on function private.netproducers1_auto1_complete(uuid,text,text,jsonb,text,text,text)
  from public,anon,authenticated;
revoke all on function private.netproducers1_auto1_status() from public,anon,authenticated;
grant execute on function private.netproducers1_auto1_seed(integer) to service_role;
grant execute on function private.netproducers1_auto1_claim(integer) to service_role;
grant execute on function private.netproducers1_auto1_complete(uuid,text,text,jsonb,text,text,text)
  to service_role;
grant execute on function private.netproducers1_auto1_status() to service_role;

comment on table private.network_producer_auto1_sources is
  'Incremental first-party source-check queue for canonical IT producer-role companies. Producer role alone does not verify steel-tube production.';
comment on table private.network_producer_auto1_candidates is
  'Short candidate claim evidence held privately until separate automated per-attribute verification. No client reads.';

-- Supabase Data API exposes `public`, NOT `private`. These wrappers are
-- deliberately service_role-only so the Railway worker can call them via RPC.
-- Browsers (anon and authenticated) cannot acquire leases or see raw candidates.
create or replace function public.netproducers1_auto1_seed(p_limit integer default 100)
returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1_seed(p_limit);
$body$;
create or replace function public.netproducers1_auto1_claim(p_limit integer default 10)
returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1_claim(p_limit);
$body$;
create or replace function public.netproducers1_auto1_complete(
 p_company_id uuid, p_source_sha256 text, p_status text,
 p_candidates jsonb default '[]'::jsonb,
 p_etag text default null, p_last_modified text default null,
 p_error text default null
)
returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1_complete(
   p_company_id,p_source_sha256,p_status,p_candidates,p_etag,p_last_modified,p_error
 );
$body$;
create or replace function public.netproducers1_auto1_status()
returns jsonb language sql stable security invoker set search_path=''
as $body$
 select private.netproducers1_auto1_status();
$body$;

revoke all on function public.netproducers1_auto1_seed(integer) from public,anon,authenticated;
revoke all on function public.netproducers1_auto1_claim(integer) from public,anon,authenticated;
revoke all on function public.netproducers1_auto1_complete(uuid,text,text,jsonb,text,text,text)
  from public,anon,authenticated;
revoke all on function public.netproducers1_auto1_status() from public,anon,authenticated;
grant execute on function public.netproducers1_auto1_seed(integer) to service_role;
grant execute on function public.netproducers1_auto1_claim(integer) to service_role;
grant execute on function public.netproducers1_auto1_complete(uuid,text,text,jsonb,text,text,text)
  to service_role;
grant execute on function public.netproducers1_auto1_status() to service_role;

comment on function public.netproducers1_auto1_claim(integer) is
  'Railway first-party source intake only: private queue leases, never a public producer capability or entitlement grant.';
