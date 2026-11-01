-- NET-AUDIT1.1b — Spec search v2: "a stock" and rectangular sections with two sides.
--
-- Additive rollout (no breaking change for the frontend already in production):
--   * private.netaudit1_spec_search_v2_impl + public.netaudit1_spec_search_v2
--     add p_side2_mm (second side, rectangular only) and p_in_stock;
--   * public.netaudit1_spec_search (v1) keeps its signature and contract name
--     and now delegates to v2 with the new criteria off;
--   * the v1 implementation is dropped once nothing references it.
-- Semantics are unchanged for existing criteria (exact / undeclared / excluded).
-- "A stock" uses declared signals only (product relationship `stocks` or a
-- Stockholding capability on a published site); absence is undeclared, never
-- a mismatch. Rectangular a×b must fit width/height in one orientation.

create or replace function private.netaudit1_spec_search_v2_impl(
  p_organization_id uuid,
  p_standard text default null,
  p_grade text default null,
  p_shape text default null,
  p_outer_diameter_mm numeric default null,
  p_wall_thickness_mm numeric default null,
  p_side_mm numeric default null,
  p_role text default null,
  p_region text default null,
  p_query text default null,
  p_offset integer default 0,
  p_limit integer default 6,
  p_side2_mm numeric default null,
  p_in_stock boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_std text:=case when nullif(btrim(coalesce(p_standard,'')),'') is null then null
    else private.netaudit1_standard_key(p_standard) end;
  v_grade text:=case when nullif(btrim(coalesce(p_grade,'')),'') is null then null
    else public.canonical_steel_token(p_grade) end;
  v_shape text:=nullif(btrim(coalesce(p_shape,'')),'');
  v_query text:=nullif(btrim(coalesce(p_query,'')),'');
  v_region text:=nullif(btrim(coalesce(p_region,'')),'');
  v_role text:=nullif(btrim(coalesce(p_role,'')),'');
  v_limit integer:=least(greatest(coalesce(p_limit,6),1),24);
  v_offset integer:=greatest(coalesce(p_offset,0),0);
  v_total bigint:=0;
  v_exact bigint:=0;
  v_items jsonb:='[]'::jsonb;
  v_stock boolean:=coalesce(p_in_stock,false);
begin
  perform private.pa1_3_require_network_access(p_organization_id);

  if length(coalesce(p_standard,''))>40 or length(coalesce(p_grade,''))>40
     or length(coalesce(p_query,''))>120 or length(coalesce(p_region,''))>90
     or v_offset>100000
     or (v_shape is not null and v_shape not in ('round','square','rectangular'))
     or (v_role is not null and v_role not in
       ('producer','trader_distributor','processor_service_provider','end_user'))
     or (p_outer_diameter_mm is not null and (p_outer_diameter_mm<=0 or p_outer_diameter_mm>5000))
     or (p_wall_thickness_mm is not null and (p_wall_thickness_mm<=0 or p_wall_thickness_mm>500))
     or (p_side_mm is not null and (p_side_mm<=0 or p_side_mm>5000))
     or (v_shape='round' and p_side_mm is not null)
     or (v_shape in ('square','rectangular') and p_outer_diameter_mm is not null)
     -- A second side only describes a rectangular section, together with the first.
     or (p_side2_mm is not null and (p_side2_mm<=0 or p_side2_mm>5000
         or p_side_mm is null or coalesce(v_shape,'')<>'rectangular'))
  then
    raise exception 'Invalid Network spec filters' using errcode='22023';
  end if;

  -- "In stock" alone is not a specification: it narrows one.
  if v_std is null and v_grade is null and p_outer_diameter_mm is null
     and p_wall_thickness_mm is null and p_side_mm is null then
    raise exception 'At least one technical criterion is required' using errcode='22023';
  end if;

  with families as (
    select distinct m.network_product_family_id as id
    from public.network_product_family_steel_mappings m
    where v_shape is null
       or m.steel_product_family=case v_shape
            when 'round' then 'round_tube'
            when 'square' then 'square_tube'
            else 'rectangular_tube' end
  ), products as (
    select cp.id,cp.company_id,cp.relationship_type
    from public.network_company_products cp
    join families f on f.id=cp.product_family_id
    join public.network_companies c on c.id=cp.company_id
    where c.publication_status='published' and c.archived_at is null
      and (v_query is null
        or strpos(lower(c.legal_name),lower(v_query))>0
        or strpos(lower(coalesce(c.trading_name,'')),lower(v_query))>0
        or strpos(lower(coalesce(c.website_domain,'')),lower(v_query))>0)
      and (v_role is null or exists(
        select 1 from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.canonical_key=v_role))
      -- Same regional rule as netlaunch4b published browsing.
      and (v_region is null or exists(
        select 1 from public.network_facilities f
        where f.company_id=c.id and f.publication_status='published'
          and f.archived_at is null and f.country_code='IT'
          and lower(btrim(f.region))=lower(v_region))
        or exists(
          select 1 from public.network_it_geo_evidence_candidates ge
          where ge.company_id=c.id and ge.status='pending_review'
            and lower(btrim(ge.region))=lower(v_region)
            and lower(btrim(ge.source_company_domain))=lower(btrim(c.website_domain))
            and ge.source_url like 'https://%'
            and nullif(btrim(ge.city),'') is not null
            and not exists(
              select 1 from public.network_facilities f
              where f.company_id=c.id and f.publication_status='published'
                and f.archived_at is null and f.country_code='IT'
                and (nullif(btrim(f.city),'') is not null or nullif(btrim(f.region),'') is not null))))
  ), signals as (
    select p.id,p.company_id,p.relationship_type,
      case when v_std is null then 'not_requested'
        when exists(select 1 from public.network_company_product_standard_scopes sc
          join public.steel_standards s on s.id=sc.standard_id
          where sc.company_product_id=p.id
            and private.netaudit1_scope_usable(sc.source_assertion_id,sc.verification_status)
            and private.netaudit1_standard_key(s.code)=v_std) then 'exact'
        when exists(select 1 from public.network_company_product_standard_scopes sc
          where sc.company_product_id=p.id
            and private.netaudit1_scope_usable(sc.source_assertion_id,sc.verification_status)) then 'mismatch'
        else 'unknown' end as s_standard,
      case when v_grade is null then 'not_requested'
        when exists(select 1 from public.network_company_product_grade_scopes gs
          join public.steel_material_grades mg on mg.id=gs.material_grade_id
          join public.steel_standards s on s.id=gs.standard_id
          where gs.company_product_id=p.id
            and private.netaudit1_scope_usable(gs.source_assertion_id,gs.verification_status)
            -- "S235" matches the qualified designation "S235JRH"; never a different strength.
            and starts_with(mg.designation_key,v_grade)
            and (v_std is null or private.netaudit1_standard_key(s.code)=v_std)) then 'exact'
        when exists(select 1 from public.network_company_product_grade_scopes gs
          where gs.company_product_id=p.id
            and private.netaudit1_scope_usable(gs.source_assertion_id,gs.verification_status)) then 'mismatch'
        else 'unknown' end as s_grade,
      case when p_outer_diameter_mm is null then 'not_requested'
        when exists(select 1 from public.network_company_product_dimension_scopes d
          where d.company_product_id=p.id and d.dimension_type='outer_diameter'
            and private.netaudit1_scope_usable(d.source_assertion_id,d.verification_status)
            and p_outer_diameter_mm between d.min_mm and d.max_mm) then 'exact'
        when exists(select 1 from public.network_company_product_dimension_scopes d
          where d.company_product_id=p.id and d.dimension_type='outer_diameter'
            and private.netaudit1_scope_usable(d.source_assertion_id,d.verification_status)) then 'mismatch'
        else 'unknown' end as s_outer_diameter,
      case when p_wall_thickness_mm is null then 'not_requested'
        when exists(select 1 from public.network_company_product_dimension_scopes d
          where d.company_product_id=p.id and d.dimension_type='wall_thickness'
            and private.netaudit1_scope_usable(d.source_assertion_id,d.verification_status)
            and p_wall_thickness_mm between d.min_mm and d.max_mm) then 'exact'
        when exists(select 1 from public.network_company_product_dimension_scopes d
          where d.company_product_id=p.id and d.dimension_type='wall_thickness'
            and private.netaudit1_scope_usable(d.source_assertion_id,d.verification_status)) then 'mismatch'
        else 'unknown' end as s_wall_thickness,
      case when p_side_mm is null then 'not_requested'
        when p_side2_mm is null then case
          when exists(select 1 from public.network_company_product_dimension_scopes d
            where d.company_product_id=p.id and d.dimension_type in ('width','height')
              and private.netaudit1_scope_usable(d.source_assertion_id,d.verification_status)
              and p_side_mm between d.min_mm and d.max_mm) then 'exact'
          when exists(select 1 from public.network_company_product_dimension_scopes d
            where d.company_product_id=p.id and d.dimension_type in ('width','height')
              and private.netaudit1_scope_usable(d.source_assertion_id,d.verification_status)) then 'mismatch'
          else 'unknown' end
        -- Rectangular a×b: both sides must fit width/height in one orientation.
        when wh.w_min is not null and wh.h_min is not null then
          case when (p_side_mm between wh.w_min and wh.w_max and p_side2_mm between wh.h_min and wh.h_max)
                 or (p_side2_mm between wh.w_min and wh.w_max and p_side_mm between wh.h_min and wh.h_max)
            then 'exact' else 'mismatch' end
        -- Only one side range declared: a fitting side leaves the other undeclared.
        when coalesce(wh.w_min,wh.h_min) is not null then
          case when p_side_mm between coalesce(wh.w_min,wh.h_min) and coalesce(wh.w_max,wh.h_max)
                 or p_side2_mm between coalesce(wh.w_min,wh.h_min) and coalesce(wh.w_max,wh.h_max)
            then 'unknown' else 'mismatch' end
        else 'unknown' end as s_side,
      -- "A stock" is a declared signal only: the product relationship or a
      -- Stockholding capability on a published site. Absence is undeclared.
      case when not v_stock then 'not_requested'
        when p.relationship_type='stocks' then 'exact'
        when exists(select 1 from public.network_facilities f
          join public.network_facility_capabilities fc on fc.facility_id=f.id
          join public.network_capabilities cap on cap.id=fc.capability_id
          where f.company_id=p.company_id and f.publication_status='published' and f.archived_at is null
            and cap.canonical_key='stockholding' and cap.status='active'
            and fc.verification_status not in ('rejected','expired','revoked')) then 'exact'
        else 'unknown' end as s_stock
    from products p
    left join lateral (
      select
        max(d.min_mm) filter (where d.dimension_type='width') as w_min,
        max(d.max_mm) filter (where d.dimension_type='width') as w_max,
        max(d.min_mm) filter (where d.dimension_type='height') as h_min,
        max(d.max_mm) filter (where d.dimension_type='height') as h_max
      from public.network_company_product_dimension_scopes d
      where d.company_product_id=p.id and d.dimension_type in ('width','height')
        and private.netaudit1_scope_usable(d.source_assertion_id,d.verification_status)
    ) wh on true
  ), product_status as (
    select s.*,
      case
        when 'mismatch'=any(array[s_standard,s_grade,s_outer_diameter,s_wall_thickness,s_side,s_stock]) then 'mismatch'
        when 'unknown'=any(array[s_standard,s_grade,s_outer_diameter,s_wall_thickness,s_side,s_stock]) then 'undeclared'
        else 'exact' end as status
    from signals s
  ), ranked as (
    select ps.company_id,
      min(case ps.status when 'exact' then 0 else 1 end) as bucket
    from product_status ps
    where ps.status<>'mismatch'
    group by ps.company_id
  ), eligible as (
    select r.company_id,r.bucket,c.legal_name,c.trading_name,c.country_code,c.website_url,
      c.verification_status,c.claimed_status
    from ranked r join public.network_companies c on c.id=r.company_id
  ), chosen as (
    select * from eligible
    order by bucket,(verification_status='verified') desc,lower(legal_name),company_id
    limit v_limit offset v_offset
  )
  select
    (select count(*) from eligible),
    (select count(*) from eligible where bucket=0),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.company_id,'legal_name',e.legal_name,'trading_name',e.trading_name,
      'country_code',e.country_code,'website_url',e.website_url,
      'claimed_status',e.claimed_status,'verification_status',e.verification_status,
      'roles',coalesce((select jsonb_agg(jsonb_build_object(
          'key',r.canonical_key,'name',r.display_name,'is_primary',a.is_primary)
          order by a.is_primary desc,r.display_name)
        from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=e.company_id and r.status='active'),'[]'::jsonb),
      'products',coalesce((select jsonb_agg(distinct pf.display_name)
        from public.network_company_products cp
        join public.network_product_families pf on pf.id=cp.product_family_id
        where cp.company_id=e.company_id and pf.status='active'),'[]'::jsonb),
      'location',(select jsonb_build_object('region',f.region,'city',f.city)
        from public.network_facilities f where f.company_id=e.company_id
          and f.publication_status='published' and f.archived_at is null
          and f.country_code='IT' order by f.created_at,f.id limit 1),
      'spec_match',jsonb_build_object(
        'status',case e.bucket when 0 then 'exact' else 'undeclared' end,
        -- Only the declared rows that satisfied the request, with provenance.
        'standards',case when v_std is null or e.bucket<>0 then '[]'::jsonb else coalesce((
          select jsonb_agg(distinct jsonb_build_object('code',s.code,
            'verification_status',sc.verification_status,
            'provenance_kind',private.p3_7e_provenance_kind(sc.source_assertion_id,sc.verification_status)))
          from product_status ps
          join public.network_company_product_standard_scopes sc on sc.company_product_id=ps.id
          join public.steel_standards s on s.id=sc.standard_id
          where ps.company_id=e.company_id and ps.status='exact'
            and private.netaudit1_scope_usable(sc.source_assertion_id,sc.verification_status)
            and private.netaudit1_standard_key(s.code)=v_std),'[]'::jsonb) end,
        'grades',case when v_grade is null or e.bucket<>0 then '[]'::jsonb else coalesce((
          select jsonb_agg(distinct jsonb_build_object('designation',mg.designation,
            'standard_code',s.code,'verification_status',gs.verification_status,
            'provenance_kind',private.p3_7e_provenance_kind(gs.source_assertion_id,gs.verification_status)))
          from product_status ps
          join public.network_company_product_grade_scopes gs on gs.company_product_id=ps.id
          join public.steel_material_grades mg on mg.id=gs.material_grade_id
          join public.steel_standards s on s.id=gs.standard_id
          where ps.company_id=e.company_id and ps.status='exact'
            and private.netaudit1_scope_usable(gs.source_assertion_id,gs.verification_status)
            and starts_with(mg.designation_key,v_grade)
            and (v_std is null or private.netaudit1_standard_key(s.code)=v_std)),'[]'::jsonb) end,
        'dimensions',case when e.bucket<>0 then '[]'::jsonb else coalesce((
          select jsonb_agg(distinct jsonb_build_object('dimension_type',d.dimension_type,
            'min_mm',d.min_mm,'max_mm',d.max_mm,'verification_status',d.verification_status,
            'provenance_kind',private.p3_7e_provenance_kind(d.source_assertion_id,d.verification_status)))
          from product_status ps
          join public.network_company_product_dimension_scopes d on d.company_product_id=ps.id
          where ps.company_id=e.company_id and ps.status='exact'
            and private.netaudit1_scope_usable(d.source_assertion_id,d.verification_status)
            and ((d.dimension_type='outer_diameter' and p_outer_diameter_mm between d.min_mm and d.max_mm)
              or (d.dimension_type='wall_thickness' and p_wall_thickness_mm between d.min_mm and d.max_mm)
              or (d.dimension_type in ('width','height') and (p_side_mm between d.min_mm and d.max_mm
                or p_side2_mm between d.min_mm and d.max_mm)))),'[]'::jsonb) end,
        'stock',case when not v_stock or e.bucket<>0 then null else (
          select case when bool_or(ps.relationship_type='stocks') then 'product' else 'facility_capability' end
          from product_status ps where ps.company_id=e.company_id and ps.status='exact') end
      )
    ) order by e.bucket,(e.verification_status='verified') desc,lower(e.legal_name),e.company_id)
    from chosen e),'[]'::jsonb)
  into v_total,v_exact,v_items;

  return jsonb_build_object(
    'contract','netaudit1-spec-v2',
    'total',v_total,'exact_total',v_exact,'undeclared_total',v_total-v_exact,
    'offset',v_offset,'limit',v_limit,'items',v_items,
    'criteria',jsonb_build_object(
      'standard_key',v_std,'grade_key',v_grade,'shape',v_shape,
      'outer_diameter_mm',p_outer_diameter_mm,'wall_thickness_mm',p_wall_thickness_mm,
      'side_mm',p_side_mm,'side2_mm',p_side2_mm,'in_stock',v_stock)
  );
end;
$function$;

create or replace function public.netaudit1_spec_search_v2(
  p_organization_id uuid,
  p_standard text default null,
  p_grade text default null,
  p_shape text default null,
  p_outer_diameter_mm numeric default null,
  p_wall_thickness_mm numeric default null,
  p_side_mm numeric default null,
  p_role text default null,
  p_region text default null,
  p_query text default null,
  p_offset integer default 0,
  p_limit integer default 6,
  p_side2_mm numeric default null,
  p_in_stock boolean default false
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.netaudit1_spec_search_v2_impl(
    p_organization_id,p_standard,p_grade,p_shape,p_outer_diameter_mm,
    p_wall_thickness_mm,p_side_mm,p_role,p_region,p_query,p_offset,p_limit,p_side2_mm,p_in_stock);
$function$;

-- v1 keeps its exact contract for the deployed frontend.
create or replace function public.netaudit1_spec_search(
  p_organization_id uuid,
  p_standard text default null,
  p_grade text default null,
  p_shape text default null,
  p_outer_diameter_mm numeric default null,
  p_wall_thickness_mm numeric default null,
  p_side_mm numeric default null,
  p_role text default null,
  p_region text default null,
  p_query text default null,
  p_offset integer default 0,
  p_limit integer default 6
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_set(private.netaudit1_spec_search_v2_impl(
    p_organization_id,p_standard,p_grade,p_shape,p_outer_diameter_mm,
    p_wall_thickness_mm,p_side_mm,p_role,p_region,p_query,p_offset,p_limit,null,false),
    '{contract}','"netaudit1-spec-v1"'::jsonb);
$function$;

drop function if exists private.netaudit1_spec_search_impl(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer);

revoke all on function private.netaudit1_spec_search_v2_impl(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer,numeric,boolean) from public,anon;
revoke all on function public.netaudit1_spec_search_v2(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer,numeric,boolean) from public,anon;
grant execute on function private.netaudit1_spec_search_v2_impl(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer,numeric,boolean) to authenticated,service_role;
grant execute on function public.netaudit1_spec_search_v2(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer,numeric,boolean) to authenticated,service_role;

comment on function public.netaudit1_spec_search_v2(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer,numeric,boolean) is
  'NET-AUDIT1.1b Pro-only spec search v2: v1 criteria plus rectangular second side and declared in-stock signal. Exact first; undeclared flagged; declared mismatches excluded. No quantities, no private tenant data.';
