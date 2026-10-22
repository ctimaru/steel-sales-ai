-- TRUST-AUDIT1C.2D: non-destructive inactive source read isolation.
-- Production ledger version: 20261022155021. Service-role remains privileged.

CREATE OR REPLACE FUNCTION public.pl1_price_list_catalog(p_include_internal boolean DEFAULT false)
 RETURNS TABLE(version_id uuid, price_list_id uuid, list_name text, list_code text, manufacturer_version_code text, manufacturer_revision_code text, source_date date, version_status text, publication_scope text, currency_code text, default_price_unit text, source_terms_raw text, item_count bigint, price_per_t_ready_count bigint, shape_codes text[], grade_codes text[], finish_codes text[], pricing_formula text, is_internal_preview boolean, published_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    v.id as version_id,
    pl.id as price_list_id,
    pl.name as list_name,
    pl.code as list_code,
    v.manufacturer_version_code,
    v.manufacturer_revision_code,
    v.source_date,
    v.status as version_status,
    v.publication_scope,
    pl.currency_code,
    pl.default_price_unit,
    pl.source_terms_raw,
    count(distinct i.id) as item_count,
    count(distinct i.id) filter (where ready.price_per_t_ready) as price_per_t_ready_count,
    coalesce(
      array_agg(distinct s.shape_code order by s.shape_code)
        filter (where s.shape_code is not null),
      array[]::text[]
    ) as shape_codes,
    coalesce(
      array_agg(distinct s.grade_code order by s.grade_code)
        filter (where s.grade_code is not null),
      array[]::text[]
    ) as grade_codes,
    coalesce(
      array_agg(distinct s.finish_code order by s.finish_code)
        filter (where s.finish_code is not null),
      array[]::text[]
    ) as finish_codes,
    (
      select r.rule_payload->>'formula'
      from public.price_rules r
      where r.price_list_version_id=v.id
        and r.rule_type='commercial_discount'
        and r.status='active'
      order by r.calculation_order, r.id
      limit 1
    ) as pricing_formula,
    not (
      v.status='published'
      and v.publication_scope='public'
    ) as is_internal_preview,
    v.published_at
  from public.price_list_versions v
  join public.price_lists pl on pl.id=v.price_list_id
  join public.price_list_sections s on s.price_list_version_id=v.id
  join public.price_list_items i on i.section_id=s.id and i.status='active'
  left join public.price_list_item_pricing_readiness ready
    on ready.price_list_item_id=i.id
  where
    pl.status='active'
    and (
      v.status='published'
      or (
        p_include_internal
        and v.status in ('draft','review','verified')
      )
    )
  group by
    v.id,
    pl.id,
    pl.name,
    pl.code,
    v.manufacturer_version_code,
    v.manufacturer_revision_code,
    v.source_date,
    v.status,
    v.publication_scope,
    pl.currency_code,
    pl.default_price_unit,
    pl.source_terms_raw,
    v.published_at
  order by coalesce(v.source_date, v.created_at::date) desc, v.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.pl1_price_list_explorer_items(p_version_id uuid, p_include_internal boolean DEFAULT false)
 RETURNS TABLE(item_id uuid, section_id uuid, shape_code text, standard_code text, standard_raw text, grade_code text, grade_raw text, finish_code text, finish_raw text, dimension_label text, thickness_mm numeric, outer_diameter_mm numeric, width_mm numeric, height_mm numeric, base_eur_m numeric, fixed_extra_eur_m numeric, price_per_m_ready boolean, resolved_weight_kg_m numeric, price_per_t_status text, price_per_t_ready boolean, weight_resolution_mode text, note_raw text, source_page integer, section_sort_order integer, row_sort_order integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with allowed as (
    select v.id
    from public.price_list_versions v
    join public.price_lists pl on pl.id=v.price_list_id and pl.status='active'
    where v.id=p_version_id
      and (
        v.status='published'
        or (
          p_include_internal
          and v.status in ('draft','review','verified')
        )
      )
  )
  select
    i.id as item_id,
    s.id as section_id,
    s.shape_code,
    s.standard_code,
    s.standard_raw,
    s.grade_code,
    s.grade_raw,
    s.finish_code,
    s.finish_raw,
    i.dimension_label_raw as dimension_label,
    i.thickness_mm,
    i.outer_diameter_mm,
    i.width_mm,
    i.height_mm,
    max(c.amount) filter (where c.component_type='base') as base_eur_m,
    max(c.amount) filter (where c.component_type='fixed_extra') as fixed_extra_eur_m,
    coalesce(ready.price_per_m_ready,false) as price_per_m_ready,
    ready.resolved_weight_kg_m,
    coalesce(ready.price_per_t_status,'missing_weight_link') as price_per_t_status,
    coalesce(ready.price_per_t_ready,false) as price_per_t_ready,
    ready.weight_resolution_mode,
    i.note_raw,
    nullif(i.source_locator->>'page','')::integer as source_page,
    s.sort_order as section_sort_order,
    coalesce(i.source_row_index,0) as row_sort_order
  from allowed a
  join public.price_list_sections s on s.price_list_version_id=a.id
  join public.price_list_items i on i.section_id=s.id and i.status='active'
  join public.price_list_components c on c.price_list_item_id=i.id
  left join public.price_list_item_pricing_readiness ready
    on ready.price_list_item_id=i.id
  group by
    i.id,
    s.id,
    s.shape_code,
    s.standard_code,
    s.standard_raw,
    s.grade_code,
    s.grade_raw,
    s.finish_code,
    s.finish_raw,
    i.dimension_label_raw,
    i.thickness_mm,
    i.outer_diameter_mm,
    i.width_mm,
    i.height_mm,
    ready.price_per_m_ready,
    ready.resolved_weight_kg_m,
    ready.price_per_t_status,
    ready.price_per_t_ready,
    ready.weight_resolution_mode,
    i.note_raw,
    i.source_locator,
    s.sort_order,
    i.source_row_index
  having
    count(*) filter (where c.component_type='base')=1
    and count(*) filter (where c.component_type='fixed_extra')=1
  order by s.sort_order, coalesce(i.source_row_index,0), i.dimension_label_raw;
$function$;

CREATE OR REPLACE FUNCTION pl1_private.version_visible_to(p_version_id uuid, p_audience text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.price_list_versions v
    join public.price_lists pl on pl.id=v.price_list_id and pl.status='active'
    join public.knowledge_documents d
      on d.id = v.primary_source_document_id
    join lateral (
      select g.decision, g.structured_data_visibility
      from public.price_list_source_governance_events g
      where g.knowledge_source_id = d.source_id
        and (g.knowledge_document_id = d.id or g.knowledge_document_id is null)
      order by g.decided_at desc, g.created_at desc, g.id desc
      limit 1
    ) g on true
    where v.id = p_version_id
      and v.status = 'published'
      and (
        (p_audience = 'public'
          and v.publication_scope = 'public'
          and g.decision = 'approved_public'
          and g.structured_data_visibility = 'public')
        or
        (p_audience = 'authenticated'
          and v.publication_scope in ('public','authenticated')
          and g.decision in ('approved_public','approved_authenticated')
          and g.structured_data_visibility in ('public','authenticated'))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION pl1_private.trust_c2d_active_source(p_kind text, p_row_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_kind='list' THEN
    RETURN EXISTS(SELECT 1 FROM public.price_lists l WHERE l.id=p_row_id AND l.status='active');
  ELSIF p_kind='version' THEN
    RETURN EXISTS(SELECT 1 FROM public.price_list_versions v JOIN public.price_lists l ON l.id=v.price_list_id WHERE v.id=p_row_id AND l.status='active');
  ELSIF p_kind='section' THEN
    RETURN EXISTS(SELECT 1 FROM public.price_list_sections s JOIN public.price_list_versions v ON v.id=s.price_list_version_id JOIN public.price_lists l ON l.id=v.price_list_id WHERE s.id=p_row_id AND l.status='active');
  ELSIF p_kind='item' THEN
    RETURN EXISTS(SELECT 1 FROM public.price_list_items i JOIN public.price_list_sections s ON s.id=i.section_id JOIN public.price_list_versions v ON v.id=s.price_list_version_id JOIN public.price_lists l ON l.id=v.price_list_id WHERE i.id=p_row_id AND l.status='active');
  ELSIF p_kind='component' THEN
    RETURN EXISTS(SELECT 1 FROM public.price_list_components c JOIN public.price_list_items i ON i.id=c.price_list_item_id JOIN public.price_list_sections s ON s.id=i.section_id JOIN public.price_list_versions v ON v.id=s.price_list_version_id JOIN public.price_lists l ON l.id=v.price_list_id WHERE c.id=p_row_id AND l.status='active');
  END IF;
  RETURN false;
END;$function$;

REVOKE ALL ON FUNCTION pl1_private.trust_c2d_active_source(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pl1_private.trust_c2d_active_source(text,uuid) TO anon,authenticated;

DROP POLICY IF EXISTS trust_c2d_active_list_read ON public.price_lists;
CREATE POLICY trust_c2d_active_list_read ON public.price_lists AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (pl1_private.trust_c2d_active_source('list',id));

DROP POLICY IF EXISTS trust_c2d_active_version_read ON public.price_list_versions;
CREATE POLICY trust_c2d_active_version_read ON public.price_list_versions AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (pl1_private.trust_c2d_active_source('version',id));

DROP POLICY IF EXISTS trust_c2d_active_section_read ON public.price_list_sections;
CREATE POLICY trust_c2d_active_section_read ON public.price_list_sections AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (pl1_private.trust_c2d_active_source('section',id));

DROP POLICY IF EXISTS trust_c2d_active_item_read ON public.price_list_items;
CREATE POLICY trust_c2d_active_item_read ON public.price_list_items AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (pl1_private.trust_c2d_active_source('item',id));

DROP POLICY IF EXISTS trust_c2d_active_component_read ON public.price_list_components;
CREATE POLICY trust_c2d_active_component_read ON public.price_list_components AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (pl1_private.trust_c2d_active_source('component',id));
