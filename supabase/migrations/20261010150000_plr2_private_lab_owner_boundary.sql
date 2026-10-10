-- PLR2: Private Lab owner-only RPC boundary.
-- Existing staff roles, editorial RLS and public catalogue functions are unchanged.
-- The only supported Private Lab audience is the singleton active Platform Owner.

create or replace function public.pl1_private_lab_explorer_version(p_version_id uuid)
returns table (
  version_id uuid, price_list_id uuid, list_name text, list_code text,
  manufacturer_version_code text, manufacturer_revision_code text,
  source_date date, version_status text, publication_scope text,
  currency_code text, default_price_unit text, source_terms_raw text,
  item_count bigint, price_per_t_ready_count bigint, shape_codes text[],
  grade_codes text[], finish_codes text[], pricing_formula text,
  is_internal_preview boolean, published_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $plr2$
begin
  if not private.is_platform_superadmin() then
    raise exception 'Platform Owner required for Private Lab' using errcode='42501';
  end if;
  return query
    select * from public.pl1_price_list_explorer_version(p_version_id, true);
end;
$plr2$;

create or replace function public.pl1_private_lab_explorer_items(p_version_id uuid)
returns table (
  item_id uuid, section_id uuid, shape_code text, standard_code text,
  standard_raw text, grade_code text, grade_raw text, finish_code text,
  finish_raw text, dimension_label text, thickness_mm numeric,
  outer_diameter_mm numeric, width_mm numeric, height_mm numeric,
  base_eur_m numeric, fixed_extra_eur_m numeric, price_per_m_ready boolean,
  resolved_weight_kg_m numeric, price_per_t_status text,
  price_per_t_ready boolean, weight_resolution_mode text, note_raw text,
  source_page integer, section_sort_order integer, row_sort_order integer
)
language plpgsql stable security definer set search_path = ''
as $plr2$
begin
  if not private.is_platform_superadmin() then
    raise exception 'Platform Owner required for Private Lab' using errcode='42501';
  end if;
  return query
    select * from public.pl1_price_list_explorer_items(p_version_id, true);
end;
$plr2$;

revoke all on function public.pl1_private_lab_explorer_version(uuid) from public, anon, authenticated;
revoke all on function public.pl1_private_lab_explorer_items(uuid) from public, anon, authenticated;
grant execute on function public.pl1_private_lab_explorer_version(uuid) to authenticated;
grant execute on function public.pl1_private_lab_explorer_items(uuid) to authenticated;
