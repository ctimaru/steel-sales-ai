-- PL1.5A — require explicit same-standard evidence for governed reference adoption.
-- Corrects any PL1.5A governed-reference link that was selected on geometry alone.

begin;

-- Supersede PL1.5A accepted governed-reference snapshots when the reference/source
-- does not explicitly declare the same weight standard as the price-list item.
with incompatible as (
  select
    wl.id,
    wl.price_list_item_id,
    wl.geometry_id,
    wl.material_grade_id,
    wl.weight_standard_key,
    wl.geometry_match_status,
    wl.geometry_match_method,
    wl.metadata
  from public.price_list_item_weight_links wl
  join public.steel_weight_references swr on swr.id=wl.weight_reference_id
  left join public.knowledge_sources ks on ks.id=swr.knowledge_source_id
  where wl.resolution_status='accepted'
    and wl.weight_resolution_mode='governed_reference'
    and wl.metadata->>'residual_resolution_block'='PL1.5A'
    and lower(replace(coalesce(
      swr.metadata->>'weight_standard_key',
      swr.metadata->>'standard_code',
      ks.metadata->>'weight_standard_key',
      ks.metadata->>'standard_code',
      ''
    ),' ','')) is distinct from lower(replace(coalesce(wl.weight_standard_key,''),' ',''))
)
update public.price_list_item_weight_links wl
set resolution_status='superseded'
from incompatible x
where wl.id=x.id;

with superseded as (
  select
    wl.id,
    wl.price_list_item_id,
    wl.geometry_id,
    wl.material_grade_id,
    wl.weight_standard_key,
    wl.geometry_match_status,
    wl.geometry_match_method,
    wl.metadata
  from public.price_list_item_weight_links wl
  where wl.resolution_status='superseded'
    and wl.weight_resolution_mode='governed_reference'
    and wl.metadata->>'residual_resolution_block'='PL1.5A'
    and not exists (
      select 1
      from public.price_list_item_weight_links newer
      where newer.supersedes_link_id=wl.id
    )
),
inserted as (
  insert into public.price_list_item_weight_links(
    price_list_item_id,
    geometry_id,
    material_grade_id,
    weight_standard_key,
    geometry_match_status,
    geometry_match_method,
    weight_resolution_mode,
    weight_reference_id,
    formula_version,
    resolved_weight_kg_m,
    resolution_status,
    resolution_reason,
    supersedes_link_id,
    metadata
  )
  select
    s.price_list_item_id,
    s.geometry_id,
    s.material_grade_id,
    s.weight_standard_key,
    s.geometry_match_status,
    s.geometry_match_method,
    'unresolved',
    null,
    null,
    null,
    'candidate',
    'PL1.5A same-standard correction: prior reference lacked explicit same-standard evidence; cross-standard weight adoption is prohibited.',
    s.id,
    jsonb_build_object(
      'residual_resolution_block','PL1.5A',
      'resolution_basis','same_standard_evidence_missing',
      'price_per_t_allowed',false,
      'cross_standard_fallback',false,
      'correction_of_link_id',s.id,
      'future_resolution','supersede_with_explicit_same_standard_governed_link'
    )
  from superseded s
  returning id
)
update public.price_list_item_weight_links wl
set resolution_status='rejected'
where wl.id in (select id from inserted);

create or replace function private.pl1_close_residual_weight_links(
  p_price_list_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accepted_from_reference integer := 0;
  v_rejected_no_reference integer := 0;
  v_rejected_unresolved_standard integer := 0;
  v_remaining_candidates integer := 0;
begin
  -- A governed reference may close a residual only when the reference/source
  -- explicitly declares the SAME weight standard. Geometry-only or forming-only
  -- compatibility is insufficient.
  with selected as (
    select distinct on (wl.id)
      wl.id as link_id,
      swr.id as reference_id,
      swr.weight_kg_m,
      swr.weight_method,
      ks.source_key
    from public.price_list_item_weight_links wl
    join public.price_list_items i on i.id = wl.price_list_item_id
    join public.price_list_sections s on s.id = i.section_id
    join public.steel_weight_references swr
      on swr.geometry_id = wl.geometry_id
     and swr.is_canonical
     and swr.weight_method in ('published','verified')
     and (
       swr.material_grade_id is null
       or swr.material_grade_id is not distinct from wl.material_grade_id
     )
    left join public.knowledge_sources ks on ks.id = swr.knowledge_source_id
    where s.price_list_version_id = p_price_list_version_id
      and wl.resolution_status = 'candidate'
      and wl.weight_standard_key is not null
      and lower(replace(coalesce(
        swr.metadata->>'weight_standard_key',
        swr.metadata->>'standard_code',
        ks.metadata->>'weight_standard_key',
        ks.metadata->>'standard_code',
        ''
      ),' ','')) = lower(replace(wl.weight_standard_key,' ',''))
    order by
      wl.id,
      case swr.weight_method when 'verified' then 1 else 2 end,
      swr.created_at desc,
      swr.id
  )
  update public.price_list_item_weight_links wl
  set
    weight_resolution_mode = 'governed_reference',
    weight_reference_id = selected.reference_id,
    formula_version = null,
    resolved_weight_kg_m = selected.weight_kg_m,
    resolution_status = 'accepted',
    resolution_reason =
      'PL1.5A exact-geometry compatible canonical published/verified weight reference with explicit same-standard evidence.',
    metadata = wl.metadata || jsonb_build_object(
      'residual_resolution_block','PL1.5A',
      'resolution_basis','explicit_same_standard_canonical_reference',
      'reference_weight_method',selected.weight_method,
      'reference_source_key',selected.source_key
    )
  from selected
  where wl.id = selected.link_id
    and wl.resolution_status = 'candidate';

  get diagnostics v_accepted_from_reference = row_count;

  update public.price_list_item_weight_links wl
  set
    resolution_status = 'rejected',
    resolution_reason =
      'PL1.5A source standard unresolved/ambiguous; no standard-specific weight may be inferred.',
    metadata = wl.metadata || jsonb_build_object(
      'residual_resolution_block','PL1.5A',
      'resolution_basis','unresolved_source_standard',
      'price_per_t_allowed',false,
      'future_resolution','supersede_with_new_governed_link'
    )
  from public.price_list_items i
  join public.price_list_sections s on s.id = i.section_id
  where wl.price_list_item_id = i.id
    and s.price_list_version_id = p_price_list_version_id
    and wl.resolution_status = 'candidate'
    and wl.weight_standard_key is null;

  get diagnostics v_rejected_unresolved_standard = row_count;

  update public.price_list_item_weight_links wl
  set
    resolution_status = 'rejected',
    resolution_reason =
      'PL1.5A no explicit same-standard canonical published/verified weight reference; cross-standard formula/reference fallback prohibited.',
    metadata = wl.metadata || jsonb_build_object(
      'residual_resolution_block','PL1.5A',
      'resolution_basis','no_explicit_same_standard_canonical_reference',
      'price_per_t_allowed',false,
      'cross_standard_fallback',false,
      'future_resolution','supersede_with_new_governed_link'
    )
  from public.price_list_items i
  join public.price_list_sections s on s.id = i.section_id
  where wl.price_list_item_id = i.id
    and s.price_list_version_id = p_price_list_version_id
    and wl.resolution_status = 'candidate'
    and wl.weight_standard_key is not null;

  get diagnostics v_rejected_no_reference = row_count;

  select count(*) into v_remaining_candidates
  from public.price_list_item_weight_links wl
  join public.price_list_items i on i.id = wl.price_list_item_id
  join public.price_list_sections s on s.id = i.section_id
  where s.price_list_version_id = p_price_list_version_id
    and wl.resolution_status = 'candidate';

  if v_remaining_candidates <> 0 then
    raise exception 'PL1.5A residual closure incomplete: % candidate link(s) remain',
      v_remaining_candidates
      using errcode = '23514';
  end if;

  return jsonb_build_object(
    'price_list_version_id',p_price_list_version_id,
    'accepted_from_explicit_same_standard_reference',v_accepted_from_reference,
    'rejected_unresolved_standard',v_rejected_unresolved_standard,
    'rejected_no_explicit_same_standard_reference',v_rejected_no_reference,
    'remaining_candidates',v_remaining_candidates
  );
end;
$$;

revoke all on function private.pl1_close_residual_weight_links(uuid)
from public, anon, authenticated;

grant execute on function private.pl1_close_residual_weight_links(uuid)
to service_role;

commit;
