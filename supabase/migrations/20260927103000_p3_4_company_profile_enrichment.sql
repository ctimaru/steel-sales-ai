-- P3.4 — Company Profile Enrichment: Facilities & Capabilities
-- Adds evidence-backed enrichment proposals to the existing discovery staging model.
-- Existing companies may be enriched only after explicit Superadmin review.
-- No company-managed field is overwritten and no identity merge is performed.

alter table public.network_company_discovery_candidates
  add column if not exists facility_candidates jsonb not null default '[]'::jsonb,
  add column if not exists capability_keys text[] not null default '{}'::text[],
  add column if not exists market_keys text[] not null default '{}'::text[],
  add column if not exists enrichment_quality jsonb not null default '{}'::jsonb;

alter table public.network_company_discovery_candidates
  drop constraint if exists network_company_discovery_candidates_p34_enrichment_check;
alter table public.network_company_discovery_candidates
  add constraint network_company_discovery_candidates_p34_enrichment_check
  check (
    jsonb_typeof(facility_candidates)='array'
    and jsonb_array_length(facility_candidates)<=12
    and pg_column_size(facility_candidates)<=32768
    and cardinality(capability_keys)<=32
    and array_position(capability_keys,null) is null
    and cardinality(market_keys)<=32
    and array_position(market_keys,null) is null
    and jsonb_typeof(enrichment_quality)='object'
    and pg_column_size(enrichment_quality)<=8192
  );

alter table public.network_company_discovery_candidates
  drop constraint if exists network_company_discovery_candidates_review_status_check;
alter table public.network_company_discovery_candidates
  add constraint network_company_discovery_candidates_review_status_check
  check (review_status in (
    'pending_review','published','rejected','duplicate_existing','enriched_existing'
  ));

alter table public.network_company_discovery_candidates
  drop constraint if exists network_company_discovery_candidates_review_integrity_check;
alter table public.network_company_discovery_candidates
  add constraint network_company_discovery_candidates_review_integrity_check
  check (
    (review_status='pending_review'
      and reviewed_by is null
      and reviewed_at is null
      and promoted_company_id is null)
    or
    (review_status='published'
      and reviewed_by is not null
      and reviewed_at is not null
      and promoted_company_id is not null)
    or
    (review_status in ('rejected','duplicate_existing','enriched_existing')
      and reviewed_by is not null
      and reviewed_at is not null
      and promoted_company_id is null)
  );

create index if not exists network_company_discovery_candidates_capabilities_idx
  on public.network_company_discovery_candidates using gin(capability_keys);

create index if not exists network_company_discovery_candidates_markets_idx
  on public.network_company_discovery_candidates using gin(market_keys);

create unique index if not exists network_facilities_company_public_location_unique
  on public.network_facilities(
    company_id,
    lower(name),
    lower(coalesce(address_line_1,'')),
    lower(coalesce(city,'')),
    coalesce(postal_code,''),
    country_code
  )
  where publication_status<>'archived';

create or replace function private.p3_admin_discovery_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_items jsonb;
  v_total integer;
  v_limit integer;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  if p_status is not null and p_status not in (
    'pending_review','published','rejected','duplicate_existing','enriched_existing'
  ) then
    raise exception 'invalid candidate status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  select count(*)::integer into v_total
  from public.network_company_discovery_candidates c
  where p_status is null or c.review_status=p_status;

  select coalesce(
    jsonb_agg(to_jsonb(q) order by q.confidence desc,q.created_at desc),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      c.id,c.run_id,c.legal_name,c.trading_name,c.country_code,
      c.website_url,c.canonical_domain,c.description,
      c.role_keys,c.subtype_keys,c.product_relations,c.evidence,c.source_urls,
      c.match_company_id,c.match_signals,c.confidence,c.review_status,
      c.extraction_version,c.identity_quality,c.classification_scores,c.quality_flags,
      c.facility_candidates,c.capability_keys,c.market_keys,c.enrichment_quality,
      c.reviewed_at,c.review_note,c.promoted_company_id,c.created_at
    from public.network_company_discovery_candidates c
    where p_status is null or c.review_status=p_status
    order by c.confidence desc,c.created_at desc
    limit v_limit
  ) q;

  return jsonb_build_object(
    'items',v_items,
    'total',v_total,
    'limit',v_limit,
    'quality',jsonb_build_object(
      'flagged',(
        select count(*) from public.network_company_discovery_candidates c
        where (p_status is null or c.review_status=p_status)
          and cardinality(c.quality_flags)>0
      ),
      'exact_identity_matches',(
        select count(*) from public.network_company_discovery_candidates c
        where (p_status is null or c.review_status=p_status)
          and c.match_company_id is not null
          and (
            c.match_signals ? 'website_domain_exact'
            or c.match_signals ? 'country_vat_exact'
          )
          and jsonb_array_length(c.facility_candidates)=0
          and cardinality(c.capability_keys)=0
          and cardinality(c.market_keys)=0
      ),
      'enrichment_ready',(
        select count(*) from public.network_company_discovery_candidates c
        where (p_status is null or c.review_status=p_status)
          and c.match_company_id is not null
          and (
            c.match_signals ? 'website_domain_exact'
            or c.match_signals ? 'country_vat_exact'
          )
          and (
            jsonb_array_length(c.facility_candidates)>0
            or cardinality(c.capability_keys)>0
            or cardinality(c.market_keys)>0
          )
      )
    )
  );
end;
$function$;

create or replace function private.p3_close_exact_discovery_duplicates_impl(
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  if p_note is not null and char_length(p_note)>2000 then
    raise exception 'review note exceeds 2000 characters' using errcode='22023';
  end if;

  update public.network_company_discovery_candidates c
  set
    review_status='duplicate_existing',
    reviewed_by=v_user_id,
    reviewed_at=now(),
    review_note=coalesce(
      nullif(btrim(coalesce(p_note,'')),''),
      'P3.4 bulk review: exact identity match with no enrichment payload.'
    )
  where c.review_status='pending_review'
    and c.match_company_id is not null
    and (
      c.match_signals ? 'website_domain_exact'
      or c.match_signals ? 'country_vat_exact'
    )
    and jsonb_array_length(c.facility_candidates)=0
    and cardinality(c.capability_keys)=0
    and cardinality(c.market_keys)=0;

  get diagnostics v_count=row_count;

  return jsonb_build_object(
    'status','completed',
    'closed_count',v_count,
    'merge_performed',false,
    'enrichment_candidates_preserved',true,
    'hard_signals',jsonb_build_array('website_domain_exact','country_vat_exact')
  );
end;
$function$;

create or replace function private.p3_enrich_existing_company_discovery_impl(
  p_candidate_id uuid,
  p_existing_company_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_company_id uuid;
  v_company_name text;
  v_assertion_id uuid;
  v_facility_assertion_id uuid;
  v_facility_id uuid;
  v_single_facility_id uuid;
  v_facility jsonb;
  v_note text;
  v_invalid text;
  v_country text;
  v_facility_name text;
  v_facility_type text;
  v_address_line_1 text;
  v_address_line_2 text;
  v_postal_code text;
  v_city text;
  v_region text;
  v_website_url text;
  v_source_url text;
  v_facility_count integer:=0;
  v_market_count integer:=0;
  v_capability_count integer:=0;
  v_existing_facility_count integer:=0;
  v_identity_count integer:=0;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'review note exceeds 2000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;
  if v_candidate.review_status<>'pending_review' then
    raise exception 'only pending discovery candidates can be enriched' using errcode='22023';
  end if;

  v_company_id:=coalesce(p_existing_company_id,v_candidate.match_company_id);
  if v_company_id is null
     or v_candidate.match_company_id is distinct from v_company_id
     or not (
       v_candidate.match_signals ? 'website_domain_exact'
       or v_candidate.match_signals ? 'country_vat_exact'
     ) then
    raise exception 'hard exact identity match required for enrichment' using errcode='22023';
  end if;

  select c.legal_name into v_company_name
  from public.network_companies c
  where c.id=v_company_id and c.publication_status<>'archived';

  if not found then
    raise exception 'existing Network company not found' using errcode='P0002';
  end if;

  -- Enrichment writes new governed Network data, so an exact signal must resolve
  -- to one and only one legal entity at decision time. Shared corporate domains
  -- (for example multiple subsidiaries on one website) are never sufficient.
  if v_candidate.match_signals ? 'country_vat_exact' then
    select count(*)::integer into v_identity_count
    from public.network_companies c
    where c.publication_status<>'archived'
      and c.country_code=v_candidate.country_code
      and upper(c.vat_id)=upper(v_candidate.vat_id);

    if v_identity_count<>1 or not exists (
      select 1 from public.network_companies c
      where c.id=v_company_id
        and c.publication_status<>'archived'
        and c.country_code=v_candidate.country_code
        and upper(c.vat_id)=upper(v_candidate.vat_id)
    ) then
      raise exception 'VAT identity signal is not unique for enrichment' using errcode='22023';
    end if;
  elsif v_candidate.match_signals ? 'website_domain_exact' then
    select count(*)::integer into v_identity_count
    from public.network_companies c
    where c.publication_status<>'archived'
      and lower(c.website_domain)=lower(v_candidate.canonical_domain);

    if v_identity_count<>1 or not exists (
      select 1 from public.network_companies c
      where c.id=v_company_id
        and c.publication_status<>'archived'
        and lower(c.website_domain)=lower(v_candidate.canonical_domain)
    ) then
      raise exception 'website domain is ambiguous for enrichment' using errcode='22023';
    end if;
  else
    raise exception 'hard exact identity match required for enrichment' using errcode='22023';
  end if;

  if jsonb_array_length(v_candidate.facility_candidates)=0
     and cardinality(v_candidate.capability_keys)=0
     and cardinality(v_candidate.market_keys)=0 then
    raise exception 'candidate has no enrichment payload' using errcode='22023';
  end if;

  select k into v_invalid
  from unnest(v_candidate.capability_keys) k
  where not exists (
    select 1 from public.network_capabilities c
    where c.canonical_key=k and c.status='active'
  )
  limit 1;
  if v_invalid is not null then
    raise exception 'unknown active capability key: %',v_invalid using errcode='22023';
  end if;

  select k into v_invalid
  from unnest(v_candidate.market_keys) k
  where not exists (
    select 1 from public.network_markets m
    where m.canonical_key=k and m.status='active'
  )
  limit 1;
  if v_invalid is not null then
    raise exception 'unknown active market key: %',v_invalid using errcode='22023';
  end if;

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,asserted_by,
    confidence,review_state
  )
  values(
    'company',v_company_id,'p3_4_public_web_enrichment',
    jsonb_build_object(
      'crawler_candidate_id',v_candidate.id,
      'facility_candidates',v_candidate.facility_candidates,
      'capability_keys',to_jsonb(v_candidate.capability_keys),
      'market_keys',to_jsonb(v_candidate.market_keys),
      'enrichment_quality',v_candidate.enrichment_quality,
      'evidence',v_candidate.evidence,
      'source_urls',v_candidate.source_urls
    ),
    'public_web',v_candidate.source_url,'platform_curated',v_user_id,
    v_candidate.confidence,'accepted'
  )
  returning id into v_assertion_id;

  insert into public.network_company_markets(
    company_id,market_id,source_assertion_id
  )
  select v_company_id,m.id,v_assertion_id
  from unnest(v_candidate.market_keys) k
  join public.network_markets m on m.canonical_key=k and m.status='active'
  on conflict (company_id,market_id) do nothing;
  get diagnostics v_market_count=row_count;

  for v_facility in
    select value from jsonb_array_elements(v_candidate.facility_candidates)
  loop
    if jsonb_typeof(v_facility)<>'object' then
      raise exception 'facility candidate must be a JSON object' using errcode='22023';
    end if;

    v_country:=upper(coalesce(nullif(btrim(v_facility->>'country_code'),''),v_candidate.country_code));
    v_address_line_1:=nullif(btrim(v_facility->>'address_line_1'),'');
    v_address_line_2:=nullif(btrim(v_facility->>'address_line_2'),'');
    v_postal_code:=nullif(btrim(v_facility->>'postal_code'),'');
    v_city:=nullif(btrim(v_facility->>'city'),'');
    v_region:=nullif(btrim(v_facility->>'region'),'');
    v_website_url:=nullif(btrim(v_facility->>'website_url'),'');
    v_source_url:=coalesce(nullif(btrim(v_facility->>'source_url'),''),v_candidate.source_url);
    v_facility_type:=coalesce(nullif(btrim(v_facility->>'facility_type'),''),'public_business_location');
    v_facility_name:=coalesce(
      nullif(btrim(v_facility->>'name'),''),
      case when v_city is not null then v_company_name||' — '||v_city else v_company_name||' — public location' end
    );

    if v_country !~ '^[A-Z]{2}$'
       or (v_address_line_1 is null and v_city is null) then
      raise exception 'facility candidate requires valid country and address/city' using errcode='22023';
    end if;

    v_facility_id:=null;
    select f.id into v_facility_id
    from public.network_facilities f
    where f.company_id=v_company_id
      and f.publication_status<>'archived'
      and lower(f.name)=lower(v_facility_name)
      and lower(coalesce(f.address_line_1,''))=lower(coalesce(v_address_line_1,''))
      and lower(coalesce(f.city,''))=lower(coalesce(v_city,''))
      and coalesce(f.postal_code,'')=coalesce(v_postal_code,'')
      and f.country_code=v_country
    limit 1;

    if v_facility_id is null then
      insert into public.network_facilities(
        company_id,name,facility_type,address_line_1,address_line_2,
        postal_code,city,region,country_code,website_url,
        publication_status,verification_status
      )
      values(
        v_company_id,v_facility_name,v_facility_type,v_address_line_1,v_address_line_2,
        v_postal_code,v_city,v_region,v_country,v_website_url,
        'published','unverified'
      )
      on conflict do nothing
      returning id into v_facility_id;

      if v_facility_id is null then
        select f.id into v_facility_id
        from public.network_facilities f
        where f.company_id=v_company_id
          and f.publication_status<>'archived'
          and lower(f.name)=lower(v_facility_name)
          and lower(coalesce(f.address_line_1,''))=lower(coalesce(v_address_line_1,''))
          and lower(coalesce(f.city,''))=lower(coalesce(v_city,''))
          and coalesce(f.postal_code,'')=coalesce(v_postal_code,'')
          and f.country_code=v_country
        limit 1;
      end if;
    end if;

    if v_facility_id is null then
      raise exception 'facility enrichment could not resolve a target facility' using errcode='P0001';
    end if;

    insert into public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,
      source_type,source_reference,ownership_type,asserted_by,
      confidence,review_state
    )
    values(
      'facility',v_facility_id,'p3_4_public_web_location',v_facility,
      'public_web',v_source_url,'platform_curated',v_user_id,
      v_candidate.confidence,'accepted'
    )
    returning id into v_facility_assertion_id;

    v_facility_count:=v_facility_count+1;
    if jsonb_array_length(v_candidate.facility_candidates)=1 then
      v_single_facility_id:=v_facility_id;
    end if;
  end loop;

  if jsonb_array_length(v_candidate.facility_candidates)=0 then
    select count(*)::integer,min(f.id)
    into v_existing_facility_count,v_single_facility_id
    from public.network_facilities f
    where f.company_id=v_company_id
      and f.publication_status='published';

    if v_existing_facility_count<>1 then
      v_single_facility_id:=null;
    end if;
  end if;

  if v_single_facility_id is not null and cardinality(v_candidate.capability_keys)>0 then
    insert into public.network_facility_capabilities(
      facility_id,capability_id,source_assertion_id,verification_status
    )
    select v_single_facility_id,c.id,v_assertion_id,'unverified'
    from unnest(v_candidate.capability_keys) k
    join public.network_capabilities c on c.canonical_key=k and c.status='active'
    on conflict (facility_id,capability_id) do nothing;
    get diagnostics v_capability_count=row_count;
  end if;

  update public.network_company_discovery_candidates
  set
    review_status='enriched_existing',
    reviewed_by=v_user_id,
    reviewed_at=now(),
    review_note=v_note
  where id=p_candidate_id;

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'status','enriched_existing',
    'company_id',v_company_id,
    'merge_performed',false,
    'company_fields_overwritten',false,
    'facility_candidates_applied',v_facility_count,
    'markets_added',v_market_count,
    'capabilities_added',v_capability_count,
    'capabilities_deferred',
      cardinality(v_candidate.capability_keys)>0 and v_single_facility_id is null
  );
end;
$function$;

revoke all on function private.p3_enrich_existing_company_discovery_impl(uuid,uuid,text)
  from public,anon;
grant execute on function private.p3_enrich_existing_company_discovery_impl(uuid,uuid,text)
  to authenticated,service_role;

create or replace function public.p3_enrich_existing_company_discovery(
  p_candidate_id uuid,
  p_existing_company_id uuid default null,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_enrich_existing_company_discovery_impl(
    p_candidate_id,p_existing_company_id,p_note
  );
$function$;

revoke all on function public.p3_enrich_existing_company_discovery(uuid,uuid,text)
  from public,anon;
grant execute on function public.p3_enrich_existing_company_discovery(uuid,uuid,text)
  to authenticated,service_role;

comment on function public.p3_enrich_existing_company_discovery(uuid,uuid,text) is
  'P3.4 Superadmin-only additive enrichment for a hard exact existing-company match. Adds accepted public-web assertions, facilities, markets and only unambiguous facility capabilities. Never merges identities or overwrites company-managed fields.';
