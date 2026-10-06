alter table public.marketplace_requests
  drop constraint if exists marketplace_requests_source_check;

alter table public.marketplace_requests
  add constraint marketplace_requests_source_check
  check(source_kind in('manual','rfq_hub'));

create table if not exists public.buyer_rfq_marketplace_bridges(
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null unique references public.buyer_rfq_campaigns(id) on delete cascade,
  marketplace_request_id uuid not null unique references public.marketplace_requests(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'draft' check(status in('draft','published','withdrawn')),
  product_family_key text not null check(char_length(product_family_key) between 2 and 80),
  visibility_mode text not null check(visibility_mode in('named','anonymous')),
  delivery_country_code text not null check(delivery_country_code ~ '^[A-Z]{2}$'),
  delivery_region text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists buyer_rfq_marketplace_bridges_owner_idx
  on public.buyer_rfq_marketplace_bridges(owner_user_id,created_at desc);
create index if not exists buyer_rfq_marketplace_bridges_org_idx
  on public.buyer_rfq_marketplace_bridges(organization_id,created_at desc);

create table if not exists public.buyer_rfq_marketplace_line_links(
  id uuid primary key default gen_random_uuid(),
  bridge_id uuid not null references public.buyer_rfq_marketplace_bridges(id) on delete cascade,
  rfq_line_id uuid not null references public.buyer_distinta_lines(id) on delete restrict,
  marketplace_request_line_id uuid not null references public.marketplace_request_lines(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(bridge_id,rfq_line_id),
  unique(marketplace_request_line_id)
);

create index if not exists buyer_rfq_marketplace_line_links_rfq_line_idx
  on public.buyer_rfq_marketplace_line_links(rfq_line_id);
create index if not exists buyer_rfq_marketplace_line_links_owner_idx
  on public.buyer_rfq_marketplace_line_links(owner_user_id,bridge_id);
create index if not exists buyer_rfq_marketplace_line_links_org_idx
  on public.buyer_rfq_marketplace_line_links(organization_id,bridge_id);

create table if not exists public.buyer_rfq_marketplace_response_imports(
  id uuid primary key default gen_random_uuid(),
  bridge_id uuid not null references public.buyer_rfq_marketplace_bridges(id) on delete restrict,
  marketplace_response_id uuid not null unique references public.marketplace_responses(id) on delete restrict,
  supplier_id uuid not null references public.buyer_rfq_suppliers(id) on delete restrict,
  dispatch_id uuid not null references public.buyer_rfq_dispatches(id) on delete restrict,
  quote_id uuid not null references public.buyer_rfq_quotes(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  imported_at timestamptz not null default now()
);

create index if not exists buyer_rfq_marketplace_response_imports_bridge_idx
  on public.buyer_rfq_marketplace_response_imports(bridge_id,imported_at desc);
create index if not exists buyer_rfq_marketplace_response_imports_supplier_idx
  on public.buyer_rfq_marketplace_response_imports(supplier_id);
create index if not exists buyer_rfq_marketplace_response_imports_dispatch_idx
  on public.buyer_rfq_marketplace_response_imports(dispatch_id);
create index if not exists buyer_rfq_marketplace_response_imports_quote_idx
  on public.buyer_rfq_marketplace_response_imports(quote_id);
create index if not exists buyer_rfq_marketplace_response_imports_owner_idx
  on public.buyer_rfq_marketplace_response_imports(owner_user_id,imported_at desc);
create index if not exists buyer_rfq_marketplace_response_imports_org_idx
  on public.buyer_rfq_marketplace_response_imports(organization_id,imported_at desc);

alter table public.buyer_rfq_marketplace_bridges enable row level security;
alter table public.buyer_rfq_marketplace_line_links enable row level security;
alter table public.buyer_rfq_marketplace_response_imports enable row level security;

revoke all on public.buyer_rfq_marketplace_bridges from anon,authenticated;
revoke all on public.buyer_rfq_marketplace_line_links from anon,authenticated;
revoke all on public.buyer_rfq_marketplace_response_imports from anon,authenticated;

grant select on public.buyer_rfq_marketplace_bridges to authenticated;
grant select on public.buyer_rfq_marketplace_line_links to authenticated;
grant select on public.buyer_rfq_marketplace_response_imports to authenticated;

create policy buyer_rfq_marketplace_bridges_owner_select
on public.buyer_rfq_marketplace_bridges
for select to authenticated
using(owner_user_id=(select auth.uid()));

create policy buyer_rfq_marketplace_line_links_owner_select
on public.buyer_rfq_marketplace_line_links
for select to authenticated
using(owner_user_id=(select auth.uid()));

create policy buyer_rfq_marketplace_response_imports_owner_select
on public.buyer_rfq_marketplace_response_imports
for select to authenticated
using(owner_user_id=(select auth.uid()));

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
          case when nullif(v_line.finish_code,'') is not null then 'Finitura '||v_line.finish_code end,
          nullif(v_line.note,'')
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

revoke all on function private.rfqh8_prepare_marketplace_bridge_impl(uuid,text,text,text,text)
from public,anon,authenticated;
grant execute on function private.rfqh8_prepare_marketplace_bridge_impl(uuid,text,text,text,text)
to authenticated;

create or replace function public.rfqh8_prepare_marketplace_bridge(
  p_rfq_id uuid,
  p_product_family_key text default 'tubes_pipes',
  p_visibility_mode text default 'named',
  p_delivery_country_code text default 'IT',
  p_delivery_region text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh8_prepare_marketplace_bridge_impl(
    p_rfq_id,p_product_family_key,p_visibility_mode,p_delivery_country_code,p_delivery_region
  )
$$;

revoke all on function public.rfqh8_prepare_marketplace_bridge(uuid,text,text,text,text)
from public,anon,authenticated;
grant execute on function public.rfqh8_prepare_marketplace_bridge(uuid,text,text,text,text)
to authenticated;

create or replace function private.rfqh8_supplier_suggestions_impl(
  p_rfq_id uuid,
  p_limit integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_bridge public.buyer_rfq_marketplace_bridges%rowtype;
  v_request public.marketplace_requests%rowtype;
  v_limit integer:=least(greatest(coalesce(p_limit,12),1),30);
  v_network_allowed boolean:=false;
  v_result jsonb;
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

  v_network_allowed:=private.pa1_3_network_access_allowed_for(v_campaign.organization_id);

  select * into v_bridge
  from public.buyer_rfq_marketplace_bridges b
  where b.rfq_id=p_rfq_id;

  if not found then
    return jsonb_build_object(
      'contract','RFQH8-supplier-suggestions-v1',
      'rfq_id',p_rfq_id,
      'bridge_ready',false,
      'network_enabled',v_network_allowed,
      'candidates','[]'::jsonb
    );
  end if;

  if not v_network_allowed then
    return jsonb_build_object(
      'contract','RFQH8-supplier-suggestions-v1',
      'rfq_id',p_rfq_id,
      'bridge_ready',true,
      'network_enabled',false,
      'candidates','[]'::jsonb
    );
  end if;

  select * into v_request
  from public.marketplace_requests r
  where r.id=v_bridge.marketplace_request_id;

  with raw as (
    select
      m.supplier_network_company_id,
      m.match_score::integer as match_score,
      m.match_band,
      m.matched_line_count,
      m.total_line_count,
      m.line_matches
    from public.marketplace_matches m
    where v_request.status='published'
      and m.request_id=v_request.id
      and m.status='active'

    union all

    select
      c.supplier_network_company_id,
      c.match_score,
      c.match_band,
      c.matched_line_count,
      c.total_line_count,
      c.line_matches
    from private.p5_5_compute_request_matches(v_request.id) c
    where v_request.status='draft'
  ),
  enriched as (
    select
      raw.*,
      nc.legal_name,
      nc.trading_name,
      nc.country_code,
      nc.claimed_status,
      nc.verification_status,
      best.network_contact_id,
      best.display_name as contact_name,
      best.email,
      linked.organization_id as supplier_organization_id,
      case
        when linked.organization_id is not null and best.email is not null then 'both'
        when linked.organization_id is not null then 'platform'
        else 'email'
      end as delivery_channel
    from raw
    join public.network_companies nc
      on nc.id=raw.supplier_network_company_id
     and nc.publication_status='published'
     and nc.archived_at is null
    left join lateral (
      select * from private.rfqh2_best_network_contact(nc.id)
    ) best on true
    left join lateral (
      select private.rfqh2_linked_supplier_organization(
        nc.id,v_campaign.organization_id
      ) as organization_id
    ) linked on true
    where not exists(
      select 1
      from public.buyer_rfq_suppliers s
      where s.rfq_id=p_rfq_id
        and (
          s.supplier_network_company_id=nc.id
          or (
            linked.organization_id is not null
            and s.supplier_organization_id=linked.organization_id
          )
        )
    )
  ),
  limited as (
    select *
    from enriched
    order by match_score desc,matched_line_count desc,
      coalesce(trading_name,legal_name),supplier_network_company_id
    limit v_limit
  )
  select jsonb_build_object(
    'contract','RFQH8-supplier-suggestions-v1',
    'rfq_id',p_rfq_id,
    'bridge_ready',true,
    'network_enabled',true,
    'marketplace_request_id',v_request.id,
    'marketplace_status',v_request.status,
    'candidates',
    coalesce(jsonb_agg(jsonb_build_object(
      'supplier_network_company_id',supplier_network_company_id,
      'supplier_network_contact_id',network_contact_id,
      'supplier_organization_id',supplier_organization_id,
      'company_name',coalesce(nullif(btrim(trading_name),''),legal_name),
      'contact_name',contact_name,
      'email',email,
      'country_code',country_code,
      'delivery_channel',delivery_channel,
      'match_score',match_score,
      'match_band',match_band,
      'matched_line_count',matched_line_count,
      'total_line_count',total_line_count,
      'line_matches',line_matches,
      'claimed_status',claimed_status,
      'verification_status',verification_status,
      'direct_invite_ready',(email is not null or supplier_organization_id is not null)
    ) order by match_score desc,matched_line_count desc,coalesce(trading_name,legal_name)),'[]'::jsonb)
  )
  into v_result
  from limited;

  return coalesce(v_result,jsonb_build_object(
    'contract','RFQH8-supplier-suggestions-v1',
    'rfq_id',p_rfq_id,
    'bridge_ready',true,
    'network_enabled',true,
    'marketplace_request_id',v_request.id,
    'marketplace_status',v_request.status,
    'candidates','[]'::jsonb
  ));
end;
$$;

revoke all on function private.rfqh8_supplier_suggestions_impl(uuid,integer)
from public,anon,authenticated;
grant execute on function private.rfqh8_supplier_suggestions_impl(uuid,integer)
to authenticated;

create or replace function public.rfqh8_supplier_suggestions(
  p_rfq_id uuid,
  p_limit integer default 12
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
  select private.rfqh8_supplier_suggestions_impl(p_rfq_id,p_limit)
$$;

revoke all on function public.rfqh8_supplier_suggestions(uuid,integer)
from public,anon,authenticated;
grant execute on function public.rfqh8_supplier_suggestions(uuid,integer)
to authenticated;

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

revoke all on function private.rfqh8_publish_marketplace_bridge_impl(uuid,timestamptz)
from public,anon,authenticated;
grant execute on function private.rfqh8_publish_marketplace_bridge_impl(uuid,timestamptz)
to authenticated;

create or replace function public.rfqh8_publish_marketplace_bridge(
  p_rfq_id uuid,
  p_closes_at timestamptz
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh8_publish_marketplace_bridge_impl(p_rfq_id,p_closes_at)
$$;

revoke all on function public.rfqh8_publish_marketplace_bridge(uuid,timestamptz)
from public,anon,authenticated;
grant execute on function public.rfqh8_publish_marketplace_bridge(uuid,timestamptz)
to authenticated;

create or replace function private.rfqh8_import_marketplace_response_impl(
  p_rfq_id uuid,
  p_response_id uuid
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
  v_response public.marketplace_responses%rowtype;
  v_supplier_id uuid;
  v_dispatch_id uuid;
  v_quote_id uuid;
  v_revision integer;
  v_supplier_org_name text;
  v_network_company_id uuid;
  v_network_contact_id uuid;
  v_network_contact_name text;
  v_network_email text;
  v_supplier_name text;
  v_line record;
  v_market_line public.marketplace_response_lines%rowtype;
  v_price_basis text;
  v_unit_price numeric;
  v_eur_t numeric;
  v_eur_m numeric;
  v_offered_quantity numeric;
  v_offered_mode text;
  v_priced_count integer:=0;
  v_imported_count integer:=0;
  v_response_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into v_campaign
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id and r.owner_user_id=v_user_id
  for update;

  if not found then
    raise exception 'RFQ not found or not accessible' using errcode='42501';
  end if;

  if v_campaign.status in('awarded','closed','cancelled') then
    raise exception 'RFQ is closed to Marketplace response imports';
  end if;

  select * into v_bridge
  from public.buyer_rfq_marketplace_bridges b
  where b.rfq_id=p_rfq_id;

  if not found then
    raise exception 'Marketplace bridge not found';
  end if;

  if exists(
    select 1 from public.buyer_rfq_marketplace_response_imports i
    where i.marketplace_response_id=p_response_id
  ) then
    raise exception 'Marketplace response already imported';
  end if;

  select * into v_response
  from public.marketplace_responses r
  where r.id=p_response_id
    and r.request_id=v_bridge.marketplace_request_id
    and r.status in('submitted','acknowledged');

  if not found then
    raise exception 'Marketplace response is not importable';
  end if;

  if v_response.response_kind<>'quote' then
    raise exception 'Only Marketplace quote responses can enter RFQ comparison';
  end if;

  if not exists(
    select 1 from public.marketplace_response_lines rl
    where rl.response_id=v_response.id and rl.unit_price is not null
  ) then
    raise exception 'Marketplace response has no priced lines';
  end if;

  if exists(
    select 1 from public.marketplace_response_lines rl
    where rl.response_id=v_response.id
      and rl.unit_price is not null
      and (
        rl.currency_code is distinct from 'EUR'
        or rl.quantity_unit not in('t','kg','m','pcs')
      )
  ) then
    raise exception 'Marketplace quote contains non-EUR or non-normalizable priced lines';
  end if;

  select o.name into v_supplier_org_name
  from public.organizations o
  where o.id=v_response.supplier_organization_id;

  select l.network_company_id into v_network_company_id
  from public.organization_network_company_links l
  where l.organization_id=v_response.supplier_organization_id
    and l.link_status='active'
  order by l.linked_at desc,l.id
  limit 1;

  if v_network_company_id is not null then
    select b.network_contact_id,b.display_name,b.email
    into v_network_contact_id,v_network_contact_name,v_network_email
    from private.rfqh2_best_network_contact(v_network_company_id) b;
  end if;

  v_supplier_name:=coalesce(
    nullif(btrim(v_supplier_org_name),''),
    (
      select coalesce(nullif(btrim(nc.trading_name),''),nc.legal_name)
      from public.network_companies nc
      where nc.id=v_network_company_id
    ),
    'Marketplace supplier'
  );

  select s.id into v_supplier_id
  from public.buyer_rfq_suppliers s
  where s.rfq_id=p_rfq_id
    and (
      s.supplier_organization_id=v_response.supplier_organization_id
      or (
        v_network_company_id is not null
        and s.supplier_network_company_id=v_network_company_id
      )
    )
  order by s.created_at
  limit 1;

  if v_supplier_id is null then
    insert into public.buyer_rfq_suppliers(
      rfq_id,owner_user_id,supplier_organization_id,supplier_network_company_id,
      supplier_network_contact_id,supplier_name,supplier_email,supplier_email_normalized,
      status,delivery_channel,identity_source,identity_key,resolution_status,resolved_at,responded_at
    ) values(
      p_rfq_id,v_user_id,v_response.supplier_organization_id,v_network_company_id,
      v_network_contact_id,v_supplier_name,v_network_email,
      case when v_network_email is null then null else lower(btrim(v_network_email)) end,
      'responded',
      case when v_network_email is null then 'platform' else 'both' end,
      'platform_organization',
      'organization:'||v_response.supplier_organization_id::text,
      'registered_organization',
      now(),coalesce(v_response.submitted_at,now())
    )
    returning id into v_supplier_id;
  else
    update public.buyer_rfq_suppliers
    set status='responded',
        responded_at=coalesce(responded_at,v_response.submitted_at,now()),
        updated_at=now()
    where id=v_supplier_id;
  end if;

  select d.id into v_dispatch_id
  from public.buyer_rfq_dispatches d
  where d.supplier_id=v_supplier_id;

  if v_dispatch_id is null then
    v_dispatch_id:=gen_random_uuid();

    insert into public.buyer_rfq_dispatches(
      id,rfq_id,supplier_id,owner_user_id,organization_id,
      token_hash,idempotency_key,provider,status,attempt_count,reminder_count,
      queued_at,updated_at
    ) values(
      v_dispatch_id,p_rfq_id,v_supplier_id,v_user_id,v_campaign.organization_id,
      encode(extensions.digest('rfqh8-marketplace:'||p_response_id::text,'sha256'),'hex'),
      'rfqh8-marketplace-'||p_response_id::text,
      'marketplace','responded',0,0,now(),now()
    );
  else
    update public.buyer_rfq_dispatches
    set status='responded',updated_at=now()
    where id=v_dispatch_id;
  end if;

  if exists(
    select 1
    from public.buyer_rfq_quotes q
    where q.supplier_id=v_supplier_id and q.status='draft'
  ) then
    raise exception 'Supplier has a draft RFQ quote; resolve it before importing Marketplace response';
  end if;

  select coalesce(max(q.revision_no),0)+1 into v_revision
  from public.buyer_rfq_quotes q
  where q.dispatch_id=v_dispatch_id;

  update public.buyer_rfq_quotes
  set status='superseded',superseded_at=now(),updated_at=now()
  where dispatch_id=v_dispatch_id and status='submitted';

  insert into public.buyer_rfq_quotes(
    rfq_id,supplier_id,dispatch_id,owner_user_id,organization_id,
    revision_no,status,currency_code,validity_until,notes,submitted_at
  ) values(
    p_rfq_id,v_supplier_id,v_dispatch_id,v_user_id,v_campaign.organization_id,
    v_revision,'submitted','EUR',v_response.valid_until,
    left(
      concat_ws(E'\n',
        'Imported from Marketplace response '||v_response.id::text,
        nullif(v_response.message,'')
      ),
      4000
    ),
    coalesce(v_response.submitted_at,now())
  )
  returning id into v_quote_id;

  for v_line in
    select
      link.rfq_line_id,
      link.marketplace_request_line_id,
      dl.line_position,
      dl.description,
      dl.weight_kg_m,
      dl.bar_length_m
    from public.buyer_rfq_marketplace_line_links link
    join public.buyer_distinta_lines dl on dl.id=link.rfq_line_id
    where link.bridge_id=v_bridge.id
    order by dl.line_position
  loop
    select * into v_market_line
    from public.marketplace_response_lines rl
    where rl.response_id=v_response.id
      and rl.request_line_id=v_line.marketplace_request_line_id;

    v_price_basis:=null;
    v_unit_price:=null;
    v_eur_t:=null;
    v_eur_m:=null;
    v_offered_quantity:=null;
    v_offered_mode:=null;
    v_response_status:='not_available';

    if found and v_market_line.unit_price is not null then
      v_priced_count:=v_priced_count+1;
      v_response_status:='quoted';

      if v_market_line.quantity_unit='t' then
        v_price_basis:='eur_t';
        v_unit_price:=v_market_line.unit_price;
        v_eur_t:=v_market_line.unit_price;
        v_eur_m:=v_market_line.unit_price*v_line.weight_kg_m/1000;
        v_offered_quantity:=v_market_line.offered_quantity;
        v_offered_mode:='tonnes';

      elsif v_market_line.quantity_unit='kg' then
        v_price_basis:='eur_t';
        v_unit_price:=v_market_line.unit_price*1000;
        v_eur_t:=v_market_line.unit_price*1000;
        v_eur_m:=v_market_line.unit_price*v_line.weight_kg_m;
        v_offered_quantity:=case when v_market_line.offered_quantity is null then null else v_market_line.offered_quantity/1000 end;
        v_offered_mode:='tonnes';

      elsif v_market_line.quantity_unit='m' then
        if v_line.weight_kg_m is null or v_line.weight_kg_m<=0 then
          raise exception 'RFQ line weight is required to normalize Marketplace €/m';
        end if;
        v_price_basis:='eur_m';
        v_unit_price:=v_market_line.unit_price;
        v_eur_m:=v_market_line.unit_price;
        v_eur_t:=v_market_line.unit_price*1000/v_line.weight_kg_m;
        v_offered_quantity:=v_market_line.offered_quantity;
        v_offered_mode:='meters';

      elsif v_market_line.quantity_unit='pcs' then
        if v_line.bar_length_m is null or v_line.bar_length_m<=0
          or v_line.weight_kg_m is null or v_line.weight_kg_m<=0 then
          raise exception 'Bar length and weight are required to normalize Marketplace €/pcs';
        end if;
        v_price_basis:='eur_m';
        v_unit_price:=v_market_line.unit_price/v_line.bar_length_m;
        v_eur_m:=v_market_line.unit_price/v_line.bar_length_m;
        v_eur_t:=(v_market_line.unit_price/v_line.bar_length_m)*1000/v_line.weight_kg_m;
        v_offered_quantity:=v_market_line.offered_quantity;
        v_offered_mode:='bars';
      end if;
    end if;

    insert into public.buyer_rfq_quote_lines(
      quote_id,rfq_line_id,line_position,response_status,
      price_basis,unit_price,normalized_eur_t,normalized_eur_m,
      offered_quantity,offered_quantity_mode,lead_time_days,delivery_date,notes
    ) values(
      v_quote_id,v_line.rfq_line_id,v_line.line_position,v_response_status,
      v_price_basis,v_unit_price,v_eur_t,v_eur_m,
      v_offered_quantity,v_offered_mode,
      case when found then v_market_line.lead_time_days else null end,
      case when found then v_market_line.offered_delivery_date else null end,
      case when found then left(v_market_line.notes,2000) else null end
    );

    v_imported_count:=v_imported_count+1;
  end loop;

  if v_priced_count=0 then
    raise exception 'Marketplace quote produced no comparable RFQ lines';
  end if;

  insert into public.buyer_rfq_marketplace_response_imports(
    bridge_id,marketplace_response_id,supplier_id,dispatch_id,quote_id,
    owner_user_id,organization_id
  ) values(
    v_bridge.id,v_response.id,v_supplier_id,v_dispatch_id,v_quote_id,
    v_user_id,v_campaign.organization_id
  );

  if v_campaign.status in('draft','ready') then
    update public.buyer_rfq_campaigns
    set status='collecting',launched_at=coalesce(launched_at,now()),updated_at=now()
    where id=p_rfq_id;
  end if;

  if v_response.status='submitted' then
    update public.marketplace_responses
    set status='acknowledged',decided_at=now(),updated_at=now()
    where id=v_response.id;

    perform private.p5_4_record_event(
      v_response.id,'acknowledged',v_user_id,v_campaign.organization_id,'buyer',
      jsonb_build_object('source','rfq_hub_import','rfq_id',p_rfq_id,'quote_id',v_quote_id)
    );
  end if;

  perform private.rfqh3_log_event(
    p_rfq_id,v_supplier_id,v_user_id,v_campaign.organization_id,
    'marketplace_response_imported',
    jsonb_build_object(
      'bridge_id',v_bridge.id,
      'marketplace_request_id',v_bridge.marketplace_request_id,
      'marketplace_response_id',v_response.id,
      'quote_id',v_quote_id,
      'revision_no',v_revision,
      'priced_line_count',v_priced_count,
      'line_count',v_imported_count
    ),
    v_user_id
  );

  return jsonb_build_object(
    'marketplace_response_id',v_response.id,
    'supplier_id',v_supplier_id,
    'dispatch_id',v_dispatch_id,
    'quote_id',v_quote_id,
    'revision_no',v_revision,
    'priced_line_count',v_priced_count,
    'line_count',v_imported_count
  );
end;
$$;

revoke all on function private.rfqh8_import_marketplace_response_impl(uuid,uuid)
from public,anon,authenticated;
grant execute on function private.rfqh8_import_marketplace_response_impl(uuid,uuid)
to authenticated;

create or replace function public.rfqh8_import_marketplace_response(
  p_rfq_id uuid,
  p_response_id uuid
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh8_import_marketplace_response_impl(p_rfq_id,p_response_id)
$$;

revoke all on function public.rfqh8_import_marketplace_response(uuid,uuid)
from public,anon,authenticated;
grant execute on function public.rfqh8_import_marketplace_response(uuid,uuid)
to authenticated;

create or replace function rfqh_secure.rfqh8_guest_claim_context_impl(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company public.network_companies%rowtype;
  v_supplier public.buyer_rfq_suppliers%rowtype;
begin
  select s.* into v_supplier
  from public.buyer_rfq_dispatches d
  join public.buyer_rfq_suppliers s on s.id=d.supplier_id
  where d.token_hash=p_token_hash
    and d.status not in('cancelled','failed','bounced','complained')
  limit 1;

  if not found or v_supplier.supplier_network_company_id is null then
    return jsonb_build_object('available',false);
  end if;

  select * into v_company
  from public.network_companies c
  where c.id=v_supplier.supplier_network_company_id
    and c.publication_status='published'
    and c.archived_at is null;

  if not found then
    return jsonb_build_object('available',false);
  end if;

  return jsonb_build_object(
    'available',true,
    'network_company_id',v_company.id,
    'company_name',coalesce(nullif(btrim(v_company.trading_name),''),v_company.legal_name),
    'claimed_status',v_company.claimed_status,
    'verification_status',v_company.verification_status,
    'claim_recommended',v_company.claimed_status<>'claimed'
  );
end;
$$;

revoke all on function rfqh_secure.rfqh8_guest_claim_context_impl(text)
from public;
grant execute on function rfqh_secure.rfqh8_guest_claim_context_impl(text)
to anon,authenticated;

create or replace function public.rfqh8_guest_claim_context(
  p_token_hash text
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select rfqh_secure.rfqh8_guest_claim_context_impl(p_token_hash)
$$;

revoke all on function public.rfqh8_guest_claim_context(text)
from public,anon,authenticated;
grant execute on function public.rfqh8_guest_claim_context(text)
to anon,authenticated;

notify pgrst,'reload schema';