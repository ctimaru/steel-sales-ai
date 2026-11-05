-- NET-UX-MAP1: aggregated country/role discovery statistics for the Network ticker.
-- Only the existing directory's published companies and eligible Italian
-- sourced discovery view are counted; private research leads are not published.
-- Counts are informational, never verification/supplier qualification.
create or replace function private.netux_map1_country_stats_impl(
  p_organization_id uuid, p_access text
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_rows jsonb;
begin
  if p_access='free' then
    perform private.netux11_require_active_company(p_organization_id);
  elsif p_access='pro' then
    perform private.pa1_3_require_network_access(p_organization_id);
  else
    raise exception 'Invalid Network access mode' using errcode='22023';
  end if;

  with published as (
    select c.country_code::text as country_code,
      coalesce((
        select r.canonical_key
        from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.status='active'
        order by a.is_primary desc,r.canonical_key
        limit 1
      ),'unknown') as role_key,
      true as is_published
    from public.network_companies c
    where c.publication_status='published' and c.archived_at is null
      and c.country_code is not null
  ), provisional as (
    select 'IT'::text as country_code,
      coalesce(nullif(d.role_key,''),'unknown') as role_key,
      false as is_published
    from private.netfast_discovered_records d
  ), combined as (
    select * from published
    union all
    select * from provisional
  ), tally as (
    select country_code,
      count(*)::integer as total,
      count(*) filter (where is_published)::integer as published,
      count(*) filter (where not is_published)::integer as sourced,
      count(*) filter (where role_key='producer')::integer as producer,
      count(*) filter (where role_key='trader_distributor')::integer as trader,
      count(*) filter (where role_key='processor_service_provider')::integer as processor,
      count(*) filter (where role_key='end_user')::integer as end_user,
      count(*) filter (where role_key not in
        ('producer','trader_distributor','processor_service_provider','end_user'))::integer as other
    from combined
    group by country_code
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'country_code',country_code,
    'total',total,'published',published,'sourced',sourced,
    'producer',producer,'trader',trader,'processor',processor,
    'end_user',end_user,'other',other
  ) order by total desc,country_code),'[]'::jsonb)
  into v_rows from tally;

  return jsonb_build_object('contract','netux-map1-country-stats-v1','countries',v_rows);
end;
$$;

create or replace function public.netux_map1_country_stats(
  p_organization_id uuid, p_access text
) returns jsonb language sql stable security invoker set search_path=''
as $$
  select private.netux_map1_country_stats_impl(p_organization_id,p_access);
$$;

revoke all on function private.netux_map1_country_stats_impl(uuid,text) from public,anon,authenticated;
revoke all on function public.netux_map1_country_stats(uuid,text) from public,anon;
grant execute on function public.netux_map1_country_stats(uuid,text) to authenticated;

comment on function public.netux_map1_country_stats(uuid,text) is
  'Aggregated country/role counts for an authorized Network viewer. Published vs public sourced census kept separate; excludes nonpublished Romania research leads.';
