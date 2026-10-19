-- NET-PROFILE1C.3: source-grounded staging. The discovered record source is
-- a VIEW, so preserve the UUID without an invalid foreign-key constraint.
create table if not exists private.network_company_enrichment (
 id uuid primary key default gen_random_uuid(),
 canonical_company_id uuid references public.network_companies(id) on delete cascade,
 discovered_record_id uuid,
 field_key text not null check (field_key in ('description','products','services','industry','city','region','website')),
 field_value jsonb not null,
 evidence_url text not null check (length(evidence_url) between 10 and 2048 and evidence_url ~* '^https?://'),
 evidence_excerpt text check (length(evidence_excerpt)<=1200),
 extractor_version text not null check (length(extractor_version) between 1 and 80),
 confidence numeric(4,3) check (confidence between 0 and 1),
 review_status text not null default 'candidate' check (review_status in ('candidate','accepted','rejected','superseded')),
 fetched_at timestamptz not null,
 created_at timestamptz not null default now(),
 check ((canonical_company_id is null) <> (discovered_record_id is null)),
 check (jsonb_typeof(field_value) in ('string','array','object'))
);
create index if not exists network_company_enrichment_canonical_idx on private.network_company_enrichment(canonical_company_id,review_status);
create index if not exists network_company_enrichment_discovered_idx on private.network_company_enrichment(discovered_record_id,review_status);
create unique index if not exists network_company_enrichment_canonical_dedupe on private.network_company_enrichment(canonical_company_id,field_key,evidence_url,extractor_version) where canonical_company_id is not null;
create unique index if not exists network_company_enrichment_discovered_dedupe on private.network_company_enrichment(discovered_record_id,field_key,evidence_url,extractor_version) where discovered_record_id is not null;
alter table private.network_company_enrichment enable row level security;
revoke all on private.network_company_enrichment from public,anon,authenticated;
comment on table private.network_company_enrichment is 'Internal candidate evidence; never automatically published or verified.';

-- Service-role-only ingestion. The caller cannot choose trust/publication state.
create or replace function public.netprofile1c3_ingest_evidence(
 p_canonical_company_id uuid,
 p_discovered_record_id uuid,
 p_candidates jsonb
) returns integer
language plpgsql security definer set search_path to ''
as $$
declare
 v_item jsonb;
 v_count integer := 0;
 v_field text;
 v_url text;
 v_value jsonb;
begin
 if (select auth.role()) is distinct from 'service_role' then
  raise exception 'Service role required' using errcode='42501';
 end if;
 if (p_canonical_company_id is null) = (p_discovered_record_id is null) then
  raise exception 'Exactly one company reference required' using errcode='22023';
 end if;
 if p_canonical_company_id is not null and not exists (
  select 1 from public.network_companies where id=p_canonical_company_id
 ) then raise exception 'Unknown company' using errcode='22023'; end if;
 if p_discovered_record_id is not null and not exists (
  select 1 from private.netfast_discovered_records where id=p_discovered_record_id
 ) then raise exception 'Unknown discovery' using errcode='22023'; end if;
 if jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) not between 1 and 20 then
  raise exception 'Invalid candidate batch' using errcode='22023';
 end if;
 for v_item in select value from jsonb_array_elements(p_candidates) loop
  v_field := v_item->>'field_key';
  v_url := v_item->>'evidence_url';
  v_value := v_item->'field_value';
  if v_field not in ('description','products','services','industry','city','region','website')
     or v_url is null or length(v_url) > 2048 or v_url !~* '^https://'
     or jsonb_typeof(v_value) not in ('string','array','object')
     or nullif(v_item->>'extractor_version','') is null
     or length(v_item->>'extractor_version')>80
     or nullif(v_item->>'fetched_at','') is null
     or length(coalesce(v_item->>'evidence_excerpt',''))>1200
  then raise exception 'Invalid evidence entry' using errcode='22023'; end if;
  insert into private.network_company_enrichment (
   canonical_company_id,discovered_record_id,field_key,field_value,
   evidence_url,evidence_excerpt,extractor_version,fetched_at,review_status,confidence
  ) values (
   p_canonical_company_id,p_discovered_record_id,v_field,v_value,
   v_url,v_item->>'evidence_excerpt',v_item->>'extractor_version',
   (v_item->>'fetched_at')::timestamptz,'candidate',null
  ) on conflict do nothing;
  get diagnostics v_count = row_count;
 end loop;
 return (select count(*) from private.network_company_enrichment
  where (canonical_company_id=p_canonical_company_id and p_canonical_company_id is not null)
    or (discovered_record_id=p_discovered_record_id and p_discovered_record_id is not null));
end $$;
revoke all on function public.netprofile1c3_ingest_evidence(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.netprofile1c3_ingest_evidence(uuid,uuid,jsonb) to service_role;
