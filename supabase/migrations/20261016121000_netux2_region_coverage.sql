-- NET-UX2 — read-only, organization-authorized geographic coverage.
-- Company counts are distinct, published-only; unknown geography is never fabricated.
-- No changes to PA1.3 RLS, grants or premium entitlement.
create or replace function private.netux2_region_coverage_impl(p_organization_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_coverage jsonb;
begin
  perform private.netux11_require_active_company(p_organization_id);

  with published as (
    select c.id
    from public.network_companies c
    where c.publication_status='published'
      and c.archived_at is null and c.country_code='IT'
  ), localized as (
    select distinct f.company_id, btrim(f.region) as region
    from public.network_facilities f
    join published p on p.id=f.company_id
    where f.publication_status='published' and f.archived_at is null
      and f.country_code='IT' and nullif(btrim(f.region),'') is not null
  ), per_region as (
    select region, count(distinct company_id)::integer as company_count
    from localized group by region
  )
  select jsonb_build_object(
    'contract','netux2-region-coverage-v1',
    'total_companies',(select count(*) from published),
    'mapped_companies',(select count(distinct company_id) from localized),
    'unlocated_companies',(select count(*) from published p
       where not exists (select 1 from localized l where l.company_id=p.id)),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('name',region,'count',company_count)
                        order by region)
      from per_region
    ), '[]'::jsonb)
  ) into v_coverage;
  return v_coverage;
end;
$$;

create or replace function public.netux2_region_coverage(p_organization_id uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select private.netux2_region_coverage_impl(p_organization_id);
$$;

revoke all on function private.netux2_region_coverage_impl(uuid) from public, anon;
revoke all on function public.netux2_region_coverage(uuid) from public, anon;
grant execute on function private.netux2_region_coverage_impl(uuid) to authenticated;
grant execute on function public.netux2_region_coverage(uuid) to authenticated;

comment on function public.netux2_region_coverage(uuid) is
 'NET-UX2 authenticated active-company geographic coverage; published distinct companies only; no private data.';
