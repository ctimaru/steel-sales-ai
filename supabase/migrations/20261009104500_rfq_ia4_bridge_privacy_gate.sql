-- RFQ-IA4: make the private-to-public boundary explicit in the DB.
-- No target €/t, price, internal line note, email or negotiation messages
-- are copied to Marketplace by the RFQ bridge.
-- Existing prepared drafts are sanitized again at publication time.
create or replace function private.rfqh8_prepare_marketplace_bridge_impl(
  p_rfq_id uuid,
  p_product_family_key text,
  p_visibility_mode text,
  p_delivery_country_code text,
  p_delivery_region text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_existing public.buyer_rfq_marketplace_bridges%rowtype;
  v_family public.network_product_families%rowtype;
  v_request_id uuid;
  v_bridge_id uuid;
  v_line public.buyer_distinta_lines%rowtype;
  v_market_line_id uuid;
  v_standard_id uuid;
  v_grade_id uuid;
  v_line_count integer;
  v_recent_count integer;
  v_visibility text:=lower(btrim(coalesce(p_visibility_mode,'named')));
  v_country text:=upper(btrim(coalesce(p_delivery_country_code,'')));
  v_region text:=nullif(btrim(coalesce(p_delivery_region,'')),'');
  v_family_key text:=btrim(coalesce(p_product_family_key,''));
  v_suggestion_count integer:=0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into v_campaign
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id and r.owner_user_id=v_user_id;

  if not found then
    raise exception 'RFQ not found or not accessible' using errcode='42501';
  end if;

  perform private.p5_1_require_actor(v_campaign.organization_id,true);

  if v_campaign.status in('awarded','closed','cancelled') then
    raise exception 'RFQ is no longer eligible for Marketplace bridge';
  end if;

  select * into v_existing
  from public.buyer_rfq_marketplace_bridges b
  where b.rfq_id=p_rfq_id;

  if found then
    select count(*)::int into v_suggestion_count
    from private.p5_5_compute_request_matches(v_existing.marketplace_request_id);

    return jsonb_build_object(
      'bridge_id',v_existing.id,
      'marketplace_request_id',v_existing.marketplace_request_id,
      'status',v_existing.status,
      'suggestion_count',v_suggestion_count,
      'existing',true
    );
  end if;

  if v_visibility not in('named','anonymous') then
    raise exception 'Marketplace visibility must be named or anonymous';
  end if;

  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'Delivery country must be a two-letter code';
  end if;

  select * into v_family
  from public.network_product_families pf
  where pf.canonical_key=v_family_key
    and pf.status='active'
    and pf.searchable=true;

  if not found then
    raise exception 'Marketplace product family not available';
  end if;

  select count(*)::int into v_line_count
  from public.buyer_distinta_lines l
  where l.distinta_id=v_campaign.source_distinta_id;

  if v_line_count<1 then
    raise exception 'RFQ has no source lines';
  end if;

  if v_line_count>25 then
    raise exception 'Marketplace bridge supports up to 25 lines';
  end if;

  select count(*)::int into v_recent_count
  from public.marketplace_requests r
  where r.organization_id=v_campaign.organization_id
    and r.created_at>=now()-interval '24 hours';

  if v_recent_count>=20 then
    raise exception 'Organization marketplace request rate limit exceeded';
  end if;

  insert into public.marketplace_requests(
    organization_id,created_by_user_id,title,visibility_mode,status,source_kind
  ) values(
    v_campaign.organization_id,
    v_user_id,
    left('RFQ · '||v_campaign.title,200),
    v_visibility,
    'draft',
    'rfq_hub'
  )
  returning id into v_request_id;

  perform private.p5_1_record_event(
    v_request_id,'created',v_user_id,v_campaign.organization_id,
    jsonb_build_object('visibility_mode',v_visibility,'source_kind','rfq_hub','rfq_id',p_rfq_id)
  );

  insert into public.buyer_rfq_marketplace_bridges(
    rfq_id,marketplace_request_id,owner_user_id,organization_id,
    status,product_family_key,visibility_mode,delivery_country_code,delivery_region
  ) values(
    p_rfq_id,v_request_id,v_user_id,v_campaign.organization_id,
    'draft',v_family.canonical_key,v_visibility,v_country,v_region
  )
  returning id into v_bridge_id;

  for v_line in
    select *
    from public.buyer_distinta_lines l
    where l.distinta_id=v_campaign.source_distinta_id
    order by l.line_position
  loop
    v_standard_id:=null;
    v_grade_id:=null;

    select s.id into v_standard_id
    from public.steel_standards s
    where s.status='active'
      and lower(btrim(s.code))=lower(btrim(coalesce(v_line.standard_code,'')))
      and exists(
        select 1
        from public.network_product_family_steel_mappings map
        join public.steel_standard_product_families spf
          on spf.product_family=map.steel_product_family
         and spf.standard_id=s.id
        where map.network_product_family_id=v_family.id
      )
    order by s.code
    limit 1;

    if v_standard_id is not null and nullif(btrim(coalesce(v_line.grade_code,'')),'') is not null then
      select sg.material_grade_id into v_grade_id
      from public.steel_standard_grades sg
      where sg.standard_id=v_standard_id
        and lower(btrim(sg.grade))=lower(btrim(v_line.grade_code))
      order by sg.id
      limit 1;
    end if;

    insert into public.marketplace_request_lines(
      request_id,line_number,product_family_id,standard_id,material_grade_id,
      manufacturing_process,outer_diameter_mm,width_mm,height_mm,thickness_mm,length_mm,
      quantity,quantity_unit,certification,delivery_country_code,delivery_region,
      requested_delivery_date,notes
    ) values(
      v_request_id,v_line.line_position,v_family.id,v_standard_id,v_grade_id,
      null,null,null,null,null,
      case when v_line.bar_length_m is null then null else v_line.bar_length_m*1000 end,
      v_line.line_tonnes,'t',null,v_country,v_region,null,
      left(
        concat_ws(' · ',
          nullif(v_line.description,''),
          case when nullif(v_line.standard_code,'') is not null then 'Norma '||v_line.standard_code end,
          case when nullif(v_line.grade_code,'') is not null then 'Grado '||v_line.grade_code end,
          case when nullif(v_line.finish_code,'') is not null then 'Finitura '||v_line.finish_code end
        ),
        2000
      )
    )
    returning id into v_market_line_id;

    insert into public.buyer_rfq_marketplace_line_links(
      bridge_id,rfq_line_id,marketplace_request_line_id,owner_user_id,organization_id
    ) values(
      v_bridge_id,v_line.id,v_market_line_id,v_user_id,v_campaign.organization_id
    );

    perform private.p5_1_record_event(
      v_request_id,'line_added',v_user_id,v_campaign.organization_id,
      jsonb_build_object(
        'line_id',v_market_line_id,
        'line_number',v_line.line_position,
        'product_family_key',v_family.canonical_key,
        'source','rfq_hub'
      )
    );
  end loop;

  if private.pa1_3_network_access_allowed_for(v_campaign.organization_id) then
    select count(*)::int into v_suggestion_count
    from private.p5_5_compute_request_matches(v_request_id);
  end if;

  perform private.rfqh3_log_event(
    p_rfq_id,null,v_user_id,v_campaign.organization_id,
    'marketplace_bridge_prepared',
    jsonb_build_object(
      'bridge_id',v_bridge_id,
      'marketplace_request_id',v_request_id,
      'product_family_key',v_family.canonical_key,
      'visibility_mode',v_visibility,
      'delivery_country_code',v_country,
      'suggestion_count',v_suggestion_count
    ),
    v_user_id
  );

  return jsonb_build_object(
    'bridge_id',v_bridge_id,
    'marketplace_request_id',v_request_id,
    'status','draft',
    'suggestion_count',v_suggestion_count,
    'existing',false
  );
end;
$$;

create or replace function private.rfqh8_publish_marketplace_bridge_impl(
  p_rfq_id uuid,
  p_closes_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_bridge public.buyer_rfq_marketplace_bridges%rowtype;
  v_publish jsonb;
  v_matches jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into v_campaign
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id and r.owner_user_id=v_user_id;

  if not found then
    raise exception 'RFQ not found or not accessible' using errcode='42501';
  end if;

  if v_campaign.status in('awarded','closed','cancelled') then
    raise exception 'RFQ is no longer eligible for Marketplace publication';
  end if;

  select * into v_bridge
  from public.buyer_rfq_marketplace_bridges b
  where b.rfq_id=p_rfq_id
  for update;

  if not found then
    raise exception 'Prepare the Marketplace bridge before publishing';
  end if;

  if v_bridge.status='published' then
    return jsonb_build_object(
      'bridge_id',v_bridge.id,
      'marketplace_request_id',v_bridge.marketplace_request_id,
      'status','published',
      'already_published',true,
      'matches',private.p5_5_buyer_match_summary_impl(
        v_campaign.organization_id,v_bridge.marketplace_request_id
      )
    );
  end if;

  -- RFQ-IA4 privacy gate: sanitize already-prepared legacy drafts as well as
  -- new ones. Buyer free-form line notes are not consented public content.
  -- Keep description, norm, grade, finish and quantities as approved demand.
  update public.marketplace_request_lines ml
  set notes=left(
    concat_ws(' · ',
      nullif(l.description,''),
      case when nullif(l.standard_code,'') is not null then 'Norma '||l.standard_code end,
      case when nullif(l.grade_code,'') is not null then 'Grado '||l.grade_code end,
      case when nullif(l.finish_code,'') is not null then 'Finitura '||l.finish_code end
    ),
    2000
  )
  from public.buyer_rfq_marketplace_line_links link
  join public.buyer_distinta_lines l on l.id=link.rfq_line_id
  where link.bridge_id=v_bridge.id
    and ml.id=link.marketplace_request_line_id
    and ml.request_id=v_bridge.marketplace_request_id;

  v_publish:=private.p5_1_publish_request_impl(
    v_bridge.marketplace_request_id,p_closes_at
  );

  update public.buyer_rfq_marketplace_bridges
  set status='published',published_at=now(),updated_at=now()
  where id=v_bridge.id;

  v_matches:=private.p5_5_refresh_request_matches_impl(
    v_bridge.marketplace_request_id
  );

  perform private.rfqh3_log_event(
    p_rfq_id,null,v_user_id,v_campaign.organization_id,
    'marketplace_bridge_published',
    jsonb_build_object(
      'bridge_id',v_bridge.id,
      'marketplace_request_id',v_bridge.marketplace_request_id,
      'publish',v_publish,
      'matches',v_matches
    ),
    v_user_id
  );

  return jsonb_build_object(
    'bridge_id',v_bridge.id,
    'marketplace_request_id',v_bridge.marketplace_request_id,
    'status','published',
    'already_published',false,
    'publish',v_publish,
    'matches',v_matches
  );
end;
$$;

-- Existing RFQ bridges were audited before deployment; no published
-- rows currently require retrospective correction.
