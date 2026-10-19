-- NET-UX DATA1: 501-profile source-coverage audit, service-only / read-only.
-- No automatic claim, publication, verification or capability promotion.
-- A "source_observed" location is NEVER a verified office or facility.
create or replace function public.netdata1_company_audit(
  p_limit integer default 25,
  p_offset integer default 0
) returns jsonb
language plpgsql stable security definer
set search_path=''
as $function$
declare v_summary jsonb;
declare v_items jsonb;
begin
  if current_setting('role',true) is distinct from 'service_role' then
    raise exception 'Service-only company intelligence audit' using errcode='42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 25
     or p_offset is null or p_offset < 0 or p_offset > 10000 then
    raise exception 'Invalid bounded audit page' using errcode='22023';
  end if;

  with entities as (
    select c.id,'canonical'::text kind,c.legal_name name,c.website_url,
       c.website_domain as company_domain,'published'::text source_type
    from public.network_companies c
    where c.publication_status='published' and c.archived_at is null and c.country_code='IT'
    union all
    select d.id,'discovered',d.company_name,d.website_url,d.domain,d.origin
    from private.netfast_discovered_records d
  ), profiles as (
    select e.*,
      lower(regexp_replace(coalesce(e.company_domain,''),'^www[.]','')) domain_norm,
      lower(regexp_replace(split_part(coalesce(e.website_url,''),'/',3),'^www[.]','')) site_host,
      case when e.kind='canonical'
        then exists(select 1 from public.network_facilities f
         where f.company_id=e.id and f.publication_status='published'
           and f.archived_at is null and f.country_code='IT' and nullif(btrim(f.city),'') is not null)
        else false end geo_published,
      case when e.kind='canonical'
        then exists(select 1 from public.network_it_geo_evidence_candidates g
          where g.company_id=e.id and g.status in ('pending_review','approved','source_observed'))
        else exists(select 1 from public.network_neteima2_provisional_geo g
          where g.target_id=e.id and g.status='source_observed') end geo_candidate,
      case when e.kind='canonical'
        then exists(select 1 from public.network_facility_capabilities fc
          join public.network_facilities f on f.id=fc.facility_id
          where f.company_id=e.id and f.publication_status='published' and f.archived_at is null)
        else false end capability_published,
      exists(select 1 from private.network_company_enrichment n
        where ((e.kind='canonical' and n.canonical_company_id=e.id)
            or (e.kind='discovered' and n.discovered_record_id=e.id))
          and n.field_key in ('services','products','industry') and n.review_status in ('candidate','accepted')) capability_evidence
    from entities e
  ), scored as (
    select p.*,
      count(*) over (partition by p.domain_norm) domain_appearances,
      (p.website_url ~ '^https://[^/?#]+/' or p.website_url ~ '^https://[^/?#]+$')
        and p.domain_norm <> '' and p.site_host=p.domain_norm as matching_https_site
    from profiles p
  )
  select jsonb_build_object(
      'contract','netux-data1-audit-v1',
      'scope','501-network-profiles-dynamic',
      'profiles_total',count(*),
      'canonical_published',count(*) filter (where kind='canonical'),
      'discovered',count(*) filter (where kind='discovered'),
      'geographic_source_coverage',count(*) filter (where geo_published or geo_candidate),
      'geographic_published',count(*) filter (where geo_published),
      'geographic_candidate_only',count(*) filter (where geo_candidate and not geo_published),
      'capability_published',count(*) filter (where capability_published),
      'technical_evidence_profiles',count(*) filter (where capability_evidence),
      'official_site_candidate',count(*) filter (where matching_https_site and domain_appearances=1),
      'shared_or_duplicate_domain',count(*) filter (where domain_norm<>'' and domain_appearances>1),
      'not_scan_ready',count(*) filter (where not matching_https_site or domain_appearances>1),
      'note','Site/domain match does not prove corporate identity or rights of reuse; candidates are unverified.'
    ) into v_summary
  from scored;

  with entities as (
    select c.id,'canonical'::text kind,c.legal_name name,c.website_url,
      c.website_domain as company_domain,'published'::text source_type
    from public.network_companies c
    where c.publication_status='published' and c.archived_at is null and c.country_code='IT'
    union all
    select d.id,'discovered',d.company_name,d.website_url,d.domain,d.origin
    from private.netfast_discovered_records d
  ), marked as (
    select e.*,
      lower(regexp_replace(coalesce(e.company_domain,''),'^www[.]','')) domain_norm,
      lower(regexp_replace(split_part(coalesce(e.website_url,''),'/',3),'^www[.]','')) site_host,
      case when e.kind='canonical' then exists(
        select 1 from public.network_it_geo_evidence_candidates g where g.company_id=e.id)
        or exists(select 1 from public.network_facilities f where f.company_id=e.id
          and f.publication_status='published' and f.archived_at is null
          and f.country_code='IT' and nullif(btrim(f.city),'') is not null)
        else exists(select 1 from public.network_neteima2_provisional_geo g where g.target_id=e.id)
      end has_geo,
      exists(select 1 from private.network_company_enrichment n
        where ((e.kind='canonical' and n.canonical_company_id=e.id)
            or (e.kind='discovered' and n.discovered_record_id=e.id))
          and n.field_key in ('services','products','industry') and n.review_status in ('candidate','accepted')) has_technical_evidence
    from entities e
  ), qualified as (
    select m.*,count(*) over (partition by m.domain_norm) domain_appearances
    from marked m
  ), page as (
    select q.*,
      (q.website_url ~ '^https://[^/?#]+/' or q.website_url ~ '^https://[^/?#]+$')
        and q.domain_norm<>'' and q.site_host=q.domain_norm
        and q.domain_appearances=1 as site_candidate
    from qualified q
    order by case when q.kind='canonical' then 0 else 1 end,lower(q.name),q.id
    limit p_limit offset p_offset
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'company_id',id,'kind',kind,'name',name,'domain',domain_norm,
    'site',case when site_candidate then website_url else null end,
    'source_type',source_type,
    'geo_status',case when has_geo then 'evidence_present_or_published' else 'unknown' end,
    'capability_status',case when has_technical_evidence then 'evidence_candidate_or_accepted' else 'unknown' end,
    'source_identity_status',case when site_candidate then 'site_domain_matches_unconfirmed_identity'
          when domain_appearances>1 then 'shared_domain_identity_review'
          else 'needs_official_source' end,
    'reuse_rights','not_assessed',
    'verified_by_data1',false
  ) order by case when kind='canonical' then 0 else 1 end,lower(name),id),'[]'::jsonb)
   into v_items
  from page;
  return v_summary || jsonb_build_object('limit',p_limit,'offset',p_offset,'items',v_items);
end;
$function$;
revoke all on function public.netdata1_company_audit(integer,integer)
 from public,anon,authenticated;
grant execute on function public.netdata1_company_audit(integer,integer) to service_role;
comment on function public.netdata1_company_audit(integer,integer) is
'NET-UX DATA1 service-only read audit; 501 profiles, source and coverage flags; never verifies, promotes, or changes an entity.';
