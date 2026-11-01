-- NET-AUDIT1.1 — Spec search: norma, grado e dimensioni sul technical scope pubblicato.
--
-- Founder decision 2026-11-01 (revises COMPACT6B/6D): standard, grade and
-- dimensions become Network filters, evaluated ONLY on the published product
-- scope (standard/grade/dimension scopes with provenance). Quantities, cut
-- lengths and bills of material stay in the RFQ flow and are not parameters.
--
-- Semantics follow p5_5 matching: for every requested criterion a company
-- product is `exact` (declared and matching), `unknown` (not declared) or
-- `mismatch` (declared and not matching). A product is
--   * exact       when every requested criterion is exact;
--   * undeclared  when nothing mismatches but at least one criterion is unknown;
--   * excluded    when any declared criterion mismatches.
-- A company is ranked by its best product. Undeclared companies are returned
-- after exact ones and flagged: they are never presented as compatible.
--
-- Access: product scope is part of the paid Network boundary (PA1.3), exactly
-- like p3_7e_public_product_scope. No Free access, no anon access, no private
-- tenant data (Commercial Memory is never read). Rejected scopes and scopes
-- whose source assertion was rejected or superseded are ignored.

create or replace function private.netaudit1_standard_key(p_code text)
returns text
language sql
immutable
security invoker
set search_path=''
as $function$
  -- "EN 10219-1:2006" and "EN 10219" share the family key "en10219".
  select public.canonical_steel_token(
    regexp_replace(btrim(p_code),'(-[0-9]+)?(:[0-9]{4})?$','')
  );
$function$;

create or replace function private.netaudit1_scope_usable(
  p_source_assertion_id uuid,
  p_verification_status text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce(p_verification_status,'')<>'rejected'
    and not exists(
      select 1 from public.network_data_assertions a
      where a.id=p_source_assertion_id
        and a.review_state in ('rejected','superseded')
    );
$function$;

create or replace function private.netaudit1_spec_search_impl(
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
  then
    raise exception 'Invalid Network spec filters' using errcode='22023';
  end if;

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
    select cp.id,cp.company_id
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
    select p.id,p.company_id,
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
        when exists(select 1 from public.network_company_product_dimension_scopes d
          where d.company_product_id=p.id and d.dimension_type in ('width','height')
            and private.netaudit1_scope_usable(d.source_assertion_id,d.verification_status)
            and p_side_mm between d.min_mm and d.max_mm) then 'exact'
        when exists(select 1 from public.network_company_product_dimension_scopes d
          where d.company_product_id=p.id and d.dimension_type in ('width','height')
            and private.netaudit1_scope_usable(d.source_assertion_id,d.verification_status)) then 'mismatch'
        else 'unknown' end as s_side
    from products p
  ), product_status as (
    select s.*,
      case
        when 'mismatch'=any(array[s_standard,s_grade,s_outer_diameter,s_wall_thickness,s_side]) then 'mismatch'
        when 'unknown'=any(array[s_standard,s_grade,s_outer_diameter,s_wall_thickness,s_side]) then 'undeclared'
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
              or (d.dimension_type in ('width','height') and p_side_mm between d.min_mm and d.max_mm))),'[]'::jsonb) end
      )
    ) order by e.bucket,(e.verification_status='verified') desc,lower(e.legal_name),e.company_id)
    from chosen e),'[]'::jsonb)
  into v_total,v_exact,v_items;

  return jsonb_build_object(
    'contract','netaudit1-spec-v1',
    'total',v_total,'exact_total',v_exact,'undeclared_total',v_total-v_exact,
    'offset',v_offset,'limit',v_limit,'items',v_items,
    'criteria',jsonb_build_object(
      'standard_key',v_std,'grade_key',v_grade,'shape',v_shape,
      'outer_diameter_mm',p_outer_diameter_mm,'wall_thickness_mm',p_wall_thickness_mm,
      'side_mm',p_side_mm)
  );
end;
$function$;

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
  select private.netaudit1_spec_search_impl(
    p_organization_id,p_standard,p_grade,p_shape,p_outer_diameter_mm,
    p_wall_thickness_mm,p_side_mm,p_role,p_region,p_query,p_offset,p_limit);
$function$;

revoke all on function private.netaudit1_standard_key(text) from public,anon;
revoke all on function private.netaudit1_scope_usable(uuid,text) from public,anon,authenticated;
revoke all on function private.netaudit1_spec_search_impl(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer)
  from public,anon;
revoke all on function public.netaudit1_spec_search(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer)
  from public,anon;
grant execute on function private.netaudit1_standard_key(text) to authenticated,service_role;
grant execute on function private.netaudit1_scope_usable(uuid,text) to service_role;
grant execute on function private.netaudit1_spec_search_impl(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer)
  to authenticated,service_role;
grant execute on function public.netaudit1_spec_search(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer)
  to authenticated,service_role;

comment on function public.netaudit1_spec_search(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer) is
  'NET-AUDIT1.1 Pro-only spec search on published product scope (standard, grade, dimensions). Exact matches first; undeclared scope flagged, never presented as compatible; declared mismatches excluded. No quantities, no private tenant data.';
