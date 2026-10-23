-- TRUST-AUDIT1C.2G.3D — forward-only repair for PL/pgSQL lint errors.
-- Preserve historical migration files and function privileges/security contexts.
-- min(uuid) is undefined. Casting to text chooses an identifier; when a single
-- facility exists, the selected UUID is identical to the prior intended result.
-- Rename ambiguous local accepted/skipped counters in netlaunch2 to v_ aliases.
-- No change to grants, publication, rights, network rows, or role guards.

-- private.p3_enrich_existing_company_discovery_impl
CREATE OR REPLACE FUNCTION private.p3_enrich_existing_company_discovery_impl(p_candidate_id uuid, p_existing_company_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform private.require_platform_permission('discovery.review');
  perform private.require_platform_permission('discovery.enrich');

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
    select count(*)::integer,min(f.id::text)::uuid
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

  perform private.sa5_record_discovery_action(
    'discovery.enrich',
    'discovery_candidate_enriched',
    'discovery_candidate',
    p_candidate_id::text,
    jsonb_build_object('status','pending_review'),
    jsonb_build_object(
      'status','enriched_existing',
      'company_id',v_company_id,
      'facility_candidates_applied',v_facility_count,
      'markets_added',v_market_count,
      'capabilities_added',v_capability_count
    ),
    v_note
  );

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

-- private.p3_enrich_existing_company_discovery_selected_impl
CREATE OR REPLACE FUNCTION private.p3_enrich_existing_company_discovery_selected_impl(p_candidate_id uuid, p_existing_company_id uuid, p_note text, p_include_facilities boolean, p_capability_keys text[], p_market_keys text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_selected_capabilities text[];
  v_selected_markets text[];
  v_facility_count integer:=0;
  v_market_count integer:=0;
  v_capability_count integer:=0;
  v_existing_facility_count integer:=0;
  v_identity_count integer:=0;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.review');
  perform private.require_platform_permission('discovery.enrich');

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

  -- A shared website is not enough to attach industrial facts to a legal entity.
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
  end if;

  select coalesce(array_agg(distinct k order by k),'{}'::text[])
  into v_selected_capabilities
  from unnest(coalesce(p_capability_keys,'{}'::text[])) k
  where k is not null and btrim(k)<>'';

  select coalesce(array_agg(distinct k order by k),'{}'::text[])
  into v_selected_markets
  from unnest(coalesce(p_market_keys,'{}'::text[])) k
  where k is not null and btrim(k)<>'';

  -- Review may only narrow a proposal; it may never invent a taxonomy relation.
  select k into v_invalid
  from unnest(v_selected_capabilities) k
  where not (k=any(v_candidate.capability_keys))
  limit 1;
  if v_invalid is not null then
    raise exception 'capability was not proposed by crawler: %',v_invalid using errcode='22023';
  end if;

  select k into v_invalid
  from unnest(v_selected_markets) k
  where not (k=any(v_candidate.market_keys))
  limit 1;
  if v_invalid is not null then
    raise exception 'market was not proposed by crawler: %',v_invalid using errcode='22023';
  end if;

  select k into v_invalid
  from unnest(v_selected_capabilities) k
  where not exists (
    select 1 from public.network_capabilities c
    where c.canonical_key=k and c.status='active'
  )
  limit 1;
  if v_invalid is not null then
    raise exception 'unknown active capability key: %',v_invalid using errcode='22023';
  end if;

  select k into v_invalid
  from unnest(v_selected_markets) k
  where not exists (
    select 1 from public.network_markets m
    where m.canonical_key=k and m.status='active'
  )
  limit 1;
  if v_invalid is not null then
    raise exception 'unknown active market key: %',v_invalid using errcode='22023';
  end if;

  if not coalesce(p_include_facilities,false)
     and cardinality(v_selected_capabilities)=0
     and cardinality(v_selected_markets)=0 then
    raise exception 'select at least one enrichment item' using errcode='22023';
  end if;

  if coalesce(p_include_facilities,false)
     and jsonb_array_length(v_candidate.facility_candidates)=0
     and cardinality(v_selected_capabilities)=0
     and cardinality(v_selected_markets)=0 then
    raise exception 'candidate has no facility proposal to approve' using errcode='22023';
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
      'proposed',jsonb_build_object(
        'facility_candidates',v_candidate.facility_candidates,
        'capability_keys',to_jsonb(v_candidate.capability_keys),
        'market_keys',to_jsonb(v_candidate.market_keys)
      ),
      'approved',jsonb_build_object(
        'include_facilities',coalesce(p_include_facilities,false),
        'capability_keys',to_jsonb(v_selected_capabilities),
        'market_keys',to_jsonb(v_selected_markets)
      ),
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
  from unnest(v_selected_markets) k
  join public.network_markets m on m.canonical_key=k and m.status='active'
  on conflict (company_id,market_id) do nothing;
  get diagnostics v_market_count=row_count;

  if coalesce(p_include_facilities,false) then
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
  end if;

  -- Capability is facility-scoped. Use a newly-approved single facility, or one
  -- already-published facility when there is exactly one unambiguous target.
  if v_single_facility_id is null and cardinality(v_selected_capabilities)>0 then
    select count(*)::integer,min(f.id::text)::uuid
    into v_existing_facility_count,v_single_facility_id
    from public.network_facilities f
    where f.company_id=v_company_id
      and f.publication_status='published';

    if v_existing_facility_count<>1 then
      v_single_facility_id:=null;
    end if;
  end if;

  if v_single_facility_id is not null and cardinality(v_selected_capabilities)>0 then
    insert into public.network_facility_capabilities(
      facility_id,capability_id,source_assertion_id,verification_status
    )
    select v_single_facility_id,c.id,v_assertion_id,'unverified'
    from unnest(v_selected_capabilities) k
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

  perform private.sa5_record_discovery_action(
    'discovery.enrich',
    'discovery_candidate_enriched',
    'discovery_candidate',
    p_candidate_id::text,
    jsonb_build_object('status','pending_review'),
    jsonb_build_object(
      'status','enriched_existing',
      'company_id',v_company_id,
      'facility_candidates_applied',v_facility_count,
      'markets_added',v_market_count,
      'capabilities_added',v_capability_count
    ),
    v_note
  );

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
      cardinality(v_selected_capabilities)>0 and v_single_facility_id is null,
    'approved',jsonb_build_object(
      'include_facilities',coalesce(p_include_facilities,false),
      'capability_keys',to_jsonb(v_selected_capabilities),
      'market_keys',to_jsonb(v_selected_markets)
    )
  );
end;
$function$;

-- public.netlaunch2_commit_daily
CREATE OR REPLACE FUNCTION public.netlaunch2_commit_daily(p_run_id uuid, p_items jsonb, p_counts jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r public.network_netlaunch2_runs%rowtype;
 src public.network_discovery_source_registry%rowtype;
 itm jsonb;sector text;qid text;nm text;dom text;web text;
 claimed_count integer;v_accepted integer:=0;added integer:=0;v_skipped integer:=0;
 seen_count integer:=0;delta integer;v_day date:=(now() at time zone 'UTC')::date;
begin
 if current_user<>'service_role' then raise exception 'NET-LAUNCH2 worker only' using errcode='42501';end if;
 select * into r from public.network_netlaunch2_runs
 where id=p_run_id and status='claimed' and run_day=v_day for update;
 if not found then raise exception 'NET-LAUNCH2 daily run not found' using errcode='42501';end if;
 select * into src from public.network_discovery_source_registry
 where id='8425ec0f-c855-41d8-9bea-70a95fd8a6ba'::uuid;
 if not found or src.governance_status<>'approved' or not src.enabled_for_discovery
 or src.source_url<>'https://query.wikidata.org/sparql'
 or src.terms_status<>'allows_reuse' or src.database_rights_status<>'low_risk'
 or src.personal_data_policy<>'exclude_personal_data'
 or src.rights_evidence_url<>'https://www.wikidata.org/wiki/Wikidata:Licensing'
 or src.reviewed_by is null or src.reviewed_at is null or src.max_domains_per_run<200
 then raise exception 'NET-LAUNCH2 source approval revoked' using errcode='42501';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>200
  or jsonb_typeof(p_counts)<>'object' or
  (select count(*) from jsonb_object_keys(p_counts))<>2
 then raise exception 'NET-LAUNCH2 invalid batch' using errcode='22023';end if;
 foreach sector in array r.industry_ids loop
  if not p_counts ? sector or (p_counts->>sector) !~ '^[0-9]{1,3}$'
   then raise exception 'NET-LAUNCH2 missing sector count' using errcode='22023';end if;
  claimed_count:=(p_counts->>sector)::integer;
  if claimed_count not between 0 and 100 then raise exception 'NET-LAUNCH2 raw count exceeds source budget' using errcode='22023';end if;
  seen_count:=seen_count+claimed_count;
 end loop;
 for itm in select value from jsonb_array_elements(p_items) loop
   v_accepted:=v_accepted+1;
   if jsonb_typeof(itm)<>'object' or (select count(*) from jsonb_object_keys(itm))<>5
   or not (itm ?& array['qid','label','domain','website','industry_qid'])
   then v_skipped:=v_skipped+1;continue;end if;
   sector:=itm->>'industry_qid';qid:=itm->>'qid';
   nm:=btrim(coalesce(itm->>'label',''));
   dom:=lower(btrim(coalesce(itm->>'domain','')));
   web:=coalesce(itm->>'website','');
   if not sector=any(r.industry_ids) or qid !~ '^Q[1-9][0-9]{0,13}$'
    or length(nm) not between 3 and 180 or nm ~* '(https?://|[@<>[:cntrl:]])'
    or dom !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
    or dom like '%..%' or web<>('https://'||dom||'/')
    or dom ~* '(^|[.])(facebook|linkedin|instagram|youtube|wikidata|wikipedia|google|twitter|tiktok|wordpress)[.]'
   then v_skipped:=v_skipped+1;continue;end if;
   if exists(select 1 from public.network_companies c where c.archived_at is null
      and regexp_replace(lower(coalesce(c.website_domain,'')),'^www[.]','')=dom)
   or exists(select 1 from public.network_company_discovery_candidates c where c.canonical_domain=dom)
   or exists(select 1 from public.network_core_target_leads t where t.canonical_domain=dom)
   or exists(select 1 from public.network_netfast3_entities e where e.domain=dom)
   or exists(select 1 from public.network_netfast3_suppressed_domains x where x.domain=dom)
   then v_skipped:=v_skipped+1;continue;end if;
   insert into public.network_netfast2_structured_entities(
     source_entity_id,company_name,domain,website_url,industry_qid)
   values(qid,nm,dom,web,sector) on conflict do nothing;
   get diagnostics delta=row_count;
   added:=added+delta;v_skipped:=v_skipped+1-delta;
 end loop;
 if v_accepted>seen_count then raise exception 'More records than downloaded from Wikidata' using errcode='22023';end if;
 foreach sector in array r.industry_ids loop
   claimed_count:=(p_counts->>sector)::integer;
   update public.network_netlaunch2_cursors
   set next_offset=case when claimed_count<100 then 0
       when ((r.offsets->>sector)::integer+claimed_count)>2000 then 0
       else (r.offsets->>sector)::integer+claimed_count end,
       updated_at=now()
   where industry_qid=sector and next_offset=(r.offsets->>sector)::integer;
   get diagnostics delta=row_count;
   if delta<>1 then raise exception 'NET-LAUNCH2 cursor changed: concurrent run' using errcode='42501';end if;
 end loop;
 update public.network_netlaunch2_runs
 set status='completed',finished_at=now(),
 queried=seen_count,accepted=v_accepted,inserted=added,skipped=v_skipped where id=p_run_id;
 return jsonb_build_object('status','completed','queried',seen_count,
 'accepted',v_accepted,'new_unconfirmed',added,'duplicate_or_rejected',v_skipped,'canonical_published',0);
end $function$;

-- Enforce the original worker-only execute boundary explicitly without widening it.
REVOKE ALL ON FUNCTION public.netlaunch2_commit_daily(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
