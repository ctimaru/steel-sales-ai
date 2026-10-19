-- NET-UX COMPACT4: bounded, tenant-gated public geographic evidence for the
-- already visible Network inventory. This DOES NOT publish facilities or change
-- verification/claim states. Candidate and conflict evidence remain private.
create or replace function public.netcompact4_geo_overlay(
  p_organization_id uuid,
  p_access text,
  p_company_ids uuid[]
) returns jsonb
language plpgsql stable security definer
set search_path to ''
as $function$
declare v_items jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_access = 'free' then
    perform private.netux11_require_active_company(p_organization_id);
  elsif p_access = 'pro' then
    perform private.pa1_3_require_network_access(p_organization_id);
  else
    raise exception 'Invalid Network access mode' using errcode = '22023';
  end if;
  if p_company_ids is null or coalesce(array_length(p_company_ids, 1), 0) > 24
     or array_position(p_company_ids, null) is not null then
    raise exception 'Invalid company ID batch' using errcode = '22023';
  end if;

  with
  published_locations as (
    select distinct on (f.company_id)
      f.company_id id, f.city, f.region,
      null::text source_url, 'published'::text geography_status
    from public.network_facilities f
    join public.network_companies c on c.id=f.company_id
    where f.company_id = any(p_company_ids)
      and c.publication_status = 'published' and c.archived_at is null
      and f.publication_status = 'published' and f.archived_at is null
      and f.country_code = c.country_code
      and (nullif(btrim(f.city),'') is not null or nullif(btrim(f.region),'') is not null)
    order by f.company_id, f.created_at, f.id
  ),
  sourced_published as (
    select distinct on (g.company_id)
      g.company_id id, g.city, g.region, g.source_url,
      'sourced_unverified'::text geography_status
    from public.network_it_geo_evidence_candidates g
    join public.network_companies c on c.id=g.company_id
    where g.company_id = any(p_company_ids)
      and c.publication_status = 'published' and c.archived_at is null
      and c.country_code='IT'
      and g.status='pending_review'
      and nullif(btrim(g.city),'') is not null
      and nullif(btrim(g.region),'') is not null
      and lower(btrim(g.source_company_domain))=lower(btrim(c.website_domain))
      and g.source_url like 'https://%'
      and not exists(select 1 from published_locations f where f.id=g.company_id)
    order by g.company_id, g.created_at desc, g.id
  ),
  sourced_discovered as (
    select distinct on (g.target_id)
      g.target_id id, g.city, g.region, g.source_url,
      'sourced_unverified'::text geography_status
    from public.network_neteima2_provisional_geo g
    join private.netfast_discovered_records d on d.id=g.target_id
    where g.target_id = any(p_company_ids)
      and d.origin='official_company_research'
      and g.status='source_observed'
      and nullif(btrim(g.city),'') is not null
      and nullif(btrim(g.region),'') is not null
      and g.source_url like 'https://%'
    order by g.target_id, g.created_at desc, g.id
  ),
  chosen as (
    select * from published_locations
    union all select * from sourced_published
    union all select * from sourced_discovered
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'city',city,'region',region,'source_url',source_url,
      'geography_status',geography_status
    ) order by id), '[]'::jsonb)
  into v_items from chosen;
  return jsonb_build_object('contract','netcompact4-geo-v1','items',v_items);
end;
$function$;

revoke all on function public.netcompact4_geo_overlay(uuid,text,uuid[])
  from public,anon,authenticated;
grant execute on function public.netcompact4_geo_overlay(uuid,text,uuid[]) to authenticated;
comment on function public.netcompact4_geo_overlay(uuid,text,uuid[])
  is 'Authenticated org-gated, capped company IDs: published facilities or explicitly sourced unverified city/region; conflicts excluded.';
