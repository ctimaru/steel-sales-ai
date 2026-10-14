-- CRAWL-IT6.4: operator-only geographic scale readiness snapshot (read-only).
-- Explicitly no network publication, no harvester activation, no review mutation.
create or replace function public.crawl_it64_geographic_scale_snapshot()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_published integer;
  v_mapped integer;
  v_web_gaps integer;
  v_pending integer;
  v_approved integer;
  v_conflict integer;
  v_istat integer;
  v_sources integer;
  v_approved_sources integer;
  v_enabled_sources integer;
  v_leads integer;
begin
  perform private.require_platform_permission('discovery.read');

  select count(*)::integer
  into v_published
  from public.network_companies c
  where c.country_code='IT' and c.publication_status='published' and c.archived_at is null;

  select count(*)::integer
  into v_mapped
  from public.network_companies c
  where c.country_code='IT' and c.publication_status='published' and c.archived_at is null
    and exists (
      select 1 from public.network_facilities f
      where f.company_id=c.id and f.publication_status='published'
        and f.archived_at is null and f.country_code='IT'
        and nullif(btrim(f.city),'') is not null
    );

  select count(*)::integer
  into v_web_gaps
  from public.network_companies c
  where c.country_code='IT' and c.publication_status='published' and c.archived_at is null
    and nullif(btrim(c.website_url),'') is not null
    and not exists (
      select 1 from public.network_facilities f
      where f.company_id=c.id and f.publication_status='published'
        and f.archived_at is null and f.country_code='IT'
        and nullif(btrim(f.city),'') is not null
    );

  select
    count(*) filter (where status='pending_review')::integer,
    count(*) filter (where status='approved_for_facility_review')::integer,
    count(*) filter (where status='conflict')::integer
  into v_pending,v_approved,v_conflict
  from public.network_it_geo_evidence_candidates;

  select count(*)::integer into v_istat from public.network_it_municipalities;

  select count(*)::integer,
    count(*) filter (where governance_status='approved')::integer,
    count(*) filter (where enabled_for_discovery and governance_status='approved'
      and terms_status in ('allows_reuse','allows_limited_reuse')
      and database_rights_status in ('low_risk','licensed')
      and personal_data_policy in ('company_data_only','exclude_personal_data')
      and reviewed_at is not null and reviewed_by is not null
      and nullif(btrim(coalesce(rights_evidence_url,'')),'') is not null)::integer
  into v_sources,v_approved_sources,v_enabled_sources
  from public.network_discovery_source_registry
  where country_code='IT';

  select count(*) filter (where status='pending_review')::integer
  into v_leads from public.network_discovery_domain_leads where country_code='IT';

  return jsonb_build_object(
    'scope','published_it_companies',
    'published_companies',v_published,
    'companies_with_published_city',v_mapped,
    'companies_missing_published_city',greatest(v_published-v_mapped,0),
    'website_ready_location_gaps',v_web_gaps,
    'city_coverage_pct',case when v_published=0 then 0 else round(100.0*v_mapped/v_published,1) end,
    'geo_evidence_pending',v_pending,
    'geo_evidence_approved_for_facility_review',v_approved,
    'geo_evidence_conflicts',v_conflict,
    'istat_municipalities',v_istat,
    'source_registry_total',v_sources,
    'source_registry_approved',v_approved_sources,
    'source_registry_eligible_enabled',v_enabled_sources,
    'discovery_leads_pending',v_leads,
    'source_gate_ready',v_enabled_sources>0,
    'worker_runtime_status','not_observable_from_database',
    'publication_automatic',false,
    'next_gate',case
      when v_enabled_sources=0 then 'source_rights_review'
      when v_pending>0 then 'geo_evidence_human_review'
      else 'manual_worker_opt_in'
    end
  );
end $$;
revoke all on function public.crawl_it64_geographic_scale_snapshot() from public,anon,authenticated;
grant execute on function public.crawl_it64_geographic_scale_snapshot() to authenticated,service_role;
comment on function public.crawl_it64_geographic_scale_snapshot() is
'CRAWL-IT6.4: discovery.read aggregate; source readiness does NOT prove worker is running; no automatic activation or publication.';
