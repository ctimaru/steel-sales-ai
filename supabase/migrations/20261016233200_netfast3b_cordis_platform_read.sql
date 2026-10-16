-- NET-FAST3B private research totals (visible only to Platform Discovery staff).
create or replace function private.netfast3b_status_impl()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
 perform private.require_platform_permission('discovery.read');
 select jsonb_build_object(
  'contract','netfast3b-cordis-status-v1',
  'source',coalesce((
   select jsonb_build_object(
     'id',s.id,'status',s.governance_status,'rights_active',
     (g.source_id is not null and g.revoked_at is null and g.expires_at>now()),
     'grant_expires_at',g.expires_at)
   from public.network_discovery_source_registry s
   left join public.network_netfast3_feed_grants g on g.source_id=s.id
   where s.source_url='https://data.europa.eu/data/datasets/cordis-eu-research-projects-under-horizon-europe-2021-2027'
   limit 1), '{}'::jsonb),
  'research_only',(select count(*) from public.network_netfast3b_cordis_research
    where status='needs_official_website'),
  'website_evidence',(select count(*) from public.network_netfast3b_cordis_research
    where status='domain_available'),
  'recent_runs',coalesce((
    select jsonb_agg(jsonb_build_object('month',t.release_month,'status',t.status,
      'scanned',t.scanned_count,'new_research',t.added_research,
      'new_unconfirmed',t.added_preview,'finished_at',t.finished_at))
    from (select * from public.network_netfast3b_cordis_runs
      order by started_at desc limit 6)t),'[]'::jsonb)) into v;
 return v;
end $$;
create or replace function public.netfast3b_status()
returns jsonb language sql stable security invoker set search_path=''
as 'select private.netfast3b_status_impl();';
revoke all on function private.netfast3b_status_impl() from public,anon,authenticated;
revoke all on function public.netfast3b_status() from public,anon;
grant execute on function private.netfast3b_status_impl() to authenticated;
grant execute on function public.netfast3b_status() to authenticated;
