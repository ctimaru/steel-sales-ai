-- PL1.5A — Residual Weight & Special Profile Resolution

begin;

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
  -- Prefer only exact, compatible, canonical published/verified references.
  -- No cross-standard formula fallback is allowed here.
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
      'PL1.5A exact-geometry compatible canonical published/verified weight reference.',
    metadata = wl.metadata || jsonb_build_object(
      'residual_resolution_block','PL1.5A',
      'resolution_basis','compatible_canonical_reference',
      'reference_weight_method',selected.weight_method,
      'reference_source_key',selected.source_key
    )
  from selected
  where wl.id = selected.link_id
    and wl.resolution_status = 'candidate';

  get diagnostics v_accepted_from_reference = row_count;

  -- Close mixed/ambiguous-standard candidates as rejected for this immutable snapshot.
  -- Future evidence may supersede them with a new link; current €/t must stay blocked.
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

  -- EN10305-3 candidates with no compatible canonical weight source are closed rather
  -- than silently borrowing an EN10219/other-standard formula.
  update public.price_list_item_weight_links wl
  set
    resolution_status = 'rejected',
    resolution_reason =
      'PL1.5A no compatible canonical published/verified weight reference for the source standard; cross-standard formula fallback prohibited.',
    metadata = wl.metadata || jsonb_build_object(
      'residual_resolution_block','PL1.5A',
      'resolution_basis','no_compatible_canonical_reference',
      'price_per_t_allowed',false,
      'cross_standard_fallback',false,
      'future_resolution','supersede_with_new_governed_link'
    )
  from public.price_list_items i
  join public.price_list_sections s on s.id = i.section_id
  where wl.price_list_item_id = i.id
    and s.price_list_version_id = p_price_list_version_id
    and wl.resolution_status = 'candidate'
    and wl.weight_standard_key = 'EN10305-3';

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
    'accepted_from_canonical_reference',v_accepted_from_reference,
    'rejected_unresolved_standard',v_rejected_unresolved_standard,
    'rejected_no_compatible_reference',v_rejected_no_reference,
    'remaining_candidates',v_remaining_candidates
  );
end;
$$;

revoke all on function private.pl1_close_residual_weight_links(uuid)
from public, anon, authenticated;

grant execute on function private.pl1_close_residual_weight_links(uuid)
to service_role;

create or replace view public.price_list_item_pricing_readiness
with (security_invoker = true)
as
select
  i.id as price_list_item_id,
  s.price_list_version_id,
  s.id as section_id,
  s.shape_code,
  s.standard_code,
  s.weight_standard_key,
  s.grade_code,
  i.dimension_label_raw,
  i.geometry_candidate_key,
  (
    select count(*) = 2
       and count(*) filter (where c.component_type='base') = 1
       and count(*) filter (where c.component_type='fixed_extra') = 1
    from public.price_list_components c
    where c.price_list_item_id=i.id
  ) as price_per_m_ready,
  accepted.id as accepted_weight_link_id,
  accepted.resolved_weight_kg_m,
  accepted.weight_resolution_mode,
  accepted.weight_reference_id,
  accepted.formula_version,
  case
    when accepted.id is not null then 'ready'
    when s.shape_code='other' then 'unsupported_special_shape'
    when rejected.id is not null and s.weight_standard_key is null then 'unresolved_standard'
    when rejected.id is not null then 'no_compatible_weight_reference'
    when candidate.id is not null then 'pending_weight_resolution'
    else 'missing_weight_link'
  end as price_per_t_status,
  accepted.id is not null as price_per_t_ready,
  case
    when accepted.id is not null then accepted.resolution_reason
    when s.shape_code='other' then
      'Commercial €/m is usable; canonical kg/m is unavailable for this special profile.'
    when rejected.id is not null then rejected.resolution_reason
    when candidate.id is not null then candidate.resolution_reason
    else 'No governed weight link exists for this item.'
  end as weight_readiness_reason
from public.price_list_items i
join public.price_list_sections s on s.id=i.section_id
left join lateral (
  select wl.*
  from public.price_list_item_weight_links wl
  where wl.price_list_item_id=i.id
    and wl.resolution_status='accepted'
  order by wl.resolved_at desc nulls last, wl.created_at desc
  limit 1
) accepted on true
left join lateral (
  select wl.*
  from public.price_list_item_weight_links wl
  where wl.price_list_item_id=i.id
    and wl.resolution_status='rejected'
  order by wl.resolved_at desc nulls last, wl.created_at desc
  limit 1
) rejected on true
left join lateral (
  select wl.*
  from public.price_list_item_weight_links wl
  where wl.price_list_item_id=i.id
    and wl.resolution_status='candidate'
  order by wl.created_at desc
  limit 1
) candidate on true;

revoke all on public.price_list_item_pricing_readiness
from anon, authenticated;

grant select on public.price_list_item_pricing_readiness
to authenticated;

comment on view public.price_list_item_pricing_readiness is
  'PL1.5A derived readiness surface: €/m readiness is independent from governed kg/m; €/t is available only with an accepted weight link.';

commit;
