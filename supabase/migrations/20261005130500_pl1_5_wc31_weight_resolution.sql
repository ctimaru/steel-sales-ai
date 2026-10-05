-- PL1.5 — WC3.1 EN10219 weight resolution for promoted price-list geometry links

begin;

create or replace function private.pl1_resolve_wc31_en10219_weights(p_price_list_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resolved integer := 0;
begin
  update public.price_list_item_weight_links wl
  set
    weight_resolution_mode = 'standard_formula',
    formula_version = 'wc3.1-en10219-v1',
    resolved_weight_kg_m = round((
      case
        when g.product_family='round_tube' then
          pi() * g.thickness_mm::double precision
          * (g.outer_diameter_mm::double precision - g.thickness_mm::double precision)
          * 0.00785
        when g.product_family in ('square_tube','rectangular_tube') then
          (
            2 * g.thickness_mm::double precision
              * (
                  g.width_mm::double precision
                  + g.height_mm::double precision
                  - 2 * g.thickness_mm::double precision
                )
            - (4 - pi())
              * (
                  power(
                    case
                      when g.thickness_mm <= 6 then 2.0 * g.thickness_mm::double precision
                      when g.thickness_mm <= 10 then 2.5 * g.thickness_mm::double precision
                      else 3.0 * g.thickness_mm::double precision
                    end,
                    2
                  )
                  - power(
                    case
                      when g.thickness_mm <= 6 then 1.0 * g.thickness_mm::double precision
                      when g.thickness_mm <= 10 then 1.5 * g.thickness_mm::double precision
                      else 2.0 * g.thickness_mm::double precision
                    end,
                    2
                  )
                )
          ) * 0.00785
        else null
      end
    )::numeric, 6),
    resolution_status = 'accepted',
    resolution_reason = 'WC3.1 EN10219 standard-specific theoretical mass; density 7850 kg/m3.',
    metadata = wl.metadata || jsonb_build_object(
      'weight_contract','WC3.1',
      'standard','EN10219',
      'density_kg_m3',7850,
      'formula','round: pi*t*(D-t); SHS/RHS: 2*t*(B+H-2t) - (4-pi)*(ro^2-ri^2)',
      'corner_radii','t<=6: ro=2t ri=1t; 6<t<=10: ro=2.5t ri=1.5t; t>10: ro=3t ri=2t'
    )
  from public.price_list_items i
  join public.price_list_sections s on s.id=i.section_id
  join public.steel_geometries g on g.id=wl.geometry_id
  where wl.price_list_item_id=i.id
    and s.price_list_version_id=p_price_list_version_id
    and s.weight_standard_key='EN10219'
    and wl.resolution_status='candidate'
    and wl.weight_resolution_mode='unresolved'
    and g.product_family in ('round_tube','square_tube','rectangular_tube');

  get diagnostics v_resolved = row_count;

  return jsonb_build_object(
    'price_list_version_id',p_price_list_version_id,
    'formula_version','wc3.1-en10219-v1',
    'resolved_links',v_resolved
  );
end;
$$;

revoke all on function private.pl1_resolve_wc31_en10219_weights(uuid)
from public, anon, authenticated;

grant execute on function private.pl1_resolve_wc31_en10219_weights(uuid)
to service_role;

commit;