-- NET-UX3B — official-company-site evidence staging with verified ISTAT city/province.
-- Critical: no caller, including service_role, may publish a facility through these APIs.
-- All proposals still need CRAWL-IT6.1 human review + NET-UX3 second publication decision.
create table if not exists public.network_it_geo_collection_batches (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(btrim(label)) between 8 and 160),
  source_method text not null default 'official_company_website_review'
    check(source_method='official_company_website_review'),
  created_at timestamptz not null default now(),
  description text not null check(length(btrim(description)) between 12 and 2000)
);
alter table public.network_it_geo_collection_batches enable row level security;
revoke all on public.network_it_geo_collection_batches from public,anon,authenticated;
grant select,insert on public.network_it_geo_collection_batches to service_role;

alter table public.network_it_geo_evidence_candidates
  add column if not exists collection_batch_id uuid
  references public.network_it_geo_collection_batches(id) on delete restrict;
create index if not exists network_it_geo_evidence_collection_batch_idx
  on public.network_it_geo_evidence_candidates(collection_batch_id,status);

create or replace function private.netux3b_stage_geo_core(
 p_company_id uuid,p_source_url text,p_city text,p_province_code text,
 p_evidence_snippet text,p_collection_batch_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 c public.network_companies%rowtype;
 m public.network_it_municipalities%rowtype;
 v_count int;
 v_code text;
 v_id uuid;
 v_host text;
 v_domain text;
 v_existing_status text;
begin
  select * into c from public.network_companies
  where id=p_company_id and publication_status='published'
    and country_code='IT' and archived_at is null;
  if not found then raise exception 'Published active Italian Network company required' using errcode='22023'; end if;
  if p_collection_batch_id is not null and not exists (
    select 1 from public.network_it_geo_collection_batches where id=p_collection_batch_id
  ) then raise exception 'Approved collection batch ID not found' using errcode='22023'; end if;
  if coalesce(p_source_url,'') !~* '^https://[a-z0-9][a-z0-9.-]+(/[^[:space:]]*)?$'
     or length(p_source_url)>1800 or position('@' in p_source_url)>0 or position(':' in split_part(p_source_url,'/',3))>0
  then raise exception 'Public HTTPS company-site URL required' using errcode='22023'; end if;
  v_host:=regexp_replace(lower(split_part(p_source_url,'/',3)),'^www\.','');
  v_domain:=regexp_replace(lower(coalesce(c.website_domain,'')),'^www\.','');
  if length(v_domain)<4 or position('.' in v_domain)=0
     or (v_host<>v_domain and right(v_host,length(v_domain)+1)<>'.'||v_domain)
  then raise exception 'Source host must match active Network company website' using errcode='42501'; end if;
  if p_province_code !~ '^[A-Za-z]{2}$'
     or length(btrim(coalesce(p_city,''))) not between 2 and 120
     or length(btrim(coalesce(p_evidence_snippet,''))) not between 20 and 1500
     or strpos(lower(p_evidence_snippet),lower(btrim(p_city)))=0
     or p_evidence_snippet !~* ('(^|[^[:alpha:]])' || upper(btrim(p_province_code)) || '([^[:alpha:]]|$)')
  then raise exception 'Source quote must explicitly contain city and separate province abbreviation'
    using errcode='22023'; end if;
  select count(*),min(istat_code) into v_count,v_code
  from public.network_it_municipalities
  where is_current
    and municipality_normalized=lower(btrim(regexp_replace(p_city,'[[:space:]]+',' ','g')))
    and province_code=upper(btrim(p_province_code));
  if v_count<>1 then raise exception 'One active ISTAT city+province match required' using errcode='22023'; end if;
  select * into m from public.network_it_municipalities where istat_code=v_code and is_current;
  if exists (
    select 1 from public.network_facilities f
    where f.company_id=c.id and f.archived_at is null
      and f.publication_status='published' and f.country_code='IT'
      and lower(btrim(f.city))=lower(btrim(m.municipality_name))
      and lower(btrim(f.region))=lower(btrim(m.region_name))
  ) then raise exception 'Official location already published for this company' using errcode='23505'; end if;

  -- Suppress even cross-URL duplicates while an evidence for this precise city is in review.
  select e.id,e.status into v_id,v_existing_status
  from public.network_it_geo_evidence_candidates e
  where e.company_id=c.id and e.status in ('pending_review','approved_for_facility_review')
    and e.istat_code=v_code
  order by e.created_at asc limit 1;
  if found then
    return jsonb_build_object('status','already_staged','id',v_id,'istat_code',v_code,
      'facility_published',false);
  end if;
  insert into public.network_it_geo_evidence_candidates(
    company_id,source_url,source_kind,source_company_domain,
    city,province_code,region,istat_code,evidence_snippet,
    status,collection_batch_id
  ) values (
    c.id,btrim(p_source_url),'company_official_site',v_domain,
    m.municipality_name,m.province_code,m.region_name,m.istat_code,
    btrim(p_evidence_snippet),'pending_review',p_collection_batch_id
  ) returning id into v_id;
  return jsonb_build_object('status','pending_review','id',v_id,
    'istat_code',v_code,'city',m.municipality_name,'province_code',m.province_code,
    'region',m.region_name,'facility_published',false);
end $$;

create or replace function private.netux3b_operator_stage_impl(
 p_company_id uuid,p_source_url text,p_city text,p_province_code text,p_evidence_snippet text
) returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  perform private.require_platform_permission('discovery.enrich');
  return private.netux3b_stage_geo_core(p_company_id,p_source_url,p_city,
    p_province_code,p_evidence_snippet,null::uuid);
end $$;

create or replace function public.netux3b_operator_stage_geo(
 p_company_id uuid,p_source_url text,p_city text,p_province_code text,p_evidence_snippet text
) returns jsonb language sql security invoker set search_path=''
as 'select private.netux3b_operator_stage_impl(p_company_id,p_source_url,p_city,p_province_code,p_evidence_snippet);';

-- Service_role only: imports pre-observed official-site snippets as candidates.
-- Never reviews or publishes; the same source proof goes through the UI approval queue.
create or replace function public.netux3b_stage_screened_official_geo(
 p_batch_id uuid,p_company_id uuid,p_source_url text,p_city text,
 p_province_code text,p_evidence_snippet text
) returns jsonb language sql security invoker set search_path=''
as 'select private.netux3b_stage_geo_core(p_company_id,p_source_url,p_city,p_province_code,p_evidence_snippet,p_batch_id);';

revoke all on function private.netux3b_stage_geo_core(uuid,text,text,text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.netux3b_operator_stage_impl(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.netux3b_operator_stage_geo(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.netux3b_stage_screened_official_geo(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function private.netux3b_stage_geo_core(uuid,text,text,text,text,uuid) to service_role;
grant execute on function private.netux3b_operator_stage_impl(uuid,text,text,text,text) to authenticated;
grant execute on function public.netux3b_operator_stage_geo(uuid,text,text,text,text) to authenticated;
grant execute on function public.netux3b_stage_screened_official_geo(uuid,uuid,text,text,text,text) to service_role;

-- Publication revalidates pre-structured ISTAT codes, but retains compatibility
-- with pre-existing reviewed evidence whose ISTAT code is NULL.
create or replace function private.netux3b_check_istat_before_publish(p_evidence_id uuid)
returns void language plpgsql stable security definer set search_path=''
as $$
declare e public.network_it_geo_evidence_candidates%rowtype;
begin
 select * into e from public.network_it_geo_evidence_candidates where id=p_evidence_id;
 if not found then raise exception 'Evidence not found' using errcode='P0002'; end if;
 if e.collection_batch_id is not null and e.istat_code is null then
   raise exception 'Screened official site evidence must have ISTAT city+province' using errcode='42501';
 end if;
 if e.istat_code is not null and not exists (
   select 1 from public.network_it_municipalities m
   where m.istat_code=e.istat_code and m.is_current
     and lower(m.municipality_name)=lower(btrim(e.city))
     and m.province_code=e.province_code
     and m.region_name=e.region
 ) then raise exception 'Official location differs from current ISTAT register'
      using errcode='42501'; end if;
end $$;
revoke all on function private.netux3b_check_istat_before_publish(uuid) from public,anon,authenticated;
-- Only the owner-invoked private NET-UX3 publisher can call this helper.
comment on function public.netux3b_stage_screened_official_geo(uuid,uuid,text,text,text,text) is
 'NET-UX3B controlled official-domain + city/province ISTAT evidence candidates. Service only; cannot approve or publish.';
