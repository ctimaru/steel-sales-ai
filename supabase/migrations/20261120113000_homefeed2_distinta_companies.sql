-- HOME-FEED2: companies for the Home feed, chosen from the product families of
-- the organization's own bills of material (buyer_distintas not archived).
--
-- Same family mapping as the DISTINTA2 «Consigliati dal Network» group
-- (private.distinta2_line_family_keys) and the same published-only Network
-- read. Read-only. Rules:
--   * the caller must be an active member of p_organization_id;
--   * names and ids are returned only with Network access
--     (private.pa1_3_network_access_allowed_for); without it only the total
--     is returned, like the public Network totals;
--   * the caller's own linked Network profile is never suggested;
--   * nothing about the bills (titles, lines, quantities, targets) leaves the
--     function: only the family keys.
-- Order: verified first, then producers and traders, then same country, then a
-- daily rotation, so the Home does not show the same companies every day while
-- pages stay stable within a day.

create or replace function private.homefeed2_distinta_companies_impl(
  p_organization_id uuid,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 4), 1), 12);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 10000);
  v_families text[] := '{}'::text[];
  v_network_allowed boolean := false;
  v_country text;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
begin
  perform private.p4_7_require_active_membership(p_organization_id);

  select coalesce(array_agg(distinct k order by k), '{}'::text[]) into v_families
  from (
    select unnest(private.distinta2_line_family_keys(d.id)) as k
    from (
      select bd.id
      from public.buyer_distintas bd
      where bd.organization_id = p_organization_id
        and bd.archived_at is null
      order by bd.created_at desc, bd.id
      limit 20
    ) d
  ) keys;

  v_network_allowed := private.pa1_3_network_access_allowed_for(p_organization_id);

  if cardinality(v_families) = 0 then
    return jsonb_build_object(
      'contract', 'HOME-FEED2-distinta-companies-v1',
      'network_enabled', v_network_allowed,
      'families', '[]'::jsonb,
      'total', 0,
      'items', '[]'::jsonb
    );
  end if;

  select o.country_code into v_country
  from public.organizations o where o.id = p_organization_id;

  with family_ids as (
    select f.id, coalesce(parent.canonical_key, f.canonical_key) as root_key
    from public.network_product_families f
    left join public.network_product_families parent on parent.id = f.parent_id
    where f.canonical_key = any(v_families)
       or parent.canonical_key = any(v_families)
  ),
  matched as (
    select
      nc.id,
      coalesce(nullif(btrim(nc.trading_name), ''), nc.legal_name) as company_name,
      nc.country_code,
      nc.verification_status = 'verified' as verified,
      array_agg(distinct fi.root_key order by fi.root_key) as roots
    from public.network_companies nc
    join public.network_company_products p on p.company_id = nc.id
    join family_ids fi on fi.id = p.product_family_id
    where nc.publication_status = 'published'
      and nc.archived_at is null
      and not exists (
        select 1 from public.organization_network_company_links l
        where l.network_company_id = nc.id
          and l.organization_id = p_organization_id
          and l.link_status = 'active'
      )
    group by nc.id, nc.trading_name, nc.legal_name, nc.country_code, nc.verification_status
  ),
  ranked as (
    select
      m.*,
      role_pick.role_key,
      (case when m.verified then 0 else 1 end) * 100
        + coalesce(role_pick.role_rank, 3) * 10
        + case when v_country is not null and m.country_code = v_country then 0 else 1 end as sort_rank,
      md5(m.id::text || current_date::text) as rotation
    from matched m
    left join lateral (
      select r.canonical_key as role_key,
        case r.canonical_key when 'producer' then 0 when 'trader_distributor' then 1
          when 'processor_service_provider' then 2 else 3 end as role_rank
      from public.network_company_role_assignments ra
      join public.network_company_roles r on r.id = ra.role_id
      where ra.company_id = m.id
      order by ra.is_primary desc,
        case r.canonical_key when 'producer' then 0 when 'trader_distributor' then 1
          when 'processor_service_provider' then 2 else 3 end
      limit 1
    ) role_pick on true
  )
  select
    count(*)::integer,
    case when v_network_allowed then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', page.id,
        'company_name', page.company_name,
        'country_code', page.country_code,
        'verified', page.verified,
        'role_key', page.role_key,
        'families', to_jsonb(page.roots)
      ) order by page.sort_rank, page.rotation, page.id)
      from (
        select * from ranked
        order by sort_rank, rotation, id
        limit v_limit offset v_offset
      ) page
    ), '[]'::jsonb) else '[]'::jsonb end
  into v_total, v_items
  from ranked;

  return jsonb_build_object(
    'contract', 'HOME-FEED2-distinta-companies-v1',
    'network_enabled', v_network_allowed,
    'families', to_jsonb(v_families),
    'total', coalesce(v_total, 0),
    'items', coalesce(v_items, '[]'::jsonb)
  );
end;
$$;

revoke all on function private.homefeed2_distinta_companies_impl(uuid, integer, integer) from public, anon;
grant execute on function private.homefeed2_distinta_companies_impl(uuid, integer, integer) to authenticated;

create or replace function public.homefeed2_distinta_companies(
  p_organization_id uuid,
  p_limit integer default 4,
  p_offset integer default 0
)
returns jsonb
language sql
stable
set search_path=''
as $$
  select private.homefeed2_distinta_companies_impl(p_organization_id, p_limit, p_offset);
$$;

revoke all on function public.homefeed2_distinta_companies(uuid, integer, integer) from public, anon;
grant execute on function public.homefeed2_distinta_companies(uuid, integer, integer) to authenticated;
