-- SEC1.1 Public RPC boundary migration — preservation-first, NO data writes.
-- Existing public SQL SECURITY DEFINER functions are intentionally public,
-- but should not themselves reside as privileged routines in the exposed schema.
-- Move intact implementations (with their RLS-bypass/published-only filters)
-- to a dedicated non-PostgREST-exposed schema. Create identical public stable
-- SECURITY INVOKER entrypoints. Explicit private EXECUTE grants only for the
-- same existing public audience. Never widen access or expose the internal schema
-- in Supabase Data API settings.
-- Upgrade is transactional; do not run against unreviewed schema drift.
begin;
create schema if not exists sec1_public;
comment on schema sec1_public is 'SEC1 internal published-content implementations; not exposed by PostgREST or GraphQL';
revoke all on schema sec1_public from public, anon, authenticated;
grant usage on schema sec1_public to anon, authenticated, service_role;


-- Retain original function OID, owned by postgres: no reimplementation of
-- published-only filters and no change to the established return contract.
alter function public.k2_public_knowledge_grade(p_slug text) set schema sec1_public;
revoke all on function sec1_public.k2_public_knowledge_grade(p_slug text) from public, anon, authenticated;
grant execute on function sec1_public.k2_public_knowledge_grade(p_slug text) to anon, authenticated, service_role;

create function public.k2_public_knowledge_grade(p_slug text)
returns TABLE(material_grade_id uuid, slug text, designation text, material_number text, standard_system text, material_family text, density_kg_m3 numeric, short_description text, seo_title text, seo_description text, intro text, designation_explanation text, typical_applications text, editorial_sections jsonb, faq jsonb, related_standards jsonb, source_references jsonb, related_grade_pages jsonb, published_at timestamp with time zone, last_reviewed_at date)
language sql stable security invoker set search_path to ''
as $sec1$
  select * from sec1_public.k2_public_knowledge_grade(p_slug);
$sec1$;
revoke all on function public.k2_public_knowledge_grade(p_slug text) from public, anon, authenticated;
grant execute on function public.k2_public_knowledge_grade(p_slug text) to anon, authenticated, service_role;


-- Retain original function OID, owned by postgres: no reimplementation of
-- published-only filters and no change to the established return contract.
alter function public.k2_public_knowledge_grades(p_query text, p_limit integer, p_offset integer) set schema sec1_public;
revoke all on function sec1_public.k2_public_knowledge_grades(p_query text, p_limit integer, p_offset integer) from public, anon, authenticated;
grant execute on function sec1_public.k2_public_knowledge_grades(p_query text, p_limit integer, p_offset integer) to anon, authenticated, service_role;

create function public.k2_public_knowledge_grades(p_query text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
returns TABLE(material_grade_id uuid, slug text, designation text, material_number text, standard_system text, material_family text, short_description text, seo_title text, seo_description text, related_standard_count integer, published_at timestamp with time zone, last_reviewed_at date)
language sql stable security invoker set search_path to ''
as $sec1$
  select * from sec1_public.k2_public_knowledge_grades(p_query, p_limit, p_offset);
$sec1$;
revoke all on function public.k2_public_knowledge_grades(p_query text, p_limit integer, p_offset integer) from public, anon, authenticated;
grant execute on function public.k2_public_knowledge_grades(p_query text, p_limit integer, p_offset integer) to anon, authenticated, service_role;


-- Retain original function OID, owned by postgres: no reimplementation of
-- published-only filters and no change to the established return contract.
alter function public.k2_public_knowledge_standard(p_slug text) set schema sec1_public;
revoke all on function sec1_public.k2_public_knowledge_standard(p_slug text) from public, anon, authenticated;
grant execute on function sec1_public.k2_public_knowledge_standard(p_slug text) to anon, authenticated, service_role;

create function public.k2_public_knowledge_standard(p_slug text)
returns TABLE(standard_id uuid, slug text, code text, title text, standard_system text, issuing_body text, edition text, part_number text, application_category text, manufacturing_processes text[], dimensional_basis text, short_explanation text, scope_summary text, seo_title text, seo_description text, intro text, what_it_covers text, how_to_read text, typical_applications text, editorial_sections jsonb, faq jsonb, product_families text[], related_grades jsonb, source_references jsonb, related_standard_pages jsonb, published_at timestamp with time zone, last_reviewed_at date)
language sql stable security invoker set search_path to ''
as $sec1$
  select * from sec1_public.k2_public_knowledge_standard(p_slug);
$sec1$;
revoke all on function public.k2_public_knowledge_standard(p_slug text) from public, anon, authenticated;
grant execute on function public.k2_public_knowledge_standard(p_slug text) to anon, authenticated, service_role;


-- Retain original function OID, owned by postgres: no reimplementation of
-- published-only filters and no change to the established return contract.
alter function public.k2_public_knowledge_standards(p_query text, p_limit integer, p_offset integer) set schema sec1_public;
revoke all on function sec1_public.k2_public_knowledge_standards(p_query text, p_limit integer, p_offset integer) from public, anon, authenticated;
grant execute on function sec1_public.k2_public_knowledge_standards(p_query text, p_limit integer, p_offset integer) to anon, authenticated, service_role;

create function public.k2_public_knowledge_standards(p_query text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
returns TABLE(standard_id uuid, slug text, code text, title text, standard_system text, application_category text, short_explanation text, seo_title text, seo_description text, product_families text[], related_grade_count integer, published_at timestamp with time zone, last_reviewed_at date)
language sql stable security invoker set search_path to ''
as $sec1$
  select * from sec1_public.k2_public_knowledge_standards(p_query, p_limit, p_offset);
$sec1$;
revoke all on function public.k2_public_knowledge_standards(p_query text, p_limit integer, p_offset integer) from public, anon, authenticated;
grant execute on function public.k2_public_knowledge_standards(p_query text, p_limit integer, p_offset integer) to anon, authenticated, service_role;


-- Retain original function OID, owned by postgres: no reimplementation of
-- published-only filters and no change to the established return contract.
alter function public.k5_public_tube_weight_references(p_product_family text, p_limit integer, p_offset integer) set schema sec1_public;
revoke all on function sec1_public.k5_public_tube_weight_references(p_product_family text, p_limit integer, p_offset integer) from public, anon, authenticated;
grant execute on function sec1_public.k5_public_tube_weight_references(p_product_family text, p_limit integer, p_offset integer) to anon, authenticated, service_role;

create function public.k5_public_tube_weight_references(p_product_family text DEFAULT NULL::text, p_limit integer DEFAULT 250, p_offset integer DEFAULT 0)
returns TABLE(reference_id uuid, geometry_id uuid, product_family text, outer_diameter_mm numeric, width_mm numeric, height_mm numeric, thickness_mm numeric, weight_kg_m numeric, weight_method text, density_kg_m3 numeric, source_provider text, source_name text, source_url text)
language sql stable security invoker set search_path to ''
as $sec1$
  select * from sec1_public.k5_public_tube_weight_references(p_product_family, p_limit, p_offset);
$sec1$;
revoke all on function public.k5_public_tube_weight_references(p_product_family text, p_limit integer, p_offset integer) from public, anon, authenticated;
grant execute on function public.k5_public_tube_weight_references(p_product_family text, p_limit integer, p_offset integer) to anon, authenticated, service_role;


-- Retain original function OID, owned by postgres: no reimplementation of
-- published-only filters and no change to the established return contract.
alter function public.k6_public_tube_dimension_page(p_slug text) set schema sec1_public;
revoke all on function sec1_public.k6_public_tube_dimension_page(p_slug text) from public, anon, authenticated;
grant execute on function sec1_public.k6_public_tube_dimension_page(p_slug text) to anon, authenticated, service_role;

create function public.k6_public_tube_dimension_page(p_slug text)
returns TABLE(dimension_slug text, reference_id uuid, geometry_id uuid, product_family text, outer_diameter_mm numeric, width_mm numeric, height_mm numeric, thickness_mm numeric, weight_kg_m numeric, weight_method text, density_kg_m3 numeric, source_provider text, source_name text, source_url text, published_at timestamp with time zone, related_dimensions jsonb)
language sql stable security invoker set search_path to ''
as $sec1$
  select * from sec1_public.k6_public_tube_dimension_page(p_slug);
$sec1$;
revoke all on function public.k6_public_tube_dimension_page(p_slug text) from public, anon, authenticated;
grant execute on function public.k6_public_tube_dimension_page(p_slug text) to anon, authenticated, service_role;


-- Retain original function OID, owned by postgres: no reimplementation of
-- published-only filters and no change to the established return contract.
alter function public.k6_public_tube_dimension_pages(p_product_family text, p_limit integer, p_offset integer) set schema sec1_public;
revoke all on function sec1_public.k6_public_tube_dimension_pages(p_product_family text, p_limit integer, p_offset integer) from public, anon, authenticated;
grant execute on function sec1_public.k6_public_tube_dimension_pages(p_product_family text, p_limit integer, p_offset integer) to anon, authenticated, service_role;

create function public.k6_public_tube_dimension_pages(p_product_family text DEFAULT NULL::text, p_limit integer DEFAULT 250, p_offset integer DEFAULT 0)
returns TABLE(dimension_slug text, reference_id uuid, geometry_id uuid, product_family text, outer_diameter_mm numeric, width_mm numeric, height_mm numeric, thickness_mm numeric, weight_kg_m numeric, weight_method text, density_kg_m3 numeric, source_provider text, source_name text, source_url text, published_at timestamp with time zone)
language sql stable security invoker set search_path to ''
as $sec1$
  select * from sec1_public.k6_public_tube_dimension_pages(p_product_family, p_limit, p_offset);
$sec1$;
revoke all on function public.k6_public_tube_dimension_pages(p_product_family text, p_limit integer, p_offset integer) from public, anon, authenticated;
grant execute on function public.k6_public_tube_dimension_pages(p_product_family text, p_limit integer, p_offset integer) to anon, authenticated, service_role;


-- Retain original function OID, owned by postgres: no reimplementation of
-- published-only filters and no change to the established return contract.
alter function public.k7_public_tube_family_hubs() set schema sec1_public;
revoke all on function sec1_public.k7_public_tube_family_hubs() from public, anon, authenticated;
grant execute on function sec1_public.k7_public_tube_family_hubs() to anon, authenticated, service_role;

create function public.k7_public_tube_family_hubs()
returns TABLE(family_slug text, product_family text, dimension_count integer, size_hub_count integer, min_thickness_mm numeric, max_thickness_mm numeric, min_weight_kg_m numeric, max_weight_kg_m numeric, source_count integer, published_at timestamp with time zone)
language sql stable security invoker set search_path to ''
as $sec1$
  select * from sec1_public.k7_public_tube_family_hubs();
$sec1$;
revoke all on function public.k7_public_tube_family_hubs() from public, anon, authenticated;
grant execute on function public.k7_public_tube_family_hubs() to anon, authenticated, service_role;


-- Retain original function OID, owned by postgres: no reimplementation of
-- published-only filters and no change to the established return contract.
alter function public.k7_public_tube_size_hub(p_family_slug text, p_size_slug text) set schema sec1_public;
revoke all on function sec1_public.k7_public_tube_size_hub(p_family_slug text, p_size_slug text) from public, anon, authenticated;
grant execute on function sec1_public.k7_public_tube_size_hub(p_family_slug text, p_size_slug text) to anon, authenticated, service_role;

create function public.k7_public_tube_size_hub(p_family_slug text, p_size_slug text)
returns TABLE(family_slug text, product_family text, size_slug text, outer_diameter_mm numeric, width_mm numeric, height_mm numeric, variant_count integer, min_thickness_mm numeric, max_thickness_mm numeric, min_weight_kg_m numeric, max_weight_kg_m numeric, source_count integer, published_at timestamp with time zone, variants jsonb)
language sql stable security invoker set search_path to ''
as $sec1$
  select * from sec1_public.k7_public_tube_size_hub(p_family_slug, p_size_slug);
$sec1$;
revoke all on function public.k7_public_tube_size_hub(p_family_slug text, p_size_slug text) from public, anon, authenticated;
grant execute on function public.k7_public_tube_size_hub(p_family_slug text, p_size_slug text) to anon, authenticated, service_role;


-- Retain original function OID, owned by postgres: no reimplementation of
-- published-only filters and no change to the established return contract.
alter function public.k7_public_tube_size_hubs(p_family_slug text) set schema sec1_public;
revoke all on function sec1_public.k7_public_tube_size_hubs(p_family_slug text) from public, anon, authenticated;
grant execute on function sec1_public.k7_public_tube_size_hubs(p_family_slug text) to anon, authenticated, service_role;

create function public.k7_public_tube_size_hubs(p_family_slug text DEFAULT NULL::text)
returns TABLE(family_slug text, product_family text, size_slug text, outer_diameter_mm numeric, width_mm numeric, height_mm numeric, variant_count integer, min_thickness_mm numeric, max_thickness_mm numeric, min_weight_kg_m numeric, max_weight_kg_m numeric, source_count integer, published_at timestamp with time zone)
language sql stable security invoker set search_path to ''
as $sec1$
  select * from sec1_public.k7_public_tube_size_hubs(p_family_slug);
$sec1$;
revoke all on function public.k7_public_tube_size_hubs(p_family_slug text) from public, anon, authenticated;
grant execute on function public.k7_public_tube_size_hubs(p_family_slug text) to anon, authenticated, service_role;


-- Retain original function OID, owned by postgres: no reimplementation of
-- published-only filters and no change to the established return contract.
alter function public.sp4_public_steel_pulse_feed(p_limit integer) set schema sec1_public;
revoke all on function sec1_public.sp4_public_steel_pulse_feed(p_limit integer) from public, anon, authenticated;
grant execute on function sec1_public.sp4_public_steel_pulse_feed(p_limit integer) to anon, authenticated, service_role;

create function public.sp4_public_steel_pulse_feed(p_limit integer DEFAULT 3)
returns jsonb
language sql stable security invoker set search_path to ''
as $sec1$
  select sec1_public.sp4_public_steel_pulse_feed(p_limit);
$sec1$;
revoke all on function public.sp4_public_steel_pulse_feed(p_limit integer) from public, anon, authenticated;
grant execute on function public.sp4_public_steel_pulse_feed(p_limit integer) to anon, authenticated, service_role;


-- Sanity contract: eleven public facades, eleven internal definer routines;
-- no SECURITY DEFINER in the public API for the allowlisted public RPCs.
do $sec1_check$
declare
  v_public integer;
  v_private integer;
  v_bad integer;
begin
  select count(*) into v_private from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='sec1_public' and p.prosecdef;
  select count(*) into v_public from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and not p.prosecdef and p.proname in (
      'k2_public_knowledge_grade','k2_public_knowledge_grades','k2_public_knowledge_standard',
      'k2_public_knowledge_standards','k5_public_tube_weight_references',
      'k6_public_tube_dimension_page','k6_public_tube_dimension_pages',
      'k7_public_tube_family_hubs','k7_public_tube_size_hub','k7_public_tube_size_hubs',
      'sp4_public_steel_pulse_feed');
  select count(*) into v_bad from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE');
  if v_private<>11 or v_public<>11 or v_bad<>0 then
    raise exception 'SEC1 facade mismatch: private %, public %, anon definer %',
      v_private,v_public,v_bad;
  end if;
end $sec1_check$;
commit;
