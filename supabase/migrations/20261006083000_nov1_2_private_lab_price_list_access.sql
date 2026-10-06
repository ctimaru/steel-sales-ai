-- NOV1.2 — Private Lab controlled access to internal price lists.
-- The public list catalogue remains governed. These RPCs bypass list RLS only
-- after the caller proves Platform Console access.

begin;

create or replace function public.pl1_private_lab_explorer_version(p_version_id uuid)
returns table(
  version_id uuid,
  price_list_id uuid,
  list_name text,
  list_code text,
  manufacturer_version_code text,
  manufacturer_revision_code text,
  source_date date,
  version_status text,
  publication_scope text,
  currency_code text,
  default_price_unit text,
  source_terms_raw text,
  item_count bigint,
  price_per_t_ready_count bigint,
  shape_codes text[],
  grade_codes text[],
  finish_codes text[],
  pricing_formula text,
  is_internal_preview boolean,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  if not public.has_platform_permission('platform.console.access') then
    raise exception 'Platform console access required' using errcode='42501';
  end if;

  return query
    select *
    from public.pl1_price_list_explorer_version(p_version_id, true);
end;
$$;

revoke all on function public.pl1_private_lab_explorer_version(uuid)
from public, anon, authenticated;

grant execute on function public.pl1_private_lab_explorer_version(uuid)
to authenticated;

create or replace function public.pl1_private_lab_explorer_items(p_version_id uuid)
returns table(
  item_id uuid,
  section_id uuid,
  shape_code text,
  standard_code text,
  standard_raw text,
  grade_code text,
  grade_raw text,
  finish_code text,
  finish_raw text,
  dimension_label text,
  thickness_mm numeric,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  base_eur_m numeric,
  fixed_extra_eur_m numeric,
  price_per_m_ready boolean,
  resolved_weight_kg_m numeric,
  price_per_t_status text,
  price_per_t_ready boolean,
  weight_resolution_mode text,
  note_raw text,
  source_page integer,
  section_sort_order integer,
  row_sort_order integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  if not public.has_platform_permission('platform.console.access') then
    raise exception 'Platform console access required' using errcode='42501';
  end if;

  return query
    select *
    from public.pl1_price_list_explorer_items(p_version_id, true);
end;
$$;

revoke all on function public.pl1_private_lab_explorer_items(uuid)
from public, anon, authenticated;

grant execute on function public.pl1_private_lab_explorer_items(uuid)
to authenticated;

commit;
