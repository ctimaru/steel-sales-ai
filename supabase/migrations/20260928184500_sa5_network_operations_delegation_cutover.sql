-- SA5 — Network Operations Delegation Cutover.
--
-- Delegates Company Discovery to capability-authorized Platform Staff while
-- preserving Claims, Knowledge and staff governance as separate domains.
-- The crawler still writes only staging candidates; publishing and enrichment
-- remain explicit human decisions.

create or replace function private.sa5_record_discovery_action(
  p_permission_key text,
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_reason text default null
)
returns uuid
language sql
security definer
set search_path=''
as $function$
  select private.sa2_record_platform_event(
    p_permission_key,
    p_action,
    p_entity_type,
    p_entity_id,
    null,
    p_before_state,
    p_after_state,
    p_reason,
    jsonb_build_object('surface','company_discovery')
  );
$function$;

revoke all on function private.sa5_record_discovery_action(text,text,text,text,jsonb,jsonb,text)
  from public,anon,authenticated;

create or replace function private.p3_start_company_discovery_impl(
  p_country_code text,
  p_seed_urls jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run_id uuid;
  v_country text;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.run');

  v_country:=upper(btrim(coalesce(p_country_code,'IT')));
  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;

  if p_seed_urls is null
     or jsonb_typeof(p_seed_urls)<>'array'
     or jsonb_array_length(p_seed_urls)<1
     or jsonb_array_length(p_seed_urls)>100 then
    raise exception 'seed_urls must contain 1..100 URLs' using errcode='22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_seed_urls) u(url)
    where btrim(url) !~* '^https?://'
       or char_length(url)>2000
  ) then
    raise exception 'all seed URLs must be absolute http(s) URLs' using errcode='22023';
  end if;

  insert into public.network_company_discovery_runs(
    requested_by,country_code,seed_urls,status
  )
  values(v_user_id,v_country,p_seed_urls,'queued')
  returning id into v_run_id;

  perform private.sa5_record_discovery_action(
    'discovery.run',
    'discovery_run_started',
    'discovery_run',
    v_run_id::text,
    null,
    jsonb_build_object('status','queued','country_code',v_country,'seed_count',jsonb_array_length(p_seed_urls)),
    null
  );

  return jsonb_build_object(
    'run_id',v_run_id,
    'status','queued',
    'country_code',v_country,
    'seed_count',jsonb_array_length(p_seed_urls)
  );
end;
$function$;

create or replace function private.p3_start_company_discovery_batch_impl(
  p_country_code text,
  p_seed_urls jsonb,
  p_source_type text,
  p_source_reference text default null,
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run_id uuid;
  v_country text;
  v_source_type text;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.run');

  v_country:=upper(btrim(coalesce(p_country_code,'IT')));
  v_source_type:=lower(btrim(coalesce(p_source_type,'manual_url')));

  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;

  if v_source_type not in (
    'manual_url','web_search_curated','industry_directory',
    'association','registry','other'
  ) then
    raise exception 'invalid discovery source type' using errcode='22023';
  end if;

  if p_seed_urls is null
     or jsonb_typeof(p_seed_urls)<>'array'
     or jsonb_array_length(p_seed_urls)<1
     or jsonb_array_length(p_seed_urls)>100 then
    raise exception 'seed_urls must contain 1..100 URLs' using errcode='22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_seed_urls) u(url)
    where btrim(url) !~* '^https?://'
       or char_length(url)>2000
  ) then
    raise exception 'all seed URLs must be absolute http(s) URLs' using errcode='22023';
  end if;

  if p_source_reference is not null and char_length(p_source_reference)>2000 then
    raise exception 'source reference exceeds 2000 characters' using errcode='22023';
  end if;
  if p_label is not null and char_length(p_label)>255 then
    raise exception 'label exceeds 255 characters' using errcode='22023';
  end if;

  insert into public.network_company_discovery_runs(
    requested_by,country_code,seed_urls,status,
    source_type,source_reference,label,extraction_version
  )
  values(
    v_user_id,v_country,p_seed_urls,'queued',
    v_source_type,nullif(btrim(coalesce(p_source_reference,'')),''),
    nullif(btrim(coalesce(p_label,'')),''),
    'p3.3-v2'
  )
  returning id into v_run_id;

  perform private.sa5_record_discovery_action(
    'discovery.run',
    'discovery_run_started',
    'discovery_run',
    v_run_id::text,
    null,
    jsonb_build_object(
      'status','queued',
      'country_code',v_country,
      'seed_count',jsonb_array_length(p_seed_urls),
      'source_type',v_source_type
    ),
    null
  );

  return jsonb_build_object(
    'run_id',v_run_id,
    'status','queued',
    'country_code',v_country,
    'seed_count',jsonb_array_length(p_seed_urls),
    'source_type',v_source_type,
    'extraction_version','p3.3-v2'
  );
end;
$function$;

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
  perform private.require_platform_permission('discovery.read');

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

create or replace function private.p3_admin_discovery_runs_impl(
  p_limit integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_limit integer;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.read');

  v_limit:=least(greatest(coalesce(p_limit,25),1),100);

  return (
    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb)
    from (
      select
        r.id,r.label,r.source_type,r.source_reference,r.country_code,r.status,
        jsonb_array_length(r.seed_urls) seed_count,
        r.candidate_count,r.skipped_count,r.error_count,r.exact_match_count,
        r.extraction_version,r.stats,r.error,r.started_at,r.completed_at,r.created_at
      from public.network_company_discovery_runs r
      order by r.created_at desc
      limit v_limit
    ) q
  );
end;
$function$;

create or replace function private.p3_admin_discovery_detail_impl(p_candidate_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.read');

  select jsonb_build_object(
    'candidate',to_jsonb(c),
    'run',jsonb_build_object(
      'id',r.id,'country_code',r.country_code,'status',r.status,
      'seed_urls',r.seed_urls,'candidate_count',r.candidate_count,
      'created_at',r.created_at,'started_at',r.started_at,'completed_at',r.completed_at
    ),
    'matched_company',case when m.id is null then null else jsonb_build_object(
      'id',m.id,'legal_name',m.legal_name,'country_code',m.country_code,
      'website_domain',m.website_domain,'publication_status',m.publication_status,
      'claimed_status',m.claimed_status,'verification_status',m.verification_status
    ) end
  )
  into v_result
  from public.network_company_discovery_candidates c
  join public.network_company_discovery_runs r on r.id=c.run_id
  left join public.network_companies m on m.id=c.match_company_id
  where c.id=p_candidate_id;

  if v_result is null then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;
  return v_result;
end;
$function$;

create or replace function private.p3_review_company_discovery_impl(
  p_candidate_id uuid,
  p_decision text,
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
  v_assertion_id uuid;
  v_existing_id uuid;
  v_note text;
  v_invalid text;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.review');

  if p_decision='publish_new' then
    perform private.require_platform_permission('discovery.publish');
  end if;

  if p_decision not in ('publish_new','reject','duplicate_existing') then
    raise exception 'invalid discovery review decision' using errcode='22023';
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
    raise exception 'only pending discovery candidates can be reviewed' using errcode='22023';
  end if;

  if p_decision='reject' then
    update public.network_company_discovery_candidates
    set review_status='rejected',reviewed_by=v_user_id,reviewed_at=now(),review_note=v_note
    where id=p_candidate_id;

    perform private.sa5_record_discovery_action(
      'discovery.review',
      'discovery_candidate_rejected',
      'discovery_candidate',
      p_candidate_id::text,
      jsonb_build_object('status','pending_review'),
      jsonb_build_object('status','rejected'),
      v_note
    );

    return jsonb_build_object('candidate_id',p_candidate_id,'status','rejected','company_id',null);
  end if;

  if p_decision='duplicate_existing' then
    if p_existing_company_id is null
       or not exists(select 1 from public.network_companies where id=p_existing_company_id and publication_status<>'archived') then
      raise exception 'valid existing company required for duplicate decision' using errcode='22023';
    end if;
    update public.network_company_discovery_candidates
    set
      review_status='duplicate_existing',
      match_company_id=p_existing_company_id,
      reviewed_by=v_user_id,
      reviewed_at=now(),
      review_note=v_note
    where id=p_candidate_id;

    perform private.sa5_record_discovery_action(
      'discovery.review',
      'discovery_candidate_marked_duplicate',
      'discovery_candidate',
      p_candidate_id::text,
      jsonb_build_object('status','pending_review'),
      jsonb_build_object(
        'status','duplicate_existing',
        'company_id',p_existing_company_id,
        'merge_performed',false
      ),
      v_note
    );

    return jsonb_build_object(
      'candidate_id',p_candidate_id,'status','duplicate_existing',
      'company_id',p_existing_company_id,'merge_performed',false
    );
  end if;

  -- Re-check exact identity signals at decision time. A crawler candidate may never
  -- silently create a duplicate legal entity.
  select c.id into v_existing_id
  from public.network_companies c
  where c.publication_status<>'archived'
    and (
      (nullif(v_candidate.canonical_domain,'') is not null
        and lower(c.website_domain)=lower(v_candidate.canonical_domain))
      or (v_candidate.vat_id is not null
        and c.country_code=v_candidate.country_code
        and upper(c.vat_id)=upper(v_candidate.vat_id))
      or (v_candidate.registration_id is not null
        and c.country_code=v_candidate.country_code
        and upper(c.registration_id)=upper(v_candidate.registration_id))
      or (
        c.country_code=v_candidate.country_code
        and c.normalized_legal_name=lower(regexp_replace(btrim(v_candidate.legal_name),'\s+',' ','g'))
      )
    )
  order by
    case when lower(c.website_domain)=lower(v_candidate.canonical_domain) then 0 else 1 end,
    c.created_at
  limit 1;

  if v_existing_id is not null then
    raise exception 'existing Network identity match requires duplicate_existing review decision'
      using errcode='23505',
            detail='existing_company_id='||v_existing_id::text;
  end if;

  select k into v_invalid
  from unnest(v_candidate.role_keys) k
  where not exists (
    select 1 from public.network_company_roles r
    where r.canonical_key=k and r.status='active'
  )
  limit 1;
  if v_invalid is not null then
    raise exception 'unknown active role key: %',v_invalid using errcode='22023';
  end if;

  select k into v_invalid
  from unnest(v_candidate.subtype_keys) k
  where not exists (
    select 1 from public.network_company_subtypes s
    where s.canonical_key=k and s.status='active'
  )
  limit 1;
  if v_invalid is not null then
    raise exception 'unknown active subtype key: %',v_invalid using errcode='22023';
  end if;

  select e->>'key' into v_invalid
  from jsonb_array_elements(v_candidate.product_relations) e
  where coalesce(e->>'relationship_type','') not in ('produces','distributes','stocks','processes','uses')
     or not exists (
       select 1 from public.network_product_families p
       where p.canonical_key=e->>'key' and p.status='active'
     )
  limit 1;
  if v_invalid is not null then
    raise exception 'invalid product relationship for key: %',v_invalid using errcode='22023';
  end if;

  insert into public.network_companies(
    legal_name,trading_name,country_code,registration_id,vat_id,
    website_url,website_domain,description,
    publication_status,claimed_status,verification_status
  )
  values(
    v_candidate.legal_name,v_candidate.trading_name,v_candidate.country_code,
    v_candidate.registration_id,v_candidate.vat_id,
    v_candidate.website_url,v_candidate.canonical_domain,v_candidate.description,
    'published','unclaimed','unverified'
  )
  returning id into v_company_id;

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,asserted_by,
    confidence,review_state
  )
  values(
    'company',v_company_id,'p3_2_discovery_snapshot',
    jsonb_build_object(
      'legal_name',v_candidate.legal_name,
      'trading_name',v_candidate.trading_name,
      'country_code',v_candidate.country_code,
      'vat_id',v_candidate.vat_id,
      'registration_id',v_candidate.registration_id,
      'website_url',v_candidate.website_url,
      'canonical_domain',v_candidate.canonical_domain,
      'description',v_candidate.description,
      'role_keys',to_jsonb(v_candidate.role_keys),
      'subtype_keys',to_jsonb(v_candidate.subtype_keys),
      'product_relations',v_candidate.product_relations,
      'evidence',v_candidate.evidence,
      'source_urls',v_candidate.source_urls,
      'crawler_candidate_id',v_candidate.id
    ),
    'public_web',v_candidate.source_url,'platform_curated',v_user_id,
    v_candidate.confidence,'accepted'
  )
  returning id into v_assertion_id;

  insert into public.network_company_role_assignments(
    company_id,role_id,is_primary,source_assertion_id
  )
  select
    v_company_id,r.id,(u.ordinality=1),v_assertion_id
  from unnest(v_candidate.role_keys) with ordinality u(key,ordinality)
  join public.network_company_roles r on r.canonical_key=u.key
  order by u.ordinality;

  insert into public.network_company_subtype_assignments(
    company_id,subtype_id,source_assertion_id
  )
  select v_company_id,s.id,v_assertion_id
  from unnest(v_candidate.subtype_keys) k
  join public.network_company_subtypes s on s.canonical_key=k;

  insert into public.network_company_products(
    company_id,product_family_id,relationship_type,source_assertion_id
  )
  select distinct
    v_company_id,p.id,e->>'relationship_type',v_assertion_id
  from jsonb_array_elements(v_candidate.product_relations) e
  join public.network_product_families p on p.canonical_key=e->>'key';

  update public.network_company_discovery_candidates
  set
    review_status='published',
    reviewed_by=v_user_id,
    reviewed_at=now(),
    review_note=v_note,
    promoted_company_id=v_company_id
  where id=p_candidate_id;

  perform private.sa5_record_discovery_action(
    'discovery.publish',
    'discovery_candidate_published',
    'discovery_candidate',
    p_candidate_id::text,
    jsonb_build_object('status','pending_review'),
    jsonb_build_object(
      'status','published',
      'company_id',v_company_id,
      'claimed_status','unclaimed',
      'verification_status','unverified'
    ),
    v_note
  );

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'status','published',
    'company_id',v_company_id,
    'claimed_status','unclaimed',
    'verification_status','unverified',
    'automatic_merge_performed',false
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
  perform private.require_platform_permission('discovery.close_duplicates');

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

  perform private.sa5_record_discovery_action(
    'discovery.close_duplicates',
    'discovery_exact_duplicates_closed',
    'discovery_queue',
    null,
    null,
    jsonb_build_object('closed_count',v_count,'merge_performed',false),
    p_note
  );

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

create or replace function private.p3_enrich_existing_company_discovery_selected_impl(
  p_candidate_id uuid,
  p_existing_company_id uuid,
  p_note text,
  p_include_facilities boolean,
  p_capability_keys text[],
  p_market_keys text[]
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
    select count(*)::integer,min(f.id)
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

comment on function public.p3_start_company_discovery(text,jsonb) is
  'SA5 legacy discovery run entrypoint. Requires discovery.run.';
comment on function public.p3_start_company_discovery_batch(text,jsonb,text,text,text) is
  'SA5 provenance-labelled discovery batch entrypoint. Requires discovery.run.';
comment on function public.p3_admin_discovery_queue(text,integer) is
  'SA5 Company Discovery queue. Requires discovery.read.';
comment on function public.p3_admin_discovery_runs(integer) is
  'SA5 Company Discovery run telemetry. Requires discovery.read.';
comment on function public.p3_admin_discovery_detail(uuid) is
  'SA5 Company Discovery detail. Requires discovery.read.';
comment on function public.p3_review_company_discovery(uuid,text,uuid,text) is
  'SA5 candidate review. Reject/duplicate require discovery.review; publish_new additionally requires discovery.publish.';
comment on function public.p3_close_exact_discovery_duplicates(text) is
  'SA5 controlled exact-duplicate closure. Requires discovery.close_duplicates and never merges identities.';
comment on function public.p3_enrich_existing_company_discovery(uuid,uuid,text) is
  'SA5 legacy controlled enrichment. Requires discovery.review + discovery.enrich.';
comment on function public.p3_enrich_existing_company_discovery_selected(uuid,uuid,text,boolean,text[],text[]) is
  'SA5 selective controlled enrichment. Requires discovery.review + discovery.enrich.';

do $sa5$
declare
  v_direct_root_gates integer;
  v_read_cutovers integer;
begin
  select count(*) into v_direct_root_gates
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private'
    and p.proname in (
      'p3_start_company_discovery_impl',
      'p3_start_company_discovery_batch_impl',
      'p3_admin_discovery_queue_impl',
      'p3_admin_discovery_runs_impl',
      'p3_admin_discovery_detail_impl',
      'p3_review_company_discovery_impl',
      'p3_close_exact_discovery_duplicates_impl',
      'p3_enrich_existing_company_discovery_impl',
      'p3_enrich_existing_company_discovery_selected_impl'
    )
    and pg_get_functiondef(p.oid) like '%not private.is_platform_superadmin()%';

  if v_direct_root_gates<>0 then
    raise exception 'SA5 Company Discovery cutover left % direct Superadmin gates',v_direct_root_gates;
  end if;

  select count(*) into v_read_cutovers
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private'
    and p.proname in (
      'p3_admin_discovery_queue_impl',
      'p3_admin_discovery_runs_impl',
      'p3_admin_discovery_detail_impl'
    )
    and pg_get_functiondef(p.oid) like '%require_platform_permission(''discovery.read'')%';

  if v_read_cutovers<>3 then
    raise exception 'SA5 expected all three Company Discovery read functions to require discovery.read';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='p3_review_company_discovery_impl'
      and pg_get_functiondef(p.oid) like '%require_platform_permission(''discovery.publish'')%'
  ) then
    raise exception 'SA5 publish decision is not protected by discovery.publish';
  end if;

  if (
    select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname in (
        'p3_enrich_existing_company_discovery_impl',
        'p3_enrich_existing_company_discovery_selected_impl'
      )
      and pg_get_functiondef(p.oid) like '%require_platform_permission(''discovery.enrich'')%'
  )<>2 then
    raise exception 'SA5 expected both enrichment paths to require discovery.enrich';
  end if;
end
$sa5$;
