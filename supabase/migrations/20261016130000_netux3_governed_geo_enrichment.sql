-- NET-UX3 — Governed geo enrichment of EXISTING published Italian companies.
-- Strictly no auto-publication, no crawler promotion and no private Company Memory.
-- Reuses CRAWL-IT6.1 staged evidence and its separate human approval.
create table if not exists public.network_it_geo_publication_ledger (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null unique references public.network_it_geo_evidence_candidates(id) on delete restrict,
  company_id uuid not null references public.network_companies(id) on delete restrict,
  facility_id uuid not null references public.network_facilities(id) on delete restrict,
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  publication_note text not null check (length(btrim(publication_note)) between 12 and 2000)
);
alter table public.network_it_geo_publication_ledger enable row level security;
revoke all on public.network_it_geo_publication_ledger from public,anon,authenticated;
grant select on public.network_it_geo_publication_ledger to service_role;

-- Only the superadmin/operator with discovery.read can view the missing-region worklist.
-- An empty staging table is shown as zero, not as evidence that locations do not exist.
create or replace function public.netux3_geographic_backlog()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_data jsonb;
begin
  perform private.require_platform_permission('discovery.read');
  with missing as (
    select c.id,c.legal_name,c.website_url,c.website_domain
    from public.network_companies c
    where c.publication_status='published' and c.archived_at is null and c.country_code='IT'
      and not exists (
        select 1 from public.network_facilities f
        where f.company_id=c.id and f.publication_status='published' and f.archived_at is null
          and f.country_code='IT' and nullif(btrim(f.region),'') is not null
      )
  )
  select jsonb_build_object(
    'contract','netux3-backlog-v1',
    'missing_region',(select count(*) from missing),
    'istat_municipalities',(select count(*) from public.network_it_municipalities),
    'pending_evidence',(select count(*) from public.network_it_geo_evidence_candidates e
                         join missing m on m.id=e.company_id where e.status='pending_review'),
    'ready_for_publication',(select count(*) from public.network_it_geo_evidence_candidates e
                            join missing m on m.id=e.company_id
                            where e.status='approved_for_facility_review'
                              and not exists(select 1 from public.network_it_geo_publication_ledger l where l.evidence_id=e.id)),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',m.id,'legal_name',m.legal_name,'website_url',m.website_url,
        'website_domain',m.website_domain,'pending_evidence',(
          select count(*) from public.network_it_geo_evidence_candidates e
          where e.company_id=m.id and e.status='pending_review'
        ),'approved_evidence',(
          select count(*) from public.network_it_geo_evidence_candidates e
          where e.company_id=m.id and e.status='approved_for_facility_review'
            and not exists(select 1 from public.network_it_geo_publication_ledger l where l.evidence_id=e.id)
        )
      ) order by m.legal_name,m.id) from missing m
    ),'[]'::jsonb)
  ) into v_data;
  return v_data;
end;
$$;

-- Operator creates an evidence CANDIDATE only. City, region and source snippet
-- must be explicitly observed on an official company website; NEVER inferred from the name.
create or replace function public.netux3_stage_official_geo(
  p_company_id uuid,p_source_url text,p_city text,p_region text,p_evidence_snippet text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_company public.network_companies%rowtype;
  v_host text;
  v_domain text;
  v_id uuid;
  v_region text;
begin
  perform private.require_platform_permission('discovery.enrich');
  select * into v_company from public.network_companies
  where id=p_company_id and publication_status='published'
    and archived_at is null and country_code='IT';
  if not found then
    raise exception 'Published Italian company required' using errcode='22023';
  end if;
  if coalesce(p_source_url,'') !~* '^https://[a-z0-9][a-z0-9.-]+(/[^\s]*)?$'
    or length(p_source_url)>1800 then
    raise exception 'A secure official website URL is required' using errcode='22023';
  end if;
  v_host := regexp_replace(lower(split_part(split_part(p_source_url,'/',3),':',1)),'^www\.','');
  v_domain := regexp_replace(lower(coalesce(v_company.website_domain,'')),'^www\.','');
  if length(v_domain)<4 or position('.' in v_domain)=0
     or (v_host<>v_domain and right(v_host,length(v_domain)+1)<>'.'||v_domain) then
    raise exception 'Evidence source must match the published company website domain'
      using errcode='42501';
  end if;
  if length(btrim(coalesce(p_city,''))) not between 2 and 120
     or length(btrim(coalesce(p_evidence_snippet,''))) not between 20 and 1500
     or strpos(lower(p_evidence_snippet),lower(btrim(p_city)))=0 then
    raise exception 'City needs a corresponding explicit quoted evidence snippet'
      using errcode='22023';
  end if;
  v_region := (select region from unnest(array[
    'Abruzzo','Basilicata','Calabria','Campania','Emilia-Romagna',
    'Friuli-Venezia Giulia','Lazio','Liguria','Lombardia','Marche',
    'Molise','Piemonte','Puglia','Sardegna','Sicilia','Toscana',
    'Trentino-Alto Adige','Umbria','Valle d''Aosta','Veneto'
  ]) region where lower(region)=lower(btrim(p_region)) limit 1);
  if v_region is null then raise exception 'Region must be one of the 20 official regions' using errcode='22023'; end if;
  if exists (
    select 1 from public.network_facilities f
    where f.company_id=p_company_id and f.publication_status='published'
      and f.archived_at is null and lower(btrim(f.city))=lower(btrim(p_city))
      and lower(btrim(f.region))=lower(v_region)
  ) then raise exception 'This published company location already exists' using errcode='23505'; end if;

  -- Prevent repeated operator submissions of the same evidence; review remains
  -- independent and the candidate cannot be published through this function.
  select e.id into v_id from public.network_it_geo_evidence_candidates e
  where e.company_id=p_company_id and lower(e.source_url)=lower(btrim(p_source_url))
    and lower(e.city)=lower(btrim(p_city)) and e.status in ('pending_review','approved_for_facility_review')
  order by e.created_at limit 1;
  if v_id is not null then
    return jsonb_build_object('id',v_id,'status','already_staged','facility_published',false);
  end if;
  insert into public.network_it_geo_evidence_candidates(
    company_id,source_url,source_kind,source_company_domain,city,region,evidence_snippet,
    status
  ) values(
    p_company_id,btrim(p_source_url),'company_official_site',v_domain,btrim(p_city),
    v_region,btrim(p_evidence_snippet),'pending_review'
  ) returning id into v_id;
  return jsonb_build_object('id',v_id,'status','pending_review','facility_published',false);
end;
$$;

-- A separate approval was already recorded through CRAWL-IT6.1.
-- Publication requires an additional explicit decision + note and
-- logs provenance. Never labels an unverified address as "verified".
create or replace function public.netux3_publish_reviewed_geo(
  p_evidence_id uuid,p_publication_note text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v public.network_it_geo_evidence_candidates%rowtype;
  c public.network_companies%rowtype;
  v_facility_id uuid;
  v_host text;
  v_domain text;
begin
  perform private.require_platform_permission('discovery.publish');
  perform private.require_platform_permission('discovery.governance_review');
  if length(btrim(coalesce(p_publication_note,''))) not between 12 and 2000 then
    raise exception 'A separate explicit publication note is required' using errcode='22023';
  end if;
  select * into v from public.network_it_geo_evidence_candidates
  where id=p_evidence_id for update;
  if not found or v.status<>'approved_for_facility_review'
    or v.reviewed_by is null or v.reviewed_at is null then
    raise exception 'Reviewed and approved geographic evidence required' using errcode='42501';
  end if;
  select facility_id into v_facility_id from public.network_it_geo_publication_ledger
  where evidence_id=v.id;
  if found then return jsonb_build_object('status','already_published','facility_id',v_facility_id); end if;
  select * into c from public.network_companies
  where id=v.company_id and publication_status='published'
    and archived_at is null and country_code='IT';
  if not found then raise exception 'Target company no longer published' using errcode='42501'; end if;
  if v.source_kind <> 'company_official_site' or v.region is null or v.city is null then
    raise exception 'Official website with explicit city and region required' using errcode='42501';
  end if;
  v_host:=regexp_replace(lower(split_part(split_part(v.source_url,'/',3),':',1)),'^www\.','');
  v_domain:=regexp_replace(lower(coalesce(c.website_domain,'')),'^www\.','');
  if length(v_domain)<4 or
     (v_host<>v_domain and right(v_host,length(v_domain)+1)<>'.'||v_domain) then
    raise exception 'Company website identity mismatch' using errcode='42501';
  end if;
  -- Recheck for duplicate publication: an approved candidate is not an override
  -- of a facility modified by the owning company since evidence review.
  select f.id into v_facility_id from public.network_facilities f
  where f.company_id=v.company_id and f.publication_status='published' and f.archived_at is null
    and lower(btrim(f.city))=lower(btrim(v.city))
    and lower(btrim(f.region))=lower(btrim(v.region))
  order by f.created_at limit 1;
  if v_facility_id is null then
    insert into public.network_facilities(
      company_id,name,facility_type,city,region,country_code,
      publication_status,verification_status
    ) values(
      v.company_id,'Sede — '||v.city,'site',v.city,v.region,'IT',
      'published','unverified'
    ) returning id into v_facility_id;
    insert into public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
      ownership_type,asserted_by,review_state
    ) values (
      'facility',v_facility_id,'location',
      jsonb_build_object('city',v.city,'region',v.region,'evidence_id',v.id),
      'public_web',v.source_url,'platform_curated',auth.uid(),'accepted'
    );
  end if;
  insert into public.network_it_geo_publication_ledger(
    evidence_id,company_id,facility_id,published_by,publication_note
  ) values (v.id,v.company_id,v_facility_id,auth.uid(),btrim(p_publication_note));
  return jsonb_build_object('status','published','facility_id',v_facility_id,'evidence_id',v.id);
end;
$$;

create or replace function public.netux3_reviewed_geo_queue()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
  perform private.require_platform_permission('discovery.read');
  select jsonb_build_object(
    'contract','netux3-approved-v1',
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'company_id',e.company_id,'legal_name',c.legal_name,
      'city',e.city,'region',e.region,'source_url',e.source_url,
      'evidence_snippet',e.evidence_snippet,'review_note',e.review_note,
      'reviewed_at',e.reviewed_at
    ) order by e.reviewed_at nulls last), '[]'::jsonb)
  ) into v_result
  from public.network_it_geo_evidence_candidates e
  join public.network_companies c on c.id=e.company_id
  where e.status='approved_for_facility_review'
    and c.publication_status='published' and c.archived_at is null
    and not exists(select 1 from public.network_it_geo_publication_ledger l where l.evidence_id=e.id);
  return v_result;
end;
$$;

revoke all on function public.netux3_geographic_backlog() from public,anon,authenticated;
revoke all on function public.netux3_stage_official_geo(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.netux3_publish_reviewed_geo(uuid,text) from public,anon,authenticated;
revoke all on function public.netux3_reviewed_geo_queue() from public,anon,authenticated;
grant execute on function public.netux3_geographic_backlog() to authenticated;
grant execute on function public.netux3_stage_official_geo(uuid,text,text,text,text) to authenticated;
grant execute on function public.netux3_publish_reviewed_geo(uuid,text) to authenticated;
grant execute on function public.netux3_reviewed_geo_queue() to authenticated;
comment on function public.netux3_publish_reviewed_geo(uuid,text) is
 'NET-UX3 explicitly approved geo staging -> second human publish -> provenance ledger; no automatic crawler publication.';
